/**
 * The overworld sprite: a 64x96 vector chibi, in three drawn views.
 *
 * This is the figure that walks the shop floor, stands in a workshop
 * and fights in the side-view battle. It is drawn here, as shapes - a
 * head, a body, two arms, two legs - because it has to face four ways
 * and move its limbs, which a single painting cannot do. The painted
 * artwork is used where a portrait is wanted (see RiggedCharacterPuppet).
 *
 *   dir    down (front) | up (back) | left | right (side, mirrored)
 *   state  idle | walk | work | attack | guard | hit
 *
 * All three views are in the DOM and the stylesheet shows one, by the
 * `data-dir` on the root. So a simulation can turn a figure round or
 * start it walking by writing two attributes, without a render.
 */

import { forwardRef, memo } from 'react';

const INK = '#4A2E2A';
const O = { stroke: INK, strokeWidth: 1.5, strokeLinejoin: 'round', strokeLinecap: 'round' };
const SKIN = '#FCDCC6';
const SKIN_D = '#F2BFA4';

/**
 * Who is who. The six follow their own artwork: the hood and the bell
 * are Koneko's, the beret is Kaneru's, the straw hat is Mone's.
 */
export const SPRITE_CAST = Object.freeze({
  koneko: { hair: '#F2A766', hairD: '#D9824A', eye: '#3F8F5B', style: 'long', hat: 'cathood', top: '#F7D4B4', skirt: '#FBEFDD', trim: '#D9462F', shoe: '#8A5A3C', extra: ['bell', 'tail', 'backbow'] },
  minori: { hair: '#7A4A4F', hairD: '#5C3438', eye: '#8A6BC2', style: 'long', top: '#EADFF2', skirt: '#C9B6DF', trim: '#8A6BC2', shoe: '#6B4A3A', extra: ['braid', 'apron', 'clip'] },
  kaneru: { hair: '#4A3530', hairD: '#33241F', eye: '#B86A3A', style: 'short', hat: 'beret', top: '#6F87C9', topD: '#5670B0', legs: '#3E4A6B', trim: '#F4E285', shoe: '#33241F', extra: ['ledger', 'cardigan'] },
  kogane: { hair: '#F0C766', hairD: '#D9A840', eye: '#C9922A', style: 'long', top: '#FBF0D8', skirt: '#F4DDA8', trim: '#8C2F3F', shoe: '#8C2F3F', extra: ['drills', 'bows'] },
  mone: { hair: '#D9787A', hairD: '#B85A60', eye: '#B8692E', style: 'short', hat: 'strawhat', top: '#FFF6E8', skirt: '#F6E2B5', trim: '#4E7BD0', shoe: '#8A5A3C', extra: ['braids'] },
  zenimaru: { hair: '#A68A72', hairD: '#86705C', eye: '#4E9A72', style: 'messy', top: '#F1E8D8', legs: '#5C4A3D', trim: '#3D5A80', shoe: '#33241F', extra: ['haori'] },
  // The townsfolk.
  npc_townswoman: { hair: '#B5713C', hairD: '#8F5327', eye: '#6B4A2E', style: 'short', hat: 'bonnet', top: '#F08A3C', skirt: '#E2701F', trim: '#FFF6E8', shoe: '#6B4A3A', extra: ['apron'] },
  npc_merchant: { hair: '#6B4A2E', hairD: '#4F3520', eye: '#4F3520', style: 'short', top: '#C9D8B6', legs: '#6B5A45', trim: '#FFF6E8', shoe: '#33241F', extra: ['beard', 'apron'] },
  npc_butler: { hair: '#C9C5C0', hairD: '#A6A19B', eye: '#5C6B7A', style: 'short', top: '#3A3A44', topD: '#2A2A33', legs: '#2A2A33', trim: '#FFFFFF', shoe: '#1F1F26', extra: ['glasses', 'tie'] },
  npc_knight: { hair: '#C9A26B', hairD: '#A8824F', eye: '#4E6B9A', style: 'short', hat: 'helmet', top: '#C9D2DC', topD: '#9FACBA', legs: '#8794A3', trim: '#C8443A', shoe: '#5C6672', extra: ['armor'] },
  npc_mage: { hair: '#E6E0F2', hairD: '#C4B8DC', eye: '#7A4FB8', style: 'long', hat: 'wizardhat', top: '#7A4FB8', skirt: '#5E3A96', trim: '#F4E285', shoe: '#3D2466', extra: [] },
});

