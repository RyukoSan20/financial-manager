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
  readThemeConcept,
  writeThemeConcept,
  syncThemeConceptToDom,
  DEFAULT_THEME_CONCEPT,
  THEME_CONCEPT_IDS,
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
import {
  getAppTheme, getPalette, setAppTheme as storeAppTheme, setPalette as storePalette,
  nextAppTheme, applyAppTheme, THEME_KEY, PALETTE_KEY, APP_THEME_IDS, PALETTE_IDS,
} from '../utils/appTheme';
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

  // The whole design the app is drawn in (corporate / medieval / jade), and
  // the panel palette of the medieval one. They live in the account's
  // `preferences`, beside the rest of the look.
  const [appTheme, setAppThemeState] = useState(() => getAppTheme());
  const [palette, setPaletteState] = useState(() => getPalette());

  // The visual concept of the app - the canvas, the cards, the borders, the
  // shadows, the background pattern and the way the numbers are set. It
  // sits on top of the light/dark mode and the accent colour: those two
  // are the reader's own choices and they keep working whichever concept
  // is active.
  const [themeConcept, setThemeConceptState] = useState(
    () => readThemeConcept() || DEFAULT_THEME_CONCEPT
  );

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

  // Apply on mount and on every change. The medieval design is a light
  // parchment design, so it is always drawn on the light side.
  useEffect(() => {
    applyTheme(appTheme === 'medieval' ? THEME_LIGHT : theme);
    applyAppTheme({ theme: appTheme, palette });
  }, [theme, appTheme, palette]);

  // The concept is written onto the document - <html> and <body> - and the
  // canvas and the ink are repainted, because they are inline styles on the
  // root element and an inline style beats every stylesheet.
  //
  // This runs before the appearance below, so the accent foreground is
  // decided against the concept that is actually showing.
  useEffect(() => {
    syncThemeConceptToDom(themeConcept);
  }, [themeConcept]);

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
      if (event.key === THEME_KEY) setAppThemeState(getAppTheme());
      if (event.key === PALETTE_KEY) setPaletteState(getPalette());
      if (event.key === 'fm_theme_concept') {
        setThemeConceptState(readThemeConcept() || DEFAULT_THEME_CONCEPT);
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

      // The skin and its palette ride in `preferences`.
      const prefs = (data.preferences && typeof data.preferences === 'object') ? data.preferences : {};
      if (APP_THEME_IDS.includes(prefs.ui_theme)) { storeAppTheme(prefs.ui_theme); setAppThemeState(prefs.ui_theme); }
      if (PALETTE_IDS.includes(prefs.ui_palette)) { storePalette(prefs.ui_palette); setPaletteState(prefs.ui_palette); }

      // And so does the concept.
      if (THEME_CONCEPT_IDS.includes(prefs.ui_concept)) {
        writeThemeConcept(prefs.ui_concept);
        setThemeConceptState(prefs.ui_concept);
      }

      // The theme too, but only when the user has not pinned it on
      // this device. A device that was deliberately set to light stays
      // light.
      //
      // 'system' is the subtle one. It used to be treated as "not
      // pinned", so the server's copy overwrote it - and since the
      // server's copy was a resolved 'light', the mode was lost within
      // one sync interval and the app fell back to following the OS
      // without the reader ever being able to say "follow the server".
      //
      // The rule is: an explicit 'light' or 'dark' on this device
      // wins over the server, because the reader pinned it here. A
      // local 'system' does not pin anything, so the server may set
      // the mode - but only to a real mode, and only if it actually
      // has one. When the server says 'system' too, the device
      // follows the OS, which is what 'system' means.
      if (
        data.theme === THEME_LIGHT ||
        data.theme === THEME_DARK ||
        data.theme === THEME_SYSTEM
      ) {
        const local = readStoredTheme();
        const localPinned = local === THEME_LIGHT || local === THEME_DARK;
        if (!localPinned) {
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
        const accepted = key === 'preferences'
          ? Object.keys(patch.preferences || {}).every(
              (k) => (data.preferences || {})[k] === patch.preferences[k]
            )
          : data[key] === patch[key];
        if (key && key !== 'base_revision' && !accepted) {
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
        if (data.preferences && typeof data.preferences === 'object') {
          if (APP_THEME_IDS.includes(data.preferences.ui_theme)) { storeAppTheme(data.preferences.ui_theme); setAppThemeState(data.preferences.ui_theme); }
          if (PALETTE_IDS.includes(data.preferences.ui_palette)) { storePalette(data.preferences.ui_palette); setPaletteState(data.preferences.ui_palette); }
          if (THEME_CONCEPT_IDS.includes(data.preferences.ui_concept)) { writeThemeConcept(data.preferences.ui_concept); setThemeConceptState(data.preferences.ui_concept); }
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
      // 'system' is a first-class choice, not a fallback: it hands
      // control back to the device and keeps following it.
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

  const changeAppTheme = useCallback(
    (id) => {
      const value = storeAppTheme(id);
      setAppThemeState(value);
      pushToServer({ preferences: { ui_theme: value } });
    },
    [pushToServer]
  );

  // One click: the next theme in the cycle.
  const cycleAppTheme = useCallback(() => changeAppTheme(nextAppTheme(getAppTheme())), [changeAppTheme]);

  const changePalette = useCallback(
    (id) => {
      const value = storePalette(id);
      setPaletteState(value);
      pushToServer({ preferences: { ui_palette: value } });
    },
    [pushToServer]
  );

  /**
   * Choose the visual concept of the app.
   *
   * The choice is kept on the device at once - so the whole app repaints
   * immediately, on every route - and then sent to the account, so it
   * follows the reader to another device.
   */
  const changeThemeConcept = useCallback(
    (id) => {
      const value = writeThemeConcept(id);
      setThemeConceptState(value);
      syncThemeConceptToDom(value);
      pushToServer({ preferences: { ui_concept: value } });
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
        // The whole design, and the palette of the guild skin.
        appTheme,
        palette,
        setAppTheme: changeAppTheme,
        cycleAppTheme,
        setPalette: changePalette,
        // The visual concept of the app.
        themeConcept,
        setThemeConcept: changeThemeConcept,
        revision,
        syncFromServer,
        // Legacy aliases kept so existing call sites keep working.
        //
        // `themeMode` is the user's CHOICE ('light' | 'dark' |
        // 'system'), not the resolved theme. It used to be the resolved
        // one, which meant a control that highlights by it could never
        // show "system" as chosen - the option looked broken - and the
        // header's cycle had nothing to cycle back to.
        themeMode: mode,
        setThemeMode: setTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

export default ThemeProvider;
