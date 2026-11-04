/**
 * The wash behind the content.
 *
 * A page on a flat colour is a page with nothing behind it. The
 * content sits on a surface, and the surface sits on nothing, and the
 * eye reads the whole thing as a sheet of paper in a room with no
 * light in it.
 *
 * This is the light. Four soft blobs of colour, in the hues of the
 * application, drifting very slowly behind the page. They are behind
 * everything and they never take a click. They are decoration, and
 * they are honest decoration: they say nothing about the numbers, and
 * they never move enough to be read as an animation.
 *
 * The reader can turn them off with reduced motion, and they are not
 * drawn at all when the aurora layer is off, so a build without the
 * layer has exactly the bytes it had before.
 */

import { clsx } from 'clsx';
import { auroraIsOn } from '../ui/AuroraCard';

/**
 * The blobs.
 *
 * Written out rather than built at runtime, so the colours are in the
 * stylesheet where a reader of the stylesheet can find them.
 */
const BLOBS = [
  { className: 'aurora-blob--one' },
  { className: 'aurora-blob--two' },
  { className: 'aurora-blob--three' },
  { className: 'aurora-blob--four' },
];

/**
 * The background behind a page.
 *
 * When the aurora layer is off, this renders nothing at all - not an
 * empty div, not a hidden div. Nothing, so there is nothing to
 * measure and nothing to paint.
 */
export const AuroraBackground = ({ className }) => {
  if (!auroraIsOn()) return null;

  return (
    <div
      aria-hidden="true"
      className={clsx('aurora-background', className)}
    >
      {BLOBS.map((blob, i) => (
        <span key={i} className={clsx('aurora-blob', blob.className)} />
      ))}
    </div>
  );
};

export default AuroraBackground;
