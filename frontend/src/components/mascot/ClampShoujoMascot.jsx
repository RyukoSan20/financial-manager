/**
 * The shoujo companion.
 *
 * A semi-chibi character in the 2000s retro shoujo manner, drawn as
 * layered vector art rather than a sprite: two and a half heads tall,
 * eyes built in seven layers, and a white die-cut border around the
 * whole figure so it sits on a card like a sticker.
 *
 * There are two of them, and the reader chooses which one keeps them
 * company. The choice is remembered, because a companion the reader
 * picked and then had to pick again on the next page is not a
 * companion.
 *
 * It does five things at once, each on its own channel so they do not
 * fight: it breathes, its hair moves a beat behind the breath, it
 * blinks twice every few seconds, it can stroll along the bottom of a
 * card, and it stops and springs when it is greeted.
 *
 * Clicking it opens a board where it can be asked a real question.
 * The question goes to the same agent the rest of the app uses, so the
 * answer is about the reader's own money rather than a canned line.
 *
 * The drawing itself is in `shoujoArtLayers.jsx`.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { KakeiboHoverBoard } from '../ui/KakeiboHoverBoard';
import { useTranslation } from '../../i18n';
import api from '../../services/api';
import {
  ANATOMY,
  PALETTES,
  ShoujoDefs,
  ShoujoSparkles,
  renderAnimeEmote,
  renderBishounen,
  renderKobato,
  renderPetitPersona,
} from './shoujoArtLayers.jsx';
import {
  DEFAULT_PETIT_PERSONA,
  PETIT_CHIBI_CAST,
  PETIT_PERSONA_IDS,
  getPetitPersona,
  petitText,
} from './petitChibiCast.js';

/** Where the choice of companion is remembered. */
export const PERSONA_KEY = 'fm.mascot.persona';

/**
 * The two original drawings, kept by name.
 *
 * They were the whole cast before the guild existed, and pages and
 * tests still ask for them, so "kobato" and "bishounen" keep
 * working and keep their own renderers.
 */
export const PERSONAS = ['kobato', 'bishounen'];

/**
 * "auto" means: show whoever specialises in the page the reader is
 * on. It is the interesting setting, and it is what the dock offers
 * alongside the six of them.
 */
export const AUTO_PERSONA = 'auto';

const BLINK_EVERY_MS = 3800;
const BLINK_HOLD_MS = 140;
// The second blink of the pair, shortly after the first.
const DOUBLE_BLINK_GAP_MS = 220;

/** The companion the reader last chose, if the browser remembers one. */
export function readStoredPersona() {
  try {
    const held = window.localStorage.getItem(PERSONA_KEY);
    if (held === AUTO_PERSONA) return held;
    if (PERSONAS.includes(held)) return held;
    if (held && PETIT_CHIBI_CAST[held]) return held;
    return AUTO_PERSONA;
  } catch {
    // A browser that refuses storage still gets a companion.
    return AUTO_PERSONA;
  }
}

