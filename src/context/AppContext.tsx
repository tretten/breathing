// src/context/AppContext.tsx
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import { STORAGE_KEY_LANGUAGE } from "../utils/storageKeys";

export type Language = "ru" | "en";

interface AppContextType {
  language: Language;
  isAudioUnlocked: boolean;
  setLanguage: (lang: Language) => void;
  unlockAudio: () => Promise<void>;
  audioContextRef: React.RefObject<AudioContext | null>;
}

const AppContext = createContext<AppContextType | null>(null);

// Auto-detect language from browser
function detectLanguage(): Language {
  const browserLang = navigator.language || (navigator as any).userLanguage || "en";
  return browserLang.toLowerCase().startsWith("ru") ? "ru" : "en";
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    const stored = localStorage.getItem(STORAGE_KEY_LANGUAGE);
    if (stored === "ru" || stored === "en") {
      return stored;
    }
    // Auto-detect and save
    const detected = detectLanguage();
    localStorage.setItem(STORAGE_KEY_LANGUAGE, detected);
    return detected;
  });

  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Initialize AudioContext on mount
  useEffect(() => {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    audioContextRef.current = new AudioContextClass();

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const handleSetLanguage = useCallback((lang: Language) => {
    setLanguage(lang);
    localStorage.setItem(STORAGE_KEY_LANGUAGE, lang);
  }, []);

  const unlockAudio = useCallback(async () => {
    if (
      audioContextRef.current &&
      audioContextRef.current.state === "suspended"
    ) {
      await audioContextRef.current.resume();
    }
    setIsAudioUnlocked(true);
  }, []);

  return (
    <AppContext.Provider
      value={{
        language,
        isAudioUnlocked,
        setLanguage: handleSetLanguage,
        unlockAudio,
        audioContextRef,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within AppProvider");
  }
  return context;
}
