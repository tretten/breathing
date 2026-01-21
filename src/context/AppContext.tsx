// src/context/AppContext.tsx
import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';

export type Language = 'ru' | 'en';

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
    const stored = localStorage.getItem('wim_hof_language');
    return (stored as Language) || null;
  });
  const [isSetupComplete, setIsSetupComplete] = useState(() => {
    return localStorage.getItem('wim_hof_setup_complete') === 'true';
  });
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);

  // Initialize AudioContext on mount
  useEffect(() => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioContextRef.current = new AudioContextClass();

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const handleSetLanguage = useCallback((lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('wim_hof_language', lang);
  }, []);

  const completeSetup = useCallback(async (lang: Language) => {
    // Unlock audio context (requires user gesture)
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    setIsAudioUnlocked(true);
    setLanguage(lang);
    setIsSetupComplete(true);

    localStorage.setItem('wim_hof_language', lang);
    localStorage.setItem('wim_hof_setup_complete', 'true');
  }, []);

  return (
    <AppContext.Provider value={{
      language,
      isSetupComplete,
      isAudioUnlocked,
      setLanguage: handleSetLanguage,
      completeSetup,
      audioContextRef
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
}