export default function ClampShoujoMascot({
  // Which companion. When it is not given, the one the reader chose.
  persona: personaProp,
  // `idle`, `happy`, `celebrate` or `alert` - the same four moods the
  // rest of the app's mascots take.
  mood = 'idle',
  size = 120,
  label = 'Maskot',
  className = '',
  // A companion that strolls along the bottom of a card. Off by
  // default: a character walking about on every page would be noise.
  roaming = false,
  // Whether the reader can ask it things. The board is the point of
  // the character, but a decorative one in a corner should not open a
  // chat.
  interactive = true,
  // Let a page force the board open (the hover state of a card).
  hovering = false,
  onClick,
  // What it should say instead of its own greeting.
  said = '',
  tip = '',
}) {
  const { t, language } = useTranslation();
  const uid = useId().replace(/:/g, '');

  const [stored, setStored] = useState(() => readStoredPersona());
  const choice = personaProp || stored;

  // Which of the three kinds of companion this is.
  //
  // "kobato"/"bishounen" are the two original drawings and keep their
  // own renderers. Anything else is one of the guild, either named
  // outright or decided by the page when the reader chose "auto".
  const isLegacy = PERSONAS.includes(choice);
  // The page the reader is on, when there is one. Rendered on a
  // server there is a `window` but no `location` on it, so testing
  // for `window` alone is not enough - that threw and took the whole
  // page down with it.
  const currentPath =
    (typeof window !== 'undefined' && window.location && window.location.pathname) || '/';

  const petit = isLegacy
    ? null
    : getPetitPersona(choice === AUTO_PERSONA ? currentPath : choice);

  const persona = isLegacy ? choice : petit.id;
  const palette = isLegacy
    ? PALETTES[choice] || PALETTES.kobato
    : petit.palette;

  const [blinking, setBlinking] = useState(false);
  const [greeted, setGreeted] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  // The squash-and-stretch, played on a click or a change of
  // companion. It is a one-shot class, so it has to be taken off
  // again or it will never play a second time.
  const [bounced, setBounced] = useState(false);

  // The conversation. `answer` is what the character is saying now.
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState('');

  const timers = useRef({});
  const later = useCallback((name, fn, ms) => {
    clearTimeout(timers.current[name]);
    timers.current[name] = setTimeout(fn, ms);
  }, []);

  useEffect(() => {
    const held = timers.current;
    return () => Object.values(held).forEach(clearTimeout);
  }, []);

  // The double blink: closed, open, closed again, then a long pause.
  useEffect(() => {
    const tick = () => {
      setBlinking(true);
      later('b1', () => {
        setBlinking(false);
        later('b2', () => {
          setBlinking(true);
          later('b3', () => setBlinking(false), BLINK_HOLD_MS);
        }, DOUBLE_BLINK_GAP_MS);
      }, BLINK_HOLD_MS);
      later('next', tick, BLINK_EVERY_MS);
    };
    const first = setTimeout(tick, BLINK_EVERY_MS);
    return () => clearTimeout(first);
  }, [later]);

  const choosePersona = useCallback((next) => {
    setStored(next);
    setBounced(true);
    later('poyo', () => setBounced(false), 520);
    try {
      window.localStorage.setItem(PERSONA_KEY, next);
    } catch {
      // A browser that refuses storage still gets to switch; it just
      // will not be remembered.
    }
  }, [later]);

  // Greeting it stops the walk, springs it, and bursts the sparkles.
  const greet = useCallback(() => {
    setGreeted(true);
    setBounced(true);
    later('greet', () => setGreeted(false), 620);
    later('poyo', () => setBounced(false), 520);
  }, [later]);

  const handleClick = useCallback(() => {
    greet();
    if (interactive) setBoardOpen((open) => !open);
    onClick?.();
  }, [greet, interactive, onClick]);

  // A real question, answered by the same agent the app uses.
  const ask = useCallback(async (text) => {
    const message = String(text || '').trim();
    if (!message || asking) return;
    setAsking(true);
    setAskError('');
    setAnswer('');
    try {
      const res = await api.ai.agent(message, true, []);
      const reply =
        res?.reply || res?.message || res?.answer || res?.summary || '';
      setAnswer(reply || t('shoujo.no_answer', 'Aku belum punya jawaban untuk itu.'));
    } catch (err) {
      setAskError(err?.message || t('shoujo.ask_failed', 'Gagal bertanya. Coba lagi.'));
    } finally {
      setAsking(false);
    }
  }, [asking, t]);

  const quickChips = useMemo(
    () => [
      { key: 'analyse', label: t('shoujo.chip_analyse', '✨ Analisis uangku hari ini') },
      { key: 'snack', label: t('shoujo.chip_snack', '🍵 Aman jajan Rp 35rb?') },
      { key: 'record', label: t('shoujo.chip_record', '📒 Bantu catat pengeluaran') },
    ],
    [t]
  );

  const name = petit
    ? petit.name
    : persona === 'kobato'
    ? t('shoujo.name_kobato', 'Kobato')
    : t('shoujo.name_bishounen', 'Tsukasa');

  // The character's own words, in the reader's language. These live on
  // the character rather than in the i18n files: a translator who
  // changes "wealth that keeps growing" is changing who Mone is.
  const kanji = petit?.kanji || '';
  const tagline = petit ? petitText(petit, 'tagline', language) : '';
  const bio = petit ? petitText(petit, 'bio', language) : '';
  const meaning = petit ? petitText(petit, 'meaning', language) : '';

  const showBoard = interactive && (hovering || boardOpen);
  const spoken = answer || said || tip;

  return (
    <span
      className={clsx('shoujo-root relative inline-block', className)}
      data-shoujo-persona={persona}
      data-shoujo-mood={mood}
    >
      <button
        type="button"
        className={clsx(
          'shoujo-button',
          roaming && 'shoujo-roaming-walker petit-totoko-walk',
          bounced && 'petit-poyo-bounce',
          (paused || greeted || showBoard) && 'is-paused',
          greeted && 'is-greeted'
        )}
        onClick={handleClick}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        aria-label={label}
        aria-expanded={interactive ? showBoard : undefined}
        data-testid="shoujo-mascot-button"
      >
        <svg
          viewBox="0 0 200 260"
          width={size}
          height={(size * 260) / 200}
          role="img"
          aria-label={label}
          className="shoujo-figure"
          data-testid="shoujo-mascot-svg"
        >
          <ShoujoDefs uid={uid} palette={palette} />

          {/* Everything inside the sticker filter, so the white border
              follows the silhouette of the whole character rather
              than each part of it. */}
          <g filter={`url(#${uid}-sticker)`}>
            <g className="shoujo-rig-body">
              {petit
                ? renderPetitPersona(petit, uid, mood)
                : persona === 'bishounen'
                ? renderBishounen(palette, uid, mood)
                : renderKobato(palette, uid, mood)}

              {/* The blink is drawn over the open eye rather than
                  replacing it inside the persona, so a blink does not
                  rebuild the entire figure. */}
              {blinking ? (
                <g data-part="blink-cover">
                  <ellipse cx={ANATOMY.eyes.leftCx} cy={ANATOMY.eyes.cy} rx="11" ry="13" fill={palette.skin} />
                  <ellipse cx={ANATOMY.eyes.rightCx} cy={ANATOMY.eyes.cy} rx="11" ry="13" fill={palette.skin} />
                  {[ANATOMY.eyes.leftCx, ANATOMY.eyes.rightCx].map((cx) => (
                    <path
                      key={cx}
                      d={`M ${cx - 9} ${ANATOMY.eyes.cy} Q ${cx} ${ANATOMY.eyes.cy + 7} ${cx + 9} ${ANATOMY.eyes.cy}`}
                      fill="none"
                      stroke="#3A222C"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                    />
                  ))}
                </g>
              ) : null}
            </g>

            {(greeted || mood === 'happy' || mood === 'celebrate') ? <ShoujoSparkles /> : null}

            {/* The 2000s reaction symbol, above-right of the head. */}
            {renderAnimeEmote(mood)}
          </g>
        </svg>
      </button>

      {showBoard ? (
        <KakeiboHoverBoard
          title={name}
          subtitle={spoken || t('shoujo.greeting', 'Ada yang mau ditanyakan soal uangmu?')}
          badge={t('shoujo.badge', 'KAKEIBO')}
          position="top"
          visible
          className="shoujo-board"
        >
          <div className="shoujo-board-body" data-testid="shoujo-board">
            {/* Who is keeping the reader company, and what their name
                means. The kanji is shown because the joke IS the
                kanji - Mone is a sprout and a sound. */}
            {petit ? (
              <div className="shoujo-petit-header" data-testid="shoujo-petit-header">
                <span className="shoujo-petit-name">
                  {petit.name}
                  {kanji ? <span className="shoujo-petit-kanji">{kanji}</span> : null}
                </span>
                {tagline ? <span className="shoujo-petit-tagline">{tagline}</span> : null}
                {bio ? <span className="shoujo-petit-bio">{bio}</span> : null}
                {meaning ? (
                  <span className="shoujo-petit-meaning" title={meaning}>
                    {meaning}
                  </span>
                ) : null}
              </div>
            ) : null}

            {/* The guild, as six portraits, plus "whoever belongs to
                this page". */}
            <div
              className="shoujo-petit-dock"
              role="group"
              aria-label={t('shoujo.switch', 'Ganti teman')}
              data-testid="shoujo-petit-dock"
            >
              <button
                type="button"
                onClick={() => choosePersona(AUTO_PERSONA)}
                aria-pressed={stored === AUTO_PERSONA}
                className={clsx('shoujo-petit-portrait is-auto', stored === AUTO_PERSONA && 'is-active')}
                title={t('shoujo.auto_hint', 'Sesuaikan dengan halaman')}
                data-testid="shoujo-persona-auto"
              >
                <span aria-hidden="true">✦</span>
                <span className="shoujo-petit-portrait-name">
                  {t('shoujo.auto', 'Auto')}
                </span>
              </button>
              {PETIT_PERSONA_IDS.map((id) => {
                const member = PETIT_CHIBI_CAST[id];
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => choosePersona(id)}
                    aria-pressed={stored === id}
                    className={clsx('shoujo-petit-portrait', stored === id && 'is-active')}
                    title={`${member.name} (${member.kanji})`}
                    data-testid={`shoujo-persona-${id}`}
                  >
                    {/* A portrait, not a photograph: the head and the
                        hair colour of the character themselves. */}
                    <svg viewBox="0 0 48 48" aria-hidden="true" className="shoujo-petit-portrait-art">
                      <circle cx="24" cy="24" r="22" fill={member.palette.cloth} />
                      <path
                        d="M 24 8 C 36 8 42 16 41 24 C 40 33 33 40 24 40 C 15 40 8 33 7 24 C 6 16 12 8 24 8 Z"
                        fill={member.palette.skin}
                        stroke={member.palette.hairDark}
                        strokeWidth="1.4"
                      />
                      <path
                        d="M 24 7 C 12 7 6 16 7 25 C 11 18 16 15 22 15 C 30 15 38 18 41 25 C 42 16 36 7 24 7 Z"
                        fill={member.palette.hairDark}
                      />
                      <circle cx="17" cy="26" r="3.4" fill={member.palette.irisMid} />
                      <circle cx="31" cy="26" r="3.4" fill={member.palette.irisMid} />
                      <circle cx="16" cy="25" r="1.2" fill="#FFFFFF" />
                      <circle cx="30" cy="25" r="1.2" fill="#FFFFFF" />
                    </svg>
                    <span className="shoujo-petit-portrait-name">{member.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Three things worth asking, one tap each. */}
            <div className="shoujo-chips">
              {quickChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className="shoujo-chip"
                  onClick={() => ask(chip.label)}
                  disabled={asking}
                  data-testid={`shoujo-chip-${chip.key}`}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Or anything else, in the reader's own words. */}
            <form
              className="shoujo-ask"
              onSubmit={(e) => {
                e.preventDefault();
                ask(question);
                setQuestion('');
              }}
            >
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={t('shoujo.ask_placeholder', 'Tanya apa saja...')}
                aria-label={t('shoujo.ask_placeholder', 'Tanya apa saja...')}
                className="shoujo-ask-input"
                data-testid="shoujo-ask-input"
              />
              <button
                type="submit"
                className="shoujo-ask-send"
                disabled={asking || !question.trim()}
                data-testid="shoujo-ask-send"
              >
                {asking ? t('shoujo.asking', '...') : t('shoujo.send', 'Tanya')}
              </button>
            </form>

            {askError ? (
              <p className="shoujo-ask-error" role="alert" data-testid="shoujo-ask-error">
                {askError}
              </p>
            ) : null}
          </div>
        </KakeiboHoverBoard>
      ) : null}
    </span>
  );
}

export { ClampShoujoMascot };
