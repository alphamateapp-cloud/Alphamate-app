import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type ThemeMode = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'alphamate_theme';
const DARK_THEME_COLOR = '#09070F';
const LIGHT_THEME_COLOR = '#F5F3FA';

interface ThemeContextValue {
  theme: ThemeMode;
  isDark: boolean;
  isLight: boolean;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function isValidTheme(value: unknown): value is ThemeMode {
  return value === 'dark' || value === 'light';
}

export function getInitialTheme(): ThemeMode {
  try {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (isValidTheme(stored)) {
        return stored;
      }
    }
  } catch {
    // Ignore storage access errors in restricted browser contexts
  }
  return 'dark';
}

export function applyThemeToDocument(theme: ThemeMode): void {
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('light', theme === 'light');
    root.dataset.theme = theme;
    root.style.colorScheme = theme;

    const metaThemeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute(
        'content',
        theme === 'dark' ? DARK_THEME_COLOR : LIGHT_THEME_COLOR
      );
    }
  }

  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
  } catch {
    // Ignore storage write errors
  }
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => getInitialTheme());

  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  // Synchronize theme if updated in another browser tab/window
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY && isValidTheme(event.newValue)) {
        setThemeState(event.newValue);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      isDark: theme === 'dark',
      isLight: theme === 'light',
      setTheme,
      toggleTheme,
    }),
    [theme, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
