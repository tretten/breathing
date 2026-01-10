# Wim Hof Breathing — Архитектура приложения

## Обзор

Синхронное веб-приложение для совместного дыхания по методу Вима Хофа. Только фронтенд (SPA на React), синхронизация через Firebase Realtime Database, аудио через Web Audio API.

---

## 1. Структура данных Firebase

```json
{
  "rooms": {
    "ru_4rounds": {
      "online": {
        "<clientId>": {
          "joinedAt": 1234567890123
        }
      }
    },
    "en_4rounds": { "online": {} },
    "ru_3rounds": { "online": {} },
    "en_3rounds": { "online": {} },
    
    "custom_ready": {
      "selectedPreset": "ru_4rounds",
      "status": "idle",
      "startTimestamp": null,
      "online": {
        "<clientId>": {
          "isReady": false,
          "joinedAt": 1234567890123
        }
      }
    }
  }
}
```

### Почему такая структура?

1. **Минимум записей** — для автокомнат храним только presence, `nextStartTimestamp` вычисляется на клиенте по серверному времени.

2. **`online` как дочерний узел** — позволяет использовать `.info/connected` и `onDisconnect()` для автоочистки.

3. **Статусы `custom_ready`**:
   - `idle` — ожидание, можно менять пресет
   - `countdown` — все готовы, идёт обратный отсчёт 3 сек
   - `playing` — воспроизводится аудио
   - `completed` → автоматически сбрасывается в `idle`

4. **Нет `lastSeen`** — полагаемся на `onDisconnect().remove()`, не делаем heartbeat-записи.

---

## 2. Синхронизация времени

### Server Time Offset

```typescript
// Firebase предоставляет смещение локального времени от серверного
const offsetRef = ref(db, '.info/serverTimeOffset');
onValue(offsetRef, (snap) => {
  const offset = snap.val() || 0;
  // serverTime = Date.now() + offset
});
```

### Вычисление следующего слота (каждые 30 минут)

```typescript
function getNextSlotTimestamp(serverTime: number): number {
  const SLOT_INTERVAL = 30 * 60 * 1000; // 30 минут
  const currentSlot = Math.floor(serverTime / SLOT_INTERVAL) * SLOT_INTERVAL;
  const nextSlot = currentSlot + SLOT_INTERVAL;
  
  // Если мы в первые 5 секунд слота — это текущая сессия
  if (serverTime - currentSlot < 5000) {
    return currentSlot;
  }
  return nextSlot;
}
```

---

## 3. Web Audio API — синхронный старт

### Принцип

Web Audio API позволяет запланировать воспроизведение на точное время относительно `audioContext.currentTime`:

```typescript
// delay в секундах от текущего момента audioContext
source.start(audioContext.currentTime + delaySeconds);
```

### Алгоритм

1. Загружаем аудиофайл → декодируем в `AudioBuffer`
2. Вычисляем `delayMs = startTimestamp - serverTime`
3. Конвертируем в секунды: `delaySeconds = delayMs / 1000`
4. Планируем: `source.start(audioContext.currentTime + delaySeconds)`

### Важно: Autoplay Policy

Браузеры блокируют воспроизведение аудио без пользовательского взаимодействия. Решение:

```typescript
// При первом клике/тапе
async function unlockAudio() {
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }
}

// Привязываем к кнопке "Войти в комнату" или отдельной кнопке "Включить звук"
```

---

## 4. Архитектура компонентов React

```
App
├── RoomList                    # Главная страница со списком комнат
├── AutoRoom                    # Страница автокомнаты (/room/:roomId)
│   ├── useServerTime()         # Хук: серверное время + offset
│   ├── usePresence()           # Хук: presence + onlineCount
│   ├── useAudioPlayback()      # Хук: загрузка + планирование аудио
│   ├── OnlineCounter           # Компонент: "N человек онлайн"
│   ├── CountdownTimer          # Компонент: таймер до старта
│   └── SessionStatus           # Компонент: "Сессия идёт" / "Перерыв"
│
└── CustomReadyRoom             # Страница custom_ready
    ├── useServerTime()
    ├── usePresence()           # + isReady для каждого клиента
    ├── useAudioPlayback()
    ├── PresetSelector          # Выбор пресета (4 варианта)
    ├── ReadyButton             # Кнопка Ready
    ├── ReadyStatus             # "3/5 готовы"
    └── CountdownOverlay        # 3-2-1 визуальный countdown
```