export const NPC_KINDS = Object.freeze(['npc_townswoman', 'npc_merchant', 'npc_butler', 'npc_knight', 'npc_mage']);

const has = (c, name) => c.extra.includes(name);

/* --- parts ------------------------------------------------------------- */

function Hat({ c, view }) {
  const side = view === 'side';
  if (c.hat === 'cathood') {
    return (
      <g>
        <path d="M13 21 L15 4 L27 13 Z" fill="#FBF3E6" {...O} />
        <path d="M51 21 L49 4 L37 13 Z" fill="#FBF3E6" {...O} />
        {view !== 'back' ? (
          <>
            <path d="M16.5 17 L17.5 8.5 L23.5 13.5 Z" fill="#F7B8C0" />
            <path d="M47.5 17 L46.5 8.5 L40.5 13.5 Z" fill="#F7B8C0" />
          </>
        ) : null}
        {view === 'back' ? (
          <path d="M11 32 Q10 11 32 11 Q54 11 53 32 Q54 47 44 50 Q32 54 20 50 Q10 47 11 32 Z" fill="#FBF3E6" {...O} />
        ) : (
          <path
            d={side
              ? 'M12 33 Q10 11 32 11 Q52 11 52 26 Q44 17 32 18 Q22 20 23 34 Q24 46 28 50 Q12 50 12 33 Z'
              : 'M11 34 Q9 11 32 11 Q55 11 53 34 Q53 44 49 48 Q51 22 32 21 Q13 22 15 48 Q11 44 11 34 Z'}
            fill="#FBF3E6" {...O}
          />
        )}
        {view === 'back' ? <path d="M17 44 Q32 50 47 44" fill="none" stroke="#E8D9C2" strokeWidth="1.6" strokeLinecap="round" /> : null}
      </g>
    );
  }
  if (c.hat === 'strawhat') {
    return (
      <g>
        <ellipse cx="32" cy="21" rx="25" ry="6.5" fill="#F6D98A" {...O} />
        <path d="M18 21 Q18 6 32 6 Q46 6 46 21 Q32 25 18 21 Z" fill="#FBE6A6" {...O} />
        <path d="M18.2 18 Q32 22.5 45.8 18 L46 21 Q32 25 18 21 Z" fill={c.trim} {...O} strokeWidth="1.1" />
        <path d={view === 'back' ? 'M28 21 L23 28 L30 25 L32 22 L34 25 L41 28 L36 21 Z' : 'M44 19 L52 15 L50 22 L52 27 L44 23 Z'} fill={c.trim} {...O} strokeWidth="1.1" />
      </g>
    );
  }
  if (c.hat === 'beret') {
    return (
      <g>
        <path d="M13 23 Q11 8 32 7.5 Q54 8 51 22 Q40 27 26 25 Q18 25 13 23 Z" fill="#3A4A7A" {...O} />
        <path d="M17 13 Q30 8 45 12" fill="none" stroke="#5670B0" strokeWidth="1.6" strokeLinecap="round" />
        <path d={view === 'back' ? 'M14 20 L8 16 L10 24 L8 29 L15 25 Z' : 'M49 19 L56 15 L54 22 L56 28 L49 24 Z'} fill="#2C3960" {...O} strokeWidth="1.1" />
      </g>
    );
  }
  if (c.hat === 'bonnet') {
    return (
      <g>
        <path d="M12 30 Q10 9 32 9 Q54 9 52 30 Q50 18 32 17 Q14 18 12 30 Z" fill="#FFF6E8" {...O} />
        <path d="M13 27 Q32 12 51 27" fill="none" stroke="#F08A3C" strokeWidth="2" strokeLinecap="round" />
        {view === 'back' ? <path d="M12 30 Q11 12 32 11 Q53 12 52 30 Q52 42 32 44 Q12 42 12 30 Z" fill="#FFF6E8" {...O} /> : null}
      </g>
    );
  }
  if (c.hat === 'wizardhat') {
    return (
      <g>
        <path d="M20 20 Q24 4 37 1 Q40 10 45 20 Z" fill={c.top} {...O} />
        <ellipse cx="32" cy="20.5" rx="24" ry="6" fill={c.skirt} {...O} />
        <path d="M21 18.5 Q32 22 44 18.5" fill="none" stroke={c.trim} strokeWidth="2.2" strokeLinecap="round" />
        <path d="M33 8 l1.3 2.6 2.9 .4 -2.1 2 .5 2.9 -2.6 -1.4 -2.6 1.4 .5 -2.9 -2.1 -2 2.9 -.4z" fill={c.trim} />
      </g>
    );
  }
  if (c.hat === 'helmet') {
    return (
      <g>
        <path d="M32 9 Q36 0 44 3 Q40 6 38 11 Z" fill={c.trim} {...O} strokeWidth="1.1" />
        <path d={view === 'back'
          ? 'M12 34 Q10 10 32 10 Q54 10 52 34 Q52 46 32 48 Q12 46 12 34 Z'
          : 'M12 34 Q10 10 32 10 Q54 10 52 34 L48 34 Q48 26 32 26 Q16 26 16 34 Z'} fill={c.top} {...O} />
        <path d="M32 10 L32 26" stroke={c.topD} strokeWidth="2" />
        <path d="M15 22 Q32 14 49 22" fill="none" stroke="#EEF2F6" strokeWidth="1.4" strokeLinecap="round" />
      </g>
    );
  }
  return null;
}

