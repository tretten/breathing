// src/context/AppContext.tsx
import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { STORAGE_KEY_LANGUAGE } from "../utils/storageKeys";

export type Language = "ru" | "en";

interface AppContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
}

const AppContext = createContext<AppContextType | null>(null);

// Auto-detect language from browser
function detectLanguage(): Language {
  const browserLang = navigator.language || "en";
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

  const handleSetLanguage = useCallback((lang: Language) => {
    setLanguage(lang);
    localStorage.setItem(STORAGE_KEY_LANGUAGE, lang);
    document.documentElement.lang = lang;
  }, []);

  return (
    <AppContext.Provider
      value={{
        language,
        setLanguage: handleSetLanguage,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within AppProvider");
  }
  return context;
}
