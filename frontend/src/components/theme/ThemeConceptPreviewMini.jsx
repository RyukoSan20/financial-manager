/*
 * The little drawing of a concept.
 *
 * Every concept card in the picker shows what the concept looks like: a
 * card with its own border and shadow, a badge in its own colour, and the
 * companion standing next to it. The drawing is made of ordinary boxes
 * and the real chibi artwork, and every colour comes from the concept
 * itself - so what the reader sees here is the real thing, not a picture
 * of it.
 *
 * The drawing is fixed in size and never reflows: a switch of concept
 * must not move a button the reader was about to press, so the mockup
 * has the same box in all six.
 */

import { THEME_CONCEPTS } from '../../utils/theme';

/** The picture of the companion for a concept. */
const mascotFor = (persona) => `/koban-assets/chara/${persona}.png`;

/**
 * A miniature of one concept.
 *
 * Props:
 *   id        the concept id
 *   className extra classes for the box
 */
export default function ThemeConceptPreviewMini({ id, className = '' }) {
  const concept = THEME_CONCEPTS[id];
  if (!concept) return null;

  return (
    <div
      className={`concept-mini ${className}`.trim()}
      data-concept-mini={id}
      aria-hidden="true"
    >
      {/* the card, with the border and the shadow of the concept */}
      <div className="concept-mini__card" />
      {/* two lines of writing on it */}
      <span className="concept-mini__bar" style={{ width: '38%' }} />
      <span className="concept-mini__bar concept-mini__bar--short" />
      {/* the badge */}
      <span className="concept-mini__badge">
        {concept.palette[3].replace('#', '').slice(0, 3)}
      </span>
      {/* the companion */}
      <img
        className="concept-mini__mascot"
        src={mascotFor(concept.persona)}
        alt=""
        loading="lazy"
        draggable="false"
      />
    </div>
  );
}

export { ThemeConceptPreviewMini };