function Face({ c, side }) {
  if (side) {
    return (
      <g>
        <ellipse cx="42.5" cy="35.5" rx="2.7" ry="3.9" fill={c.eye} stroke={INK} strokeWidth="1.2" />
        <ellipse cx="42.5" cy="36.4" rx="1.4" ry="2" fill={INK} opacity=".55" />
        <circle cx="43.4" cy="34" r="1" fill="#FFFFFF" />
        <ellipse cx="39.5" cy="41.5" rx="3" ry="1.7" fill="#F7A9A0" opacity=".7" />
        <path d="M46.5 42 q1.4 1.1 2.6 0" fill="none" stroke={INK} strokeWidth="1.1" strokeLinecap="round" />
        {has(c, 'glasses') ? <circle cx="42.5" cy="35.5" r="4.6" fill="none" stroke="#33241F" strokeWidth="1.1" /> : null}
        {has(c, 'beard') ? <path d="M36 43 Q44 54 50 43 Q47 47 42 46 Q38 46 36 43 Z" fill={c.hair} {...O} strokeWidth="1.1" /> : null}
      </g>
    );
  }
  return (
    <g>
      {[25, 39].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy="35.5" rx="3.3" ry="4.2" fill={c.eye} stroke={INK} strokeWidth="1.2" />
          <ellipse cx={x} cy="36.6" rx="1.7" ry="2.2" fill={INK} opacity=".55" />
          <circle cx={x + 1.1} cy="33.9" r="1.15" fill="#FFFFFF" />
          <circle cx={x - 1.2} cy="37.4" r=".6" fill="#FFFFFF" opacity=".9" />
        </g>
      ))}
      <ellipse cx="20.5" cy="41.5" rx="3.2" ry="1.8" fill="#F7A9A0" opacity=".7" />
      <ellipse cx="43.5" cy="41.5" rx="3.2" ry="1.8" fill="#F7A9A0" opacity=".7" />
      <path d="M29.6 42.6 q1.2 1.5 2.4 0 q1.2 1.5 2.4 0" fill="none" stroke={INK} strokeWidth="1.1" strokeLinecap="round" />
      {has(c, 'glasses') ? (
        <g fill="none" stroke="#33241F" strokeWidth="1.1">
          <circle cx="25" cy="35.5" r="5" /><circle cx="39" cy="35.5" r="5" /><path d="M30 35.5 h4" />
        </g>
      ) : null}
      {has(c, 'beard') ? <path d="M18 41 Q20 55 32 56 Q44 55 46 41 Q40 47 32 45.5 Q24 47 18 41 Z" fill={c.hair} {...O} strokeWidth="1.1" /> : null}
    </g>
  );
}

