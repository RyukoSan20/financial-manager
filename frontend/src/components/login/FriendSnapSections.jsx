/**
 * The friend-snap lookbook and the guild parade.
 *
 * The lookbook is the tabio FriendSnap page's idea: three photographs
 * that are not illustrations of the product but portraits of the
 * people who would use it, each tilted, taped, numbered, and tagged
 * with the feature it quietly demonstrates.
 *
 * The parade is the six companions standing in a row. Tapping one
 * makes it jump and say its own line - the cheapest possible way to
 * introduce six characters without six paragraphs of text.
 */

import { useState } from 'react';
import { clsx } from 'clsx';
import { useTranslation } from '../../i18n';
import ClampShoujoMascot from '../mascot/ClampShoujoMascot';
import { PETIT_CHIBI_CAST, PETIT_PERSONA_IDS, petitText } from '../mascot/petitChibiCast';
import { CampusHeading, MemphisBeads, PolaroidSnap } from './CampusKit.jsx';
import { campusCopy } from './campusCopy.js';
import snap1Url from '../../assets/editorial/snap-1.jpg';
import snap2Url from '../../assets/editorial/snap-2.jpg';
import snap3Url from '../../assets/editorial/snap-3.jpg';

const STORIES = [
  {
    id: 'snap-1',
    src: snap1Url,
    index: 0,
    number: 'SNAP 01',
    alt: 'Dua cangkir kopi di atas meja kayu',
    caption: 'Patungan kopi & kue, dibagi rata sampai rupiah terakhir.',
    tags: ['#SplitBill'],
    tilt: '-rotate-2',
    tape: 'bg-[#FDE8E4]',
    offset: 'sm:translate-y-0',
  },
  {
    id: 'snap-2',
    src: snap2Url,
    index: 1,
    number: 'SNAP 02',
    alt: 'Kafe hangat di cangkir keramik',
    caption: 'Satu buku kas untuk dua orang di rumah yang sama.',
    tags: ['#PasanganHousehold'],
    tilt: 'rotate-[1.5deg]',
    tape: 'bg-[#E3F2EA]',
    offset: 'sm:translate-y-6',
  },
  {
    id: 'snap-3',
    src: snap3Url,
    index: 2,
    number: 'SNAP 03',
    alt: 'Catatan dan alat tulis di meja',
    caption: 'Foto struknya, biarkan AI yang membaca angkanya.',
    tags: ['#ScanStrukAI'],
    tilt: 'rotate-[-1deg]',
    tape: 'bg-[#FFF6D6]',
    offset: 'sm:translate-y-2',
  },
];

/** Section three: the lookbook. */
export function FriendSnapLookbook({ className = '' }) {
  const { language } = useTranslation();
  const C = campusCopy(language);

  return (
    <section
      id="CeritaTeman"
      className={clsx('campus-section relative overflow-visible bg-[#E6F3EC] px-4 py-10 sm:py-14', className)}
      data-testid="friendsnap-lookbook"
    >
      <MemphisBeads seed={1} />
      <div className="relative mx-auto max-w-6xl">
        <CampusHeading badge={C.story_badge} title={C.story_title} lead={C.story_lead} />
        <div className="mt-6 grid grid-cols-1 gap-5 pt-2 sm:grid-cols-3">
          {STORIES.map((story) => (
            <PolaroidSnap
              key={story.id}
              src={story.src}
              index={story.index}
              alt={story.alt}
              number={story.number}
              caption={story.caption}
              tags={story.tags}
              tilt={story.tilt}
              tape={story.tape}
              className={story.offset}
              testId={`story-${story.id}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/** The six, in a row, each one tappable. */
export function PetitGuildParade({ className = '' }) {
  const { language } = useTranslation();
  const C = campusCopy(language);
  const [jumping, setJumping] = useState(null);
  const [speaking, setSpeaking] = useState(null);

  const poke = (id) => {
    setJumping(id);
    setSpeaking(id);
    window.setTimeout(() => setJumping((current) => (current === id ? null : current)), 650);
  };

  return (
    <div className={clsx('petit-parade', className)} data-testid="petit-guild-parade">
      <CampusHeading badge={C.cast_badge} title={C.cast_title} lead={C.cast_lead} />
      <div className="mt-5 grid grid-cols-2 gap-3 pt-2 sm:grid-cols-3 lg:grid-cols-6">
        {PETIT_PERSONA_IDS.map((id) => {
          const persona = PETIT_CHIBI_CAST[id];
          const isSpeaking = speaking === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => poke(id)}
              data-testid={`parade-${id}`}
              className={clsx(
                'parade-card flex flex-col items-center overflow-visible rounded-[20px]',
                'border-2 border-[#4A3540] bg-white px-2 pb-3 pt-5 text-center',
                'shadow-[0_5px_0_#DFD3C3] transition-transform active:scale-95',
                jumping === id && 'petit-poyo-bounce'
              )}
            >
              <ClampShoujoMascot
                persona={id}
                size={72}
                mood={isSpeaking ? 'happy' : 'idle'}
                interactive={false}
                label={persona.name}
              />
              <span className="mt-1.5 text-[12px] font-extrabold text-[#2C221E]">
                {persona.name}
              </span>
              <span className="text-[9.5px] font-semibold leading-tight text-[#8A7F72]">
                {petitText(persona, 'tagline', language)}
              </span>
              {isSpeaking ? (
                <span
                  className="parade-say mt-1.5 rounded-xl border border-[#4A3540]/25 bg-[#FFF6D6] px-2 py-1 text-[9.5px] font-semibold leading-snug text-[#4A3540]"
                  data-testid={`parade-say-${id}`}
                >
                  {petitText(persona, 'bio', language)}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default FriendSnapLookbook;