---

## 5. Ключевые хуки

### `useServerTime()`

```typescript
function useServerTime() {
  const [offset, setOffset] = useState(0);
  
  useEffect(() => {
    const offsetRef = ref(db, '.info/serverTimeOffset');
    return onValue(offsetRef, (snap) => setOffset(snap.val() || 0));
  }, []);
  
  const getServerTime = useCallback(() => Date.now() + offset, [offset]);
  
  return { getServerTime, offset };
}
```

### `usePresence(roomId, clientId)`

```typescript
function usePresence(roomId: string, clientId: string) {
  const [onlineCount, setOnlineCount] = useState(0);
  const [clients, setClients] = useState<Record<string, ClientData>>({});
  
  useEffect(() => {
    const myRef = ref(db, `rooms/${roomId}/online/${clientId}`);
    const onlineRef = ref(db, `rooms/${roomId}/online`);
    
    // Записываем себя
    set(myRef, { joinedAt: serverTimestamp() });
    
    // Удаляем при отключении
    onDisconnect(myRef).remove();
    
    // Слушаем изменения
    const unsubscribe = onValue(onlineRef, (snap) => {
      const data = snap.val() || {};
      setClients(data);
      setOnlineCount(Object.keys(data).length);
    });
    
    return () => {
      unsubscribe();
      remove(myRef);
    };
  }, [roomId, clientId]);
  
  return { onlineCount, clients };
}
```

### `useAudioPlayback({ audioUrl, getServerTime })`

```typescript
function useAudioPlayback({ audioUrl, getServerTime }) {
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  
  // Загрузка аудио
  useEffect(() => {
    async function loadAudio() {
      const ctx = new AudioContext();
      audioContextRef.current = ctx;
      
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = await ctx.decodeAudioData(arrayBuffer);
      setAudioBuffer(buffer);
    }
    loadAudio();
  }, [audioUrl]);
  
  // Планирование воспроизведения
  const schedulePlayback = useCallback((startTimestamp: number) => {
    if (!audioBuffer || !audioContextRef.current) return;
    
    const ctx = audioContextRef.current;
    const serverTime = getServerTime();
    const delayMs = startTimestamp - serverTime;
    
    if (delayMs < 0) return; // Уже прошло
    
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    
    const delaySeconds = delayMs / 1000;
    source.start(ctx.currentTime + delaySeconds);
    
    // Отслеживаем состояние
    setTimeout(() => setIsPlaying(true), delayMs);
    source.onended = () => setIsPlaying(false);
  }, [audioBuffer, getServerTime]);
  
  // Разблокировка AudioContext
  const unlockAudio = useCallback(async () => {
    if (audioContextRef.current?.state === 'suspended') {
      await audioContextRef.current.resume();
    }
  }, []);
  
  return { audioBuffer, isPlaying, schedulePlayback, unlockAudio };
}
```

---

## 6. Логика custom_ready

### Проверка "все готовы"

```typescript
function checkAllReady(clients: Record<string, { isReady: boolean }>) {
  const clientList = Object.values(clients);
  if (clientList.length === 0) return false;
  return clientList.every(c => c.isReady);
}
```

### Запуск сессии (выполняется любым клиентом, кто первый увидел)

```typescript
async function startCountdown(roomId: string, getServerTime: () => number) {
  const roomRef = ref(db, `rooms/${roomId}`);
  
  // Транзакция для атомарного обновления
  await runTransaction(roomRef, (current) => {
    if (current?.status !== 'idle') return; // Уже запущено
    
    return {
      ...current,
      status: 'countdown',
      startTimestamp: getServerTime() + 3000 // +3 секунды
    };
  });
}
```

### Сброс после завершения

