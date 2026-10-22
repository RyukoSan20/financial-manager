import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  THEME_LIGHT,
  THEME_DARK,
  THEME_SYSTEM,
  resolveTheme,
  applyTheme,
  writeStoredTheme,
  watchSystemTheme,
  readStoredTheme,
} from '../utils/theme';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  // The user's *mode*: 'light' | 'dark' | 'system'.
  // `theme` is the resolved theme actually painted right now.
  const [mode, setModeState] = useState(() => readStoredTheme() || THEME_SYSTEM);
  const [theme, setThemeState] = useState(() => resolveTheme());
  const isDarkMode = theme === THEME_DARK;

  // Apply on mount and on every change.
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Follow the OS preference while the mode is 'system' (or unset).
  useEffect(() => {
    return watchSystemTheme((next) => {
      setThemeState(next);
    });
  }, []);

  // Another tab changed the theme - stay in sync.
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === 'finmanager-theme' || event.key === 'theme') {
        const nextMode = readStoredTheme() || THEME_SYSTEM;
        setModeState(nextMode);
        setThemeState(resolveTheme());
        applyTheme(resolveTheme());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  /**
   * Set the theme mode explicitly.
   *
   * 'light' and 'dark' record a hard user choice that permanently overrides
   * the OS preference and any force-dark heuristics. 'system' hands control
   * back to the OS and keeps following it.
   */
  const setTheme = useCallback((next) => {
    const value =
      next === THEME_DARK || next === THEME_SYSTEM ? next : THEME_LIGHT;
    writeStoredTheme(value);
    setModeState(value);
    const resolved = value === THEME_SYSTEM ? resolveTheme() : value;
    setThemeState(resolved);
    applyTheme(resolved);
  }, []);

  /**
   * Toggle between light and dark. When the current mode is 'system', the
   * toggle pins the opposite of what is currently displayed, so the first
   * click always produces a visible change.
   */
  const toggleTheme = useCallback(() => {
    setModeState((prevMode) => {
      const currentResolved =
        prevMode === THEME_SYSTEM ? resolveTheme() : prevMode;
      const next = currentResolved === THEME_DARK ? THEME_LIGHT : THEME_DARK;
      writeStoredTheme(next);
      setThemeState(next);
      applyTheme(next);
      return next;
    });
  }, []);

  /**
   * True when the theme is controlled by the OS rather than an explicit
   * light/dark choice. The UI can show this so the user knows why it looks
   * the way it does.
   */
  const isSystemTheme = mode === THEME_SYSTEM;

  return (
    <ThemeContext.Provider
      value={{
        isDarkMode,
        theme,
        mode,
        setTheme,
        toggleTheme,
        isSystemTheme,
        // Legacy aliases kept so existing call sites keep working.
        themeMode: theme,
        setThemeMode: setTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

export default ThemeProvider;