/** Hair that hangs behind the body. */
function HairBack({ c, view }) {
  if (c.hat === 'helmet') return null;
  const long = c.style === 'long';
  if (view === 'side') {
    return long
      ? <path d="M17 26 Q10 44 15 64 Q21 67 27 63 Q24 46 28 30 Z" fill={c.hairD} {...O} />
      : <path d="M17 26 Q13 38 18 47 Q23 48 26 44 Q24 36 27 30 Z" fill={c.hairD} {...O} />;
  }
  if (!long) return null;
  return <path d="M13 28 Q9 48 14 65 Q32 70 50 65 Q55 48 51 28 Z" fill={c.hairD} {...O} />;
}

function Extras({ c, view }) {
  const out = [];
  if (has(c, 'drills')) {
    [view === 'side' ? 15 : 9.5, view === 'side' ? null : 54.5].filter((x) => x !== null).forEach((x) => {
      out.push(
        <g key={`d${x}`}>
          {[30, 37, 44, 51, 57].map((y, i) => (
            <ellipse key={y} cx={x + (i % 2 ? 0.8 : -0.8)} cy={y} rx={5.2 - i * 0.55} ry="4.4" fill={i % 2 ? c.hair : c.hairD} {...O} strokeWidth="1.2" />
          ))}
        </g>
      );
    });
  }
  if (has(c, 'bows') && view !== 'side') {
    [13, 51].forEach((x) => out.push(
      <g key={`b${x}`}>
        <path d={`M${x} 19 l-6 -4.5 v9 z M${x} 19 l6 -4.5 v9 z`} fill="#8C2F3F" {...O} strokeWidth="1.1" />
        <circle cx={x} cy="19" r="1.8" fill="#B8475A" stroke={INK} strokeWidth="1" />
      </g>
    ));
  }
  if (has(c, 'bows') && view === 'side') {
    out.push(<g key="bs"><path d="M22 18 l-6 -4.5 v9 z M22 18 l6 -4.5 v9 z" fill="#8C2F3F" {...O} strokeWidth="1.1" /><circle cx="22" cy="18" r="1.8" fill="#B8475A" stroke={INK} strokeWidth="1" /></g>);
  }
  if (has(c, 'braid') && view !== 'back') {
    const x = view === 'side' ? 37 : 47.5;
    out.push(<g key="br">{[44, 49.5, 55, 60].map((y, i) => <ellipse key={y} cx={x + (i % 2 ? 0.9 : -0.9)} cy={y} rx="3.3" ry="3.4" fill={i % 2 ? c.hair : c.hairD} {...O} strokeWidth="1.1" />)}<circle cx={x} cy="64" r="1.8" fill="#F4E285" stroke={INK} strokeWidth="1" /></g>);
  }
  if (has(c, 'clip') && view === 'front') out.push(<path key="cl" d="M45 22 l3 -5 2.5 5.5 -2.8 1.5z" fill="#E8B84B" {...O} strokeWidth="1" />);
  if (has(c, 'braids')) {
    (view === 'side' ? [20] : [12.5, 51.5]).forEach((x) => out.push(
      <g key={`mb${x}`}>{[42, 47.5, 53, 58].map((y, i) => <ellipse key={y} cx={x + (i % 2 ? 0.9 : -0.9)} cy={y} rx="3.4" ry="3.4" fill={i % 2 ? c.hair : c.hairD} {...O} strokeWidth="1.1" />)}<circle cx={x} cy="62" r="1.7" fill={c.trim} stroke={INK} strokeWidth="1" /></g>
    ));
  }
  return out;
}

