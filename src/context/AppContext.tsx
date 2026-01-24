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
import {
  STORAGE_KEY_LANGUAGE,
  STORAGE_KEY_SETUP_COMPLETE,
} from "../utils/storageKeys";

export type Language = "ru" | "en";

interface AppContextType {
  language: Language | null;
  isSetupComplete: boolean;
  isAudioUnlocked: boolean;
  setLanguage: (lang: Language) => void;
  completeSetup: (lang: Language) => Promise<void>;
  audioContextRef: React.RefObject<AudioContext | null>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY_LANGUAGE);
    return (stored as Language) || null;
  });
  const [isSetupComplete, setIsSetupComplete] = useState(() => {
    return localStorage.getItem(STORAGE_KEY_SETUP_COMPLETE) === "true";
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

  const completeSetup = useCallback(async (lang: Language) => {
    // Unlock audio context (requires user gesture)
    if (
      audioContextRef.current &&
      audioContextRef.current.state === "suspended"
    ) {
      await audioContextRef.current.resume();
    }

    setIsAudioUnlocked(true);
    setLanguage(lang);
    setIsSetupComplete(true);

    localStorage.setItem(STORAGE_KEY_LANGUAGE, lang);
    localStorage.setItem(STORAGE_KEY_SETUP_COMPLETE, "true");
  }, []);

  return (
    <AppContext.Provider
      value={{
        language,
        isSetupComplete,
        isAudioUnlocked,
        setLanguage: handleSetLanguage,
        completeSetup,
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
