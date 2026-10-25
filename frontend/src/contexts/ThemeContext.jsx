import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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
  applyAccentForeground,
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

  // The revision the next change is based on.
  //
  // The state above is what is drawn, and it only moves when the app
  // renders again. Two changes in quick succession - picking a colour
  // and then picking the mode - would both read the same revision from
  // the render that is on screen, so the second one would be turned
  // away as stale and its change would be lost. This holds the
  // revision that the next change is actually based on, and moves on
  // as soon as a change is accepted.
  const revisionRef = useRef(0);

  const isDarkMode = theme === THEME_DARK;

  // Apply on mount and on every change.
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // The look follows the appearance state.
  //
  // This comes before the accent foreground below, because that one
  // reads the scheme off the document and the scheme is only written
  // there by this effect.
  useEffect(() => {
    applyAppearance(appearance);
  }, [appearance]);

  // The accent as the colour of text follows the mode, because the
  // accent that works on a white page is too dark to read on a dark
  // one. This is done here rather than in the stylesheet so that the
  // one place that knows the mode is the one that decides.
  useEffect(() => {
    applyAccentForeground();
  }, [theme, appearance.color_scheme]);

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
        revisionRef.current = data.revision;
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

      // The change is sent with the revision it is based on. If the
      // server has moved on - another device changed something, or a
      // change of this device was sent a moment ago - the server hands
      // back what it holds instead of applying the change. The change
      // is then sent once more on top of that, so that the choice the
      // user just made is never quietly lost.
      const send = async (base) => {
        const data = await api.request('/settings/app', {
          method: 'PUT',
          body: JSON.stringify({ ...patch, base_revision: base }),
        });
        if (!data) return null;
        if (typeof data.revision === 'number') {
          setRevision(data.revision);
          revisionRef.current = data.revision;
        }
        return data;
      };

      try {
        let data = await send(revisionRef.current);
        if (!data) return null;

        // Was the change turned away as out of date? The one that
        // matters is the field the change was about.
        const key = Object.keys(patch)[0];
        if (key && key !== 'base_revision' && data[key] !== patch[key]) {
          // The server was holding something different. The change is
          // made again on top of what the server holds now.
          const again = await send(data.revision);
          if (again) {
            data = again;
          }
        }

        // Whatever the server holds now is what is shown. If the
        // change was accepted, this is the change itself; if it was
        // turned away, this is the other device's version, and the
        // two devices are made to agree rather than being left to
        // show different things.
        if (typeof data.color_scheme === 'string') {
          setColorScheme(data.color_scheme);
          setAppearance((prev) => ({ ...prev, color_scheme: data.color_scheme }));
        }
        if (typeof data.font_family === 'string') {
          setFontFamily(data.font_family);
          setAppearance((prev) => ({ ...prev, font_family: data.font_family }));
        }
        if (typeof data.font_scale === 'string') {
          setFontScale(data.font_scale);
          setAppearance((prev) => ({ ...prev, font_scale: data.font_scale }));
        }
        if (typeof data.background_style === 'string') {
          setBackgroundStyle(data.background_style);
          setAppearance((prev) => ({
            ...prev,
            background_style: data.background_style,
          }));
        }
        if (typeof data.theme === 'string') {
          writeStoredTheme(data.theme);
          setModeState(data.theme);
          const resolved =
            data.theme === THEME_SYSTEM ? resolveTheme() : data.theme;
          setThemeState(resolved);
          applyTheme(resolved);
        }
        return data;
      } catch (e) {
        // The change stays local. The next sync pulls the server's
        // copy and the user can try again.
        return null;
      }
    },
    [user]
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
