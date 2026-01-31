// src/components/ThemeToggle.tsx
import { useState, useEffect } from "react";
import { useAppContext } from "../context/AppContext";
import { STORAGE_KEY_THEME } from "../utils/storageKeys";

export function ThemeToggle() {
  const { language } = useAppContext();
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_THEME);
    if (saved) return saved === "dark";
    // Default to dark theme
    return true;
  });

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      isDark ? "dark" : "light",
    );
    localStorage.setItem(STORAGE_KEY_THEME, isDark ? "dark" : "light");
  }, [isDark]);

  const label =
    language === "ru"
      ? isDark
        ? "Светлая тема"
        : "Тёмная тема"
      : isDark
        ? "Switch to light mode"
        : "Switch to dark mode";

  return (
    <button
      className="theme-btn"
      onClick={() => setIsDark(!isDark)}
      aria-label={label}
      aria-pressed={isDark}
      title={label}
    >
      {isDark ? (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      ) : (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
