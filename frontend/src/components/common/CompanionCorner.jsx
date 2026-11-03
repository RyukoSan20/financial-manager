import { useLocation } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import { batch10 } from '../../i18n/keys_batch10';
import MascotCompanion from './MascotCompanion';
import { readerFlag } from '../../utils/featureFlags';
import { useReaderFlags } from '../../utils/useReaderFlags';

/**
 * The companion, in the corner of the page.
 *
 * The companion changes its face to suit the page it is on. In the
 * shop it wears an apron, because that is where the till is. When a
 * receipt is being read it puts on its glasses, because that is
 * reading. On a page about money it is simply pleased.
 *
 * It stays out of the way: it is small, it sits in the corner, and
 * it says one thing. A companion that talks too much is noise.
 */

/**
 * The mood and the words for each kind of page.
 *
 * The path is matched first, exactly. Then by the first part of the
 * path, so that `/merchant/3` gets the same face as `/merchant`.
 */
const FACES = [
  {
    match: (path) => path.startsWith('/merchant') || path.startsWith('/catalog'),
    mood: 'shopkeeper',
    messageKey: 'moe.shopkeeper',
  },
  {
    match: (path) => path.startsWith('/shopping') || path.startsWith('/kanban'),
    mood: 'shopkeeper',
    messageKey: 'moe.shopkeeper',
  },
  {
    match: (path) => path.startsWith('/feed') || path.startsWith('/scan'),
    mood: 'detective',
    messageKey: 'moe.detective',
  },
  {
    match: (path) => path.startsWith('/calculators') || path.startsWith('/merchant/tax'),
    mood: 'detective',
    messageKey: 'moe.detective',
  },
  {
    match: (path) => path.startsWith('/health-coach'),
    mood: 'worried',
    messageKey: 'moe.worried',
  },
  {
    match: (path) => path.startsWith('/budgets'),
    mood: 'happy',
    messageKey: 'moe.happy',
  },
];

const DEFAULT_FACE = { mood: 'happy', messageKey: 'moe.hello' };

export default function CompanionCorner() {
  const location = useLocation();
  const { language } = useTranslation();
  const K = batch10[language]?.moe || batch10.id.moe;

  // The companion is a new thing on an old screen, so it waits for
  // the reader to ask for it. The hook is what makes it appear the
  // moment the switch is turned on, rather than at the next load.
  useReaderFlags();
  if (!readerFlag('MASCOT_COMPANION')) return null;

  const face = FACES.find((entry) => entry.match(location.pathname)) || DEFAULT_FACE;

  // The words are looked up here rather than passed through the
  // translator, so that the three languages stay in step.
  const words = K[face.messageKey.replace('moe.', '')] || K.hello;

  return (
    <div className="moe-corner" aria-live="polite">
      <MascotCompanion mood={face.mood} size={52} message={words} title={K.title} />
    </div>
  );
}
