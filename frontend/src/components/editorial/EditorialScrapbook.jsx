/**
 * The scrapbook.
 *
 * The sign-in page is a scrapbook: three photographs taped into it at
 * slightly different angles, the way a page of a paper journal is
 * put together rather than the way a grid is.
 *
 * The pieces are ordinary CSS. What makes it read as a scrapbook
 * rather than as three tilted rectangles is that each one is a
 * POLAROID - a photograph with a wide white border and a caption
 * written on it - and that each is held by a piece of masking tape
 * that sits over the top edge, slightly off-square, translucent, and
 * a different colour on each.
 *
 * The photographs are ours to bundle and are cropped with object-fit
 * rather than being scaled, so the frames stay the same size whatever
 * the photograph is.
 */

import { clsx } from 'clsx';
import { useTranslation } from '../../i18n';
import batch3 from '../../i18n/keys_batch3';
// The photographs are imported as modules rather than referenced by
// path. Vite then hashes them into dist/assets/ alongside the code,
// so the server serves them with a content type it recognises and
// with a name that cannot collide with anything else.
import snap1Url from '../../assets/editorial/snap-1.jpg';
import snap2Url from '../../assets/editorial/snap-2.jpg';
import snap3Url from '../../assets/editorial/snap-3.jpg';
import { editorialFallback } from './editorialFallback.js';

/** The three frames, and how each one is put down. */
const SNAPS = [
  {
    id: 'snap-1',
    src: snap1Url,
    alt: 'Dua cangkir kopi di atas meja kayu',
    caption: 'Snap #01 · Patungan Kopi & Matcha bareng sahabat',
    tilt: '-rotate-2',
    tape: 'bg-[#FDE8E4]',
    badge: '✦',
    badgeClass: 'bg-[#FFF6D6] text-[#9E3B24]',
    offset: 'md:translate-y-3',
  },
  {
    id: 'snap-2',
    src: snap2Url,
    alt: 'Kafe hangat di cangkir keramik',
    caption: 'Snap #02 · Kakeibo akhir bulan tanpa pusing',
    tilt: 'rotate-[1.5deg]',
    tape: 'bg-[#E3F2EA]',
    badge: '✿',
    badgeClass: 'bg-[#FDE8E4] text-[#9E3B24]',
    offset: '',
  },
  {
    id: 'snap-3',
    src: snap3Url,
    alt: 'Catatan danStationery di meja',
    caption: 'Snap #03 · Satu buku kas untuk dua orang',
    tilt: 'rotate-[-1deg]',
    tape: 'bg-[#FFF6D6]',
    badge: '✧',
    badgeClass: 'bg-[#EDE7F6] text-[#5B4B8A]',
    offset: 'md:translate-y-5',
  },
];

export default function EditorialScrapbook({ className = '' }) {
  const { language } = useTranslation();
  // These words live in the batch files, which are read directly
  // rather than through `t()`: the batches are not merged into the
  // main dictionary, so a `t('login_gateway....')` would never find
  // them.
  const W = batch3[language]?.login_gateway || batch3.id.login_gateway;

  return (
    <div
      className={clsx('editorial-scrapbook grid grid-cols-1 sm:grid-cols-3 gap-5', className)}
      data-testid="editorial-scrapbook"
    >
      {SNAPS.map((snap) => (
        <figure
          key={snap.id}
          className={clsx(
            // The polaroid: a white card with a wide bottom edge for
            // the caption, and the whole thing turned a little.
            'editorial-snap relative rounded-[10px] bg-white p-2.5 pb-3',
            'shadow-[0_10px_24px_-12px_rgba(44,34,30,0.35)]',
            snap.tilt,
            snap.offset,
            'transition-transform duration-300 hover:rotate-0 hover:-translate-y-1'
          )}
          data-testid={`editorial-snap-${snap.id}`}
        >
          {/* The masking tape, over the top edge and a little off
              square, as it always is. */}
          <span
            className={clsx(
              'absolute -top-2.5 left-1/2 h-6 w-20 -translate-x-1/2 -rotate-2',
              'opacity-80 mix-blend-multiply',
              snap.tape
            )}
            aria-hidden="true"
          />
          {/* The photograph, cropped to a square so the three frames
              are the same shape whatever the picture is. */}
          <span className="block aspect-square overflow-hidden rounded-[4px] bg-[#F0EAE0]">
            <img
              src={snap.src}
              alt={snap.alt}
              loading="lazy"
              className="h-full w-full object-cover"
              // If the photograph cannot be fetched, the frame shows
              // an illustrated scene of the same subject rather than
              // an empty white rectangle.
              onError={(event) => {
                const fallback = editorialFallback(SNAPS.indexOf(snap));
                if (event.currentTarget.src !== fallback) {
                  event.currentTarget.src = fallback;
                }
              }}
            />
          </span>
          {/* The caption, written on the frame. */}
          <figcaption className="mt-2.5 px-1 text-[11px] font-semibold leading-snug text-[#5C6460]">
            {snap.caption}
          </figcaption>
          {/* The Memphis badge, pinned in the corner. */}
          <span
            className={clsx(
              'absolute -right-2 -bottom-2 flex h-8 w-8 items-center justify-center',
              'rounded-full text-sm shadow-sm ring-2 ring-white',
              snap.badgeClass
            )}
            aria-hidden="true"
          >
            {snap.badge}
          </span>
        </figure>
      ))}

      <p className="editorial-scrapbook__note col-span-full text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9E3B24]">
        {W.snapbook_note}
      </p>
    </div>
  );
}

export { SNAPS };
