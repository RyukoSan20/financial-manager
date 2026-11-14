
/**
 * The fallback picture.
 *
 * It is a warm illustrated scene, drawn rather than photographed, and
 * it is inline so it costs no request. If the photograph cannot be
 * fetched - an offline test, a blocked CDN, a server that has not
 * been deployed yet - the polaroid shows this instead of an empty
 * white rectangle.
 *
 * Three scenes, one per frame, so the three do not look like three
 * copies of the same picture.
 */
const SCENES = [
  // Two cups on a cafe table.
  `<rect width="160" height="160" fill="#F6E7C4"/>
   <rect y="112" width="160" height="48" fill="#E0C79A"/>
   <ellipse cx="54" cy="104" rx="26" ry="8" fill="#D8B98A"/>
   <path d="M40 60 h28 v34 q0 10 -14 10 t-14 -10 z" fill="#FFFDF9" stroke="#4A3540" stroke-width="2"/>
   <path d="M68 66 q12 2 10 14 q-1 8 -10 8" fill="none" stroke="#4A3540" stroke-width="2"/>
   <ellipse cx="108" cy="106" rx="22" ry="7" fill="#D8B98A"/>
   <path d="M96 68 h24 v28 q0 9 -12 9 t-12 -9 z" fill="#E3F2EA" stroke="#4A3540" stroke-width="2"/>
   <path d="M46 52 q4 -8 0 -14 M56 52 q4 -8 0 -14" fill="none" stroke="#B9A98C" stroke-width="2" stroke-linecap="round"/>
   <path d="M100 60 q4 -7 0 -12" fill="none" stroke="#B9A98C" stroke-width="2" stroke-linecap="round"/>
   <circle cx="132" cy="40" r="9" fill="#F4E285"/>`,
  // A notebook and a coin.
  `<rect width="160" height="160" fill="#FFF6D6"/>
   <rect y="120" width="160" height="40" fill="#F2E2B4"/>
   <g transform="translate(26 44) rotate(-6)">
     <rect width="78" height="60" rx="4" fill="#FFFDF9" stroke="#4A3540" stroke-width="2"/>
     <path d="M12 16 h52 M12 28 h52 M12 40 h34" stroke="#C9BFAE" stroke-width="2" stroke-linecap="round"/>
     <path d="M62 6 v48" stroke="#E07A5F" stroke-width="3"/>
   </g>
   <circle cx="116" cy="98" r="20" fill="#F4E285" stroke="#4A3540" stroke-width="2"/>
   <rect x="110" y="92" width="12" height="12" fill="#FFF6D6" stroke="#4A3540" stroke-width="1.5"/>
   <path d="M96 74 l4 4 l8 -9" fill="none" stroke="#66BB6A" stroke-width="3" stroke-linecap="round"/>`,
  // A cat and a money box.
  `<rect width="160" height="160" fill="#FDE8E4"/>
   <rect y="118" width="160" height="42" fill="#F3D4CC"/>
   <g transform="translate(40 52)">
     <path d="M0 34 L-4 8 L16 24 Z M48 34 L52 8 L32 24 Z" fill="#FFFDF9" stroke="#4A3540" stroke-width="2" stroke-linejoin="round"/>
     <ellipse cx="24" cy="40" rx="26" ry="22" fill="#FFFDF9" stroke="#4A3540" stroke-width="2"/>
     <circle cx="16" cy="38" r="2.6" fill="#4A3540"/>
     <circle cx="32" cy="38" r="2.6" fill="#4A3540"/>
     <path d="M21 46 q3 3 6 0" fill="none" stroke="#4A3540" stroke-width="1.6" stroke-linecap="round"/>
   </g>
   <g transform="translate(96 92)">
     <rect width="44" height="30" rx="4" fill="#F4E285" stroke="#4A3540" stroke-width="2"/>
     <path d="M0 12 h44" stroke="#4A3540" stroke-width="2"/>
     <rect x="18" y="8" width="8" height="7" rx="2" fill="#C9A227" stroke="#4A3540" stroke-width="1.5"/>
   </g>`,
];

/** The data URI for one frame's fallback scene. */
export const editorialFallback = (index = 0) => {
  const scene = SCENES[index % SCENES.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">${scene}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

export { SCENES };
