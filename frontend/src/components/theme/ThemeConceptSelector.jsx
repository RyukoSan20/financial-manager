/**
 * The concept picker.
 *
 * Six concepts, and the reader picks one. The picker is the front of the
 * concept engine: it shows what each concept looks like (a miniature drawn
 * in the concept's own colours, with the companion standing next to it),
 * and it applies the choice to the whole app the moment it is made.
 *
 * The MODE and the ACCENT are not here. They stay in the appearance page,
 * below the grid, and they keep working on top of whichever concept is
 * active - a concept says what the app looks like, the mode says which
 * side of it is showing, and the accent says what colour the buttons are.
 *
 * The geometry never changes: the grid is one column on a phone, two on a
 * tablet and three on a desktop, in every concept, so switching concept
 * never moves a button the reader was about to press.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { THEME_CONCEPTS, THEME_CONCEPT_IDS, conceptTokenStyle } from '../../utils/theme';
import ThemeConceptPreviewMini from './ThemeConceptPreviewMini';
import PixelArtBusinessIcon from '../ui/PixelArtBusinessIcon';
import DraggableSparkleMascot from '../mascot/DraggableSparkleMascot';
import { useTranslation } from '../../i18n';

/**
 * How the companion reacts to a concept.
 *
 * The figure is the same cast in all six - it is the app's own artwork -
 * but it wears the mood of the concept: it thinks over the reports of the
 * ledger, it sweats over the neon one, and it is pleased with itself in
 * the arcade.
 */
export const CONCEPT_MOOD = {
  kawaii_bento: 'happy',
  medieval_fantasy: 'thinking',
  cyberpunk: 'alert',
  corporate: 'thinking',
  retro_8bit: 'celebrate',
  cute_sankou: 'happy',
};

/**
 * One concept card.
 *
 * The whole card is the button: the miniature, the name, the tag, the
 * description, the palette and the action all belong to one choice, so
 * there is one target to press and not five.
 *
 * The card carries its own concept's tokens as inline custom properties,
 * so it is drawn in the concept it stands for - even though the page
 * around it is in the active one.
 */
const ConceptCard = ({ id, active, onSelect, t, isDark }) => {
  const concept = THEME_CONCEPTS[id];
  if (!concept) return null;

  return (
    <button
      type="button"
      className="concept-card"
      style={conceptTokenStyle(id, isDark)}
      onClick={() => onSelect(id)}
      aria-pressed={active}
      data-testid={`concept-${id}`}
      data-concept-id={id}
    >
      <ThemeConceptPreviewMini id={id} />

      <div className="flex items-start gap-2 min-w-0">
        <span className="shrink-0 mt-0.5">
          <PixelArtBusinessIcon name={concept.iconName} size={26} badge={false} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold leading-tight">
            {t(concept.labelKey)}
          </span>
          <span
            className="concept-tag-pill mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide"
          >
            {t(concept.tagKey)}
          </span>
        </span>
      </div>

      <p className="text-[12px] leading-snug opacity-80 m-0">
        {t(concept.descriptionKey)}
      </p>

      <div className="flex items-center justify-between gap-2 mt-auto">
        <span className="concept-dots" aria-hidden="true">
          {concept.palette.map((colour, index) => (
            <i key={`${id}-${index}`} style={{ backgroundColor: colour }} />
          ))}
        </span>
        <span
          className={clsx(
            active ? 'concept-active-pill' : 'concept-idle-pill'
          )}
          style={active ? { backgroundColor: 'var(--concept-accent)', color: 'var(--concept-accent-ink)' } : undefined}
          data-testid={`concept-action-${id}`}
        >
          {active ? t('appearance.concept_active') : t('appearance.concept_choose')}
        </span>
      </div>
    </button>
  );
};

/**
 * The picker.
 *
 * Props:
 *   concept   the concept that is active
 *   onSelect  called with the id of the concept the reader picked
 */
export default function ThemeConceptSelector({ concept, onSelect, isDark = false }) {
  const { t } = useTranslation();
  const [celebrateSignal, setCelebrateSignal] = useState(0);

  const choose = useCallback(
    (id) => {
      // The concept is applied by the caller - which is what saves it -
      // and the companion lets go in a shower of sparkles, because a new
      // look is worth a small celebration.
      setCelebrateSignal((n) => n + 1);
      onSelect?.(id);
    },
    [onSelect]
  );

  const active = THEME_CONCEPTS[concept] || THEME_CONCEPTS[THEME_CONCEPT_IDS[0]];

  // The celebration is asked for AFTER the new figure is on the page, not
  // before.
  //
  // The reason is the order of things. When the concept changes, the
  // figure is swapped for a new persona, and React throws the old one
  // away and mounts a new one. A celebration asked for at the moment of
  // the click is heard by the OLD figure, which is about to be
  // unmounted - so the confetti it threw away goes with it.
  //
  // So the ask is made in an effect, which runs after the new figure is
  // mounted and has put its ear up. React runs the child's effects
  // before the parent's, so by the time this runs the new figure is
  // listening.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    window.dispatchEvent(new CustomEvent('koban:celebrate'));
  }, [active.id]);

  return (
    <div className="concept-selector" data-testid="concept-picker">
      <div className="concept-grid">
        {THEME_CONCEPT_IDS.map((id) => (
          <ConceptCard
            key={id}
            id={id}
            active={concept === id}
            onSelect={choose}
            t={t}
            isDark={isDark}
          />
        ))}
      </div>

      {/* The companion. It is the app's own chibi, it can be picked up and
          dragged, and it lets go in a shower of sparkles. Its mood follows
          the concept, and the line it says belongs to the concept too. */}
      <div className="concept-stage concept-mascot-stage mt-3" data-testid="concept-mascot-zone">
        <span className="shrink-0">
          <DraggableSparkleMascot
            persona={active.persona}
            mood={CONCEPT_MOOD[concept] || 'happy'}
            size={92}
            draggable
            hint={t('appearance.concept_mascot_hint')}
            label={t('appearance.concept_mascot')}
            // A new concept is a small celebration: the companion lets go
            // of a shower of sparkles and confetti.
            celebrateSignal={celebrateSignal}
            data-testid="concept-mascot"
          />
        </span>
        <span className="concept-stage__body">
          <span className="concept-bubble block">
            {t(active.lineKey)}
          </span>
          <span className="block mt-1 text-[11px] opacity-70">
            {t('appearance.concept_mascot_hint')}
          </span>
        </span>
      </div>
    </div>
  );
}

export { ThemeConceptSelector };
