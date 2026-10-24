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
import {
  applyAppearance,
  readAppearance,
  setColorScheme,
  setFontFamily,
  setFontScale,
  setBackgroundStyle,
  DEFAULT_SCHEME,
  DEFAULT_FONT,
  DEFAULT_FONT_SCALE,
  DEFAULT_BACKGROUND,
} from '../utils/appearance';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

const ThemeContext = createContext();

/**
 * How often the settings are pulled from the server.
 *
 * The user may be on the same account on a phone and a laptop. The
 * change made on one should show on the other, so the settings are
 * pulled on a timer as well as on focus.
 */
const SYNC_INTERVAL_MS = 60000;

export const ThemeProvider = ({ children }) => {
  // The signed-in user. The settings follow the user between devices,
  // so they are only pulled when there is a user to pull them for.
  const { user } = useAuth();

  // The user's *mode*: 'light' | 'dark' | 'system'.
  // `theme` is the resolved theme actually painted right now.
  const [mode, setModeState] = useState(() => readStoredTheme() || THEME_SYSTEM);
  const [theme, setThemeState] = useState(() => resolveTheme());

  // The look on top of the theme.
  const [appearance, setAppearance] = useState(() => readAppearance());

  // The revision the server last gave us. It is what tells us whether
  // the settings on the server are newer than the ones we have.
  const [revision, setRevision] = useState(0);

  const isDarkMode = theme === THEME_DARK;

  // Apply on mount and on every change.
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // The look follows the appearance state.
  useEffect(() => {
    applyAppearance(appearance);
  }, [appearance]);

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
      if (
        event.key === 'finmanager-scheme' ||
        event.key === 'finmanager-font' ||
        event.key === 'finmanager-font-scale' ||
        event.key === 'finmanager-background'
      ) {
        setAppearance(readAppearance());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  /**
   * Pull the settings from the server.
   *
   * The server holds the copy that follows the user between devices.
   * The local copy is what makes the app work offline and paint
   * correctly on the first frame, so the two are reconciled: the
   * server wins when it has something, and the local copy is only kept
   * when the server has never been asked.
   */
  const syncFromServer = useCallback(async () => {
    try {
      const data = await api.request('/settings/app');
      if (!data) return;

      if (typeof data.revision === 'number') {
        setRevision(data.revision);
      }

      // The appearance follows the server.
      const next = {
        color_scheme: data.color_scheme || DEFAULT_SCHEME,
        font_family: data.font_family || DEFAULT_FONT,
        font_scale: data.font_scale || DEFAULT_FONT_SCALE,
        background_style: data.background_style || DEFAULT_BACKGROUND,
      };

      setColorScheme(next.color_scheme);
      setFontFamily(next.font_family);
      setFontScale(next.font_scale);
      setBackgroundStyle(next.background_style);
      setAppearance(next);

      // The theme too, but only when the user has not pinned it on
      // this device. A device that was deliberately set to light stays
      // light.
      if (
        data.theme === THEME_LIGHT ||
        data.theme === THEME_DARK ||
        data.theme === THEME_SYSTEM
      ) {
        const local = readStoredTheme();
        if (!local || local === THEME_SYSTEM) {
          writeStoredTheme(data.theme);
          setModeState(data.theme);
          const resolved =
            data.theme === THEME_SYSTEM ? resolveTheme() : data.theme;
          setThemeState(resolved);
          applyTheme(resolved);
        }
      }
    } catch (e) {
      // Offline, or the server is not reachable. The local copy stands.
    }
  }, []);

  // Pull once when the app starts, and then on a timer so a change made
  // on another device shows up here.
  useEffect(() => {
    // Without a user there is nothing to sync. The local copy stands,
    // and the sync starts as soon as the user signs in.
    if (!user) return undefined;

    syncFromServer();
    const timer = setInterval(syncFromServer, SYNC_INTERVAL_MS);
    const onFocus = () => syncFromServer();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [syncFromServer, user]);

  /**
   * Send a change to the server.
   *
   * The revision is sent along so the server can tell whether the
   * change is based on what it currently holds. If another device
   * changed something in the meantime, the server keeps its newer copy
   * and hands it back, and the local copy is updated to match rather
   * than overwriting it.
   */
  const pushToServer = useCallback(
    async (patch) => {
      if (!user) return null;
      try {
        const data = await api.request('/settings/app', {
          method: 'PUT',
          body: JSON.stringify({ ...patch, base_revision: revision }),
        });
        if (!data) return null;

        if (typeof data.revision === 'number') {
          setRevision(data.revision);
        }

        // The server may have refused the change because another device
        // changed something in the meantime. In that case it hands back
        // what it holds, and the local copy is brought in line rather
        // than leaving the two devices showing different things.
        if (patch.color_scheme && data.color_scheme !== patch.color_scheme) {
          setColorScheme(data.color_scheme);
          setAppearance((prev) => ({ ...prev, color_scheme: data.color_scheme }));
        }
        if (patch.font_family && data.font_family !== patch.font_family) {
          setFontFamily(data.font_family);
          setAppearance((prev) => ({ ...prev, font_family: data.font_family }));
        }
        if (patch.font_scale && data.font_scale !== patch.font_scale) {
          setFontScale(data.font_scale);
          setAppearance((prev) => ({ ...prev, font_scale: data.font_scale }));
        }
        if (patch.background_style && data.background_style !== patch.background_style) {
          setBackgroundStyle(data.background_style);
          setAppearance((prev) => ({
            ...prev,
            background_style: data.background_style,
          }));
        }
        return data;
      } catch (e) {
        // The change stays local. The next sync pulls the server's
        // copy and the user can try again.
        return null;
      }
    },
    [revision, user]
  );

  /**
   * Set the theme mode explicitly.
   *
   * 'light' and 'dark' record a hard user choice that permanently overrides
   * the OS preference and any force-dark heuristics. 'system' hands control
   * back to the OS and keeps following it.
   */
  const setTheme = useCallback(
    (next) => {
      const value =
        next === THEME_DARK || next === THEME_SYSTEM ? next : THEME_LIGHT;
      writeStoredTheme(value);
      setModeState(value);
      const resolved = value === THEME_SYSTEM ? resolveTheme() : value;
      setThemeState(resolved);
      applyTheme(resolved);
      pushToServer({ theme: value });
    },
    [pushToServer]
  );

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
      pushToServer({ theme: next });
      return next;
    });
  }, [pushToServer]);

  // --- The appearance ---

  const changeColorScheme = useCallback(
    (id) => {
      const value = setColorScheme(id);
      setAppearance((prev) => ({ ...prev, color_scheme: value }));
      pushToServer({ color_scheme: value });
    },
    [pushToServer]
  );

  const changeFontFamily = useCallback(
    (id) => {
      const value = setFontFamily(id);
      setAppearance((prev) => ({ ...prev, font_family: value }));
      pushToServer({ font_family: value });
    },
    [pushToServer]
  );

  const changeFontScale = useCallback(
    (id) => {
      const value = setFontScale(id);
      setAppearance((prev) => ({ ...prev, font_scale: value }));
      pushToServer({ font_scale: value });
    },
    [pushToServer]
  );

  const changeBackgroundStyle = useCallback(
    (id) => {
      const value = setBackgroundStyle(id);
      setAppearance((prev) => ({ ...prev, background_style: value }));
      pushToServer({ background_style: value });
    },
    [pushToServer]
  );

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
        // The look on top of the theme.
        appearance,
        colorScheme: appearance.color_scheme,
        fontFamily: appearance.font_family,
        fontScale: appearance.font_scale,
        backgroundStyle: appearance.background_style,
        setColorScheme: changeColorScheme,
        setFontFamily: changeFontFamily,
        setFontScale: changeFontScale,
        setBackgroundStyle: changeBackgroundStyle,
        revision,
        syncFromServer,
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