function Head({ c, view }) {
  const side = view === 'side';
  const back = view === 'back';
  const hood = c.hat === 'cathood';
  const helmet = c.hat === 'helmet';
  return (
    <g className="prs-part prs-head">
      {/* the head */}
      <ellipse cx={side ? 33 : 32} cy="33" rx={side ? 17 : 18} ry="17" fill={back ? c.hair : SKIN} {...O} />
      {!back && !side ? <path d="M15 37 Q32 53 49 37" fill="none" stroke={SKIN_D} strokeWidth="1.2" opacity=".6" /> : null}
      {/* the hair over it */}
      {back ? (
        <path d="M14 33 Q13 15 32 15 Q51 15 50 33 Q50 47 32 50 Q14 47 14 33 Z" fill={c.hair} />
      ) : side ? (
        <path d="M16 35 Q13 15 33 15 Q50 15 50.5 31 Q46 24.5 40 24 Q39 31 31 31 Q29 40 24 46 Q15 44 16 35 Z" fill={c.hair} {...O} />
      ) : helmet ? null : (
        <path
          d={c.style === 'messy'
            ? 'M13.5 35 Q11 13 32 13 Q53 13 50.5 35 Q49 25 43 23 L41 29 L37 22.5 L33.5 29 L30 22.5 L26 29 L22 23 Q15.5 25 13.5 35 Z'
            : 'M13.5 35 Q11.5 14 32 14 Q52.5 14 50.5 35 Q49 25.5 43.5 23.5 Q41 29 37 24 Q33 29 28.5 24 Q24.5 29 21.5 23.5 Q15.5 26 13.5 35 Z'}
          fill={c.hair} {...O}
        />
      )}
      {!back && !side && !helmet ? <path d="M19 19.5 Q32 15.5 45 19.5" fill="none" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" opacity=".5" /> : null}
      {back && !hood && !helmet ? <path d="M19 21 Q32 16 45 21" fill="none" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" opacity=".4" /> : null}
      {!back ? <Face c={c} side={side} /> : null}
      <Hat c={c} view={view} />
      <Extras c={c} view={view} />
    </g>
  );
}

function Body({ c, view }) {
  const side = view === 'side';
  const back = view === 'back';
  const trousers = !!c.legs;
  const legFill = trousers ? c.legs : SKIN;
  const lx = side ? [29, 29] : [24.5, 33.5];
  const dress = side ? 'M26 54 Q33 51 40 54 L44.5 75 Q33 78.5 21.5 75 Z' : 'M22 54 Q32 50.5 42 54 L47.5 75 Q32 79.5 16.5 75 Z';
  const torso = side ? 'M26.5 54 Q33 51 39.5 54 L40.5 72 Q33 74 25.5 72 Z' : 'M22.5 54 Q32 50.5 41.5 54 L43 72 Q32 74.5 21 72 Z';
  return (
    <>
      {has(c, 'tail') && !side ? (
        <path className="prs-part prs-tail" d={back ? 'M38 72 Q52 74 53 62 Q53 56 48.5 57 Q49.5 66 38 67 Z' : 'M43 70 Q54 72 54 61 Q53.5 56 49.5 57.5 Q50 65 43 66 Z'} fill="#F6E4CC" {...O} />
      ) : null}
      {has(c, 'tail') && !side ? <path d={back ? 'M49 58 Q52.5 59 52.6 63' : 'M50 58.5 Q53 60 53.4 63'} fill="none" stroke="#E0914E" strokeWidth="2.2" strokeLinecap="round" /> : null}
      {/* legs */}
      {[0, 1].map((i) => (
        <g key={i} className={`prs-part prs-leg ${i ? 'prs-leg-r' : 'prs-leg-l'}`}>
          <rect x={lx[i]} y="69" width="6" height="16" rx="2.6" fill={legFill} {...O} />
          <path d={side ? `M${lx[i] - 0.5} 84 h8.5 q2 2.6 -.6 5 h-7.9 z` : `M${lx[i] - 0.8} 84 h7.6 q1.4 2.6 -.4 5 h-6.8 q-1.8 -2.4 -.4 -5 z`} fill={c.shoe} {...O} />
        </g>
      ))}
      {/* the far arm, in the side view */}
      {side ? <g className="prs-part prs-arm prs-arm-l"><rect x="29.5" y="54" width="6" height="15" rx="3" fill={c.topD || c.top} {...O} /><circle cx="32.5" cy="70" r="2.8" fill={SKIN} {...O} /></g> : null}
      {/* the body */}
      <path d={trousers ? torso : dress} fill={trousers ? c.top : c.skirt} {...O} />
      {!trousers ? <path d={side ? 'M26.3 54 Q33 51 39.7 54 L41 64 Q33 66 25 64 Z' : 'M22.2 54 Q32 50.5 41.8 54 L43.5 64 Q32 66.5 20.5 64 Z'} fill={c.top} {...O} /> : null}
      {!trousers ? <path d={side ? 'M22.5 71.5 Q33 75 43.5 71.5' : 'M17.5 71.5 Q32 76 46.5 71.5'} fill="none" stroke={c.trim} strokeWidth="1.5" strokeLinecap="round" /> : null}
      {has(c, 'armor') ? <path d="M24 60 h16 M32 54 v18" stroke={c.topD} strokeWidth="1.4" fill="none" /> : null}
      {has(c, 'cardigan') && !back ? <path d="M32 52 L29 72 M32 52 L35 72" stroke={c.topD} strokeWidth="1.3" fill="none" /> : null}
      {has(c, 'tie') && view === 'front' ? <path d="M30.5 53 h3 l-.6 3 1.4 7 -2.3 2.5 -2.3 -2.5 1.4 -7z" fill="#B8475A" {...O} strokeWidth="1" /> : null}
      {has(c, 'haori') ? (
        back
          ? <path d="M20 54 Q32 50 44 54 L46.5 73 Q32 76 17.5 73 Z" fill={c.trim} {...O} />
          : <>
              <path d={side ? 'M26.5 54 L25 73 L30.5 73.5 L31 54 Z' : 'M22.5 54 L19.5 73 L27 74 L28.5 53 Z'} fill={c.trim} {...O} />
              {!side ? <path d="M41.5 54 L44.5 73 L37 74 L35.5 53 Z" fill={c.trim} {...O} /> : null}
            </>
      ) : null}
      {has(c, 'apron') && !back ? <path d={side ? 'M34 58 h7 l2.5 15 q-5 1.5 -9 .5 z' : 'M25.5 58 h13 l2.5 15.5 q-9 2.2 -18 0 z'} fill="#FFFDF7" {...O} strokeWidth="1.2" /> : null}
      {has(c, 'backbow') && back ? <g><path d="M32 58 l-8 -5 v10 z M32 58 l8 -5 v10 z" fill={c.trim} {...O} strokeWidth="1.2" /><circle cx="32" cy="58" r="2.1" fill="#F0705C" stroke={INK} strokeWidth="1" /><path d="M30 60 l-2.5 9 M34 60 l2.5 9" stroke={c.trim} strokeWidth="2" strokeLinecap="round" /></g> : null}
      {has(c, 'bell') && !back ? <g><path d={side ? 'M27.5 53.6 Q33 55.6 38.5 53.6' : 'M24 53.4 Q32 56.2 40 53.4'} fill="none" stroke={c.trim} strokeWidth="2.4" strokeLinecap="round" /><circle cx={side ? 37 : 32} cy="56.8" r="2.4" fill="#F4C542" {...O} strokeWidth="1" /></g> : null}
      {/* arms */}
      {!side ? (
        <g className="prs-part prs-arm prs-arm-l">
          <rect x="15.5" y="54" width="6.5" height="15" rx="3.2" fill={has(c, 'haori') ? c.trim : c.top} {...O} />
          <circle cx="18.8" cy="70" r="2.9" fill={SKIN} {...O} />
          {has(c, 'ledger') && view === 'front' ? <g><rect x="11" y="62" width="11" height="13" rx="1.4" fill="#8A5A3C" {...O} /><path d="M13.5 65.5 h6 M13.5 68.5 h6" stroke="#F4E285" strokeWidth="1.2" /></g> : null}
        </g>
      ) : null}
      <g className="prs-part prs-arm prs-arm-r">
        <rect x={side ? 30 : 42} y="54" width="6.5" height="15" rx="3.2" fill={has(c, 'haori') ? c.trim : c.top} {...O} />
        <circle cx={side ? 33.2 : 45.2} cy="70" r="2.9" fill={SKIN} {...O} />
        <g className="prs-tool" transform={`translate(${side ? 33.2 : 45.2} 70)`}>
          <g className="prs-tool--hammer"><rect x="-1" y="-15" width="2" height="16" rx="1" fill="#8A5A3C" {...O} strokeWidth="1" /><rect x="-5" y="-19" width="10" height="6" rx="1.4" fill="#9FACBA" {...O} strokeWidth="1.1" /></g>
          <g className="prs-tool--sword"><path d="M-1.4 -1 L-1.4 -22 L0 -26 L1.4 -22 L1.4 -1 Z" fill="#E6EDF3" {...O} strokeWidth="1" /><rect x="-4.5" y="-2.4" width="9" height="2.4" rx="1" fill="#E8B84B" {...O} strokeWidth="1" /><rect x="-1.1" y="0" width="2.2" height="4.5" rx="1" fill="#8A5A3C" {...O} strokeWidth="1" /></g>
          <g className="prs-tool--staff"><rect x="-1" y="-22" width="2" height="27" rx="1" fill="#8A5A3C" {...O} strokeWidth="1" /><circle cx="0" cy="-25" r="4" fill="#F7A9D0" {...O} strokeWidth="1.1" /><circle cx="-1.2" cy="-26.2" r="1.2" fill="#FFFFFF" /></g>
          <g className="prs-tool--bow"><path d="M2 -16 Q12 0 2 16" fill="none" stroke="#8A5A3C" strokeWidth="2.2" strokeLinecap="round" /><path d="M2 -16 L2 16" stroke="#FFFDF7" strokeWidth=".8" /></g>
        </g>
      </g>
    </>
  );
}

function View({ c, view }) {
  return (
    <svg data-view={view} viewBox="0 0 64 96" width="100%" height="100%" aria-hidden="true" focusable="false">
      <ellipse className="prs-shadow" cx="32" cy="90.5" rx="15" ry="4" fill="#2C1B12" opacity=".24" />
      <g className="prs-all">
        <ellipse className="prs-aura" cx="32" cy="52" rx="29" ry="40" fill="#8EC9F0" opacity="0" stroke="#4E9AE0" strokeWidth="2" />
        <g className="prs-bob">
          <HairBack c={c} view={view} />
          <Body c={c} view={view} />
          <Head c={c} view={view} />
        </g>
      </g>
    </svg>
  );
}

const ParallelRpgSprite = forwardRef(function ParallelRpgSprite(
  { who = 'koneko', dir = 'down', state = 'idle', size = 48, weapon = 'none', className = '', style, ...rest },
  ref
) {
  const c = SPRITE_CAST[who] || SPRITE_CAST.npc_townswoman;
  return (
    <span
      ref={ref}
      className={`prs ${className}`.trim()}
      data-who={who}
      data-dir={dir}
      data-state={state}
      data-weapon={weapon}
      style={{ width: size, height: size * 1.5, ...style }}
      {...rest}
    >
      <View c={c} view="front" />
      <View c={c} view="back" />
      <View c={c} view="side" />
    </span>
  );
});

export default memo(ParallelRpgSprite);
export { ParallelRpgSprite };