```typescript
async function resetRoom(roomId: string) {
  const roomRef = ref(db, `rooms/${roomId}`);
  const onlineRef = ref(db, `rooms/${roomId}/online`);
  
  // Сбрасываем статус комнаты
  await update(roomRef, {
    status: 'idle',
    startTimestamp: null
  });
  
  // Сбрасываем isReady у всех клиентов
  const snapshot = await get(onlineRef);
  const clients = snapshot.val() || {};
  
  const updates: Record<string, boolean> = {};
  Object.keys(clients).forEach(clientId => {
    updates[`${clientId}/isReady`] = false;
  });
  
  await update(onlineRef, updates);
}
```

---

## 7. Обход Autoplay-ограничений

### Стратегия 1: Кнопка входа в комнату

На главной странице пользователь кликает "Войти в комнату". Этот клик используем для `audioContext.resume()`.

```tsx
function RoomCard({ room, onEnter }) {
  const handleClick = async () => {
    await unlockAudio(); // Вызываем до навигации
    onEnter(room.id);
  };
  
  return <button onClick={handleClick}>Войти</button>;
}
```

### Стратегия 2: Модальное окно при входе

Если пользователь зашёл по прямой ссылке, показываем модалку:

```tsx
function AudioUnlockModal({ onUnlock }) {
  return (
    <div className="modal">
      <p>Нажмите, чтобы включить звук</p>
      <button onClick={onUnlock}>Включить звук</button>
    </div>
  );
}
```

### Стратегия 3: Повторная попытка при планировании

```typescript
const schedulePlayback = async (startTimestamp: number) => {
  const ctx = audioContextRef.current;
  
  // Пробуем resume перед каждым планированием
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch (e) {
      console.warn('AudioContext still suspended, need user interaction');
      return false;
    }
  }
  
  // ... планируем воспроизведение
  return true;
};
```

---

## 8. Оптимизация для бесплатного Firebase

### Минимизация записей

1. **Нет heartbeat** — только `onDisconnect().remove()`
2. **Нет lastSeen** — экономим на обновлениях
3. **Транзакции** — используем `runTransaction()` для атомарных операций

### Минимизация чтений

1. **Подписка на узел, не на детей** — `onValue(roomRef)` вместо множества слушателей
2. **Отписка при unmount** — всегда возвращаем cleanup из useEffect

### Структура для shallow reads

```
rooms/
  ru_4rounds/
    online/          ← подписываемся только сюда
  custom_ready/
    status           ← shallow read
    selectedPreset   ← shallow read  
    startTimestamp   ← shallow read
    online/          ← отдельная подписка
```

---

## 9. Файловая структура проекта

```
src/
├── firebase/
│   └── config.ts           # Инициализация Firebase
├── hooks/
│   ├── useServerTime.ts
│   ├── usePresence.ts
│   ├── useAudioPlayback.ts
│   └── useClientId.ts
├── components/
│   ├── RoomList.tsx
│   ├── AutoRoom.tsx
│   ├── CustomReadyRoom.tsx
│   ├── CountdownTimer.tsx
│   ├── OnlineCounter.tsx
│   ├── PresetSelector.tsx
│   └── ReadyButton.tsx
├── utils/
│   ├── timeSlots.ts        # Вычисление слотов
│   └── audioUrls.ts        # Маппинг пресетов на URL
├── types/
│   └── index.ts            # TypeScript типы
├── App.tsx
└── main.tsx

public/
└── audio/
    ├── ru_4rounds.mp3
    ├── en_4rounds.mp3
    ├── ru_3rounds.mp3
    └── en_3rounds.mp3
```

---

## 10. Конфигурация Firebase

### firebase/config.ts

```typescript
import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT.firebaseio.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
```

### Правила безопасности (database.rules.json)

```json
{
  "rules": {
    "rooms": {
      "$roomId": {
        ".read": true,
        "online": {
          "$clientId": {
            ".write": true
          }
        },
        "selectedPreset": {
          ".write": true,
          ".validate": "newData.isString() && newData.val().matches(/^(ru|en)_(3|4)rounds$/)"
        },
        "status": {
          ".write": true,
          ".validate": "newData.isString()"
        },
        "startTimestamp": {
          ".write": true
        }
      }
    }
  }
}
```

---

## Следующие шаги

1. Создать проект Firebase и получить конфиг
2. Загрузить аудиофайлы в /public/audio/
3. Запустить приложение: `npm run dev`
4. Протестировать в двух вкладках браузера
5. Добавить стилизацию и анимации
