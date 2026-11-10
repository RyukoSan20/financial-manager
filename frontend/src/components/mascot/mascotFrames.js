/**
 * The mascot, as a grid.
 *
 * The mascot is sixteen squares by sixteen. Every square is written
 * down here, one character per square, so the drawing is the same
 * every time and on every screen: there is no curve to be rendered a
 * little differently by one browser or another.
 *
 * It is drawn in layers, the way a puppet is built. The body is one
 * layer, the ears another, the face another, and what it wears
 * another. A layer can be swapped for a different drawing of itself -
 * ears up for ears twitched, eyes open for eyes shut - without the
 * rest being redrawn, and that swap is what a frame is.
 *
 * There is no React in this file, so a script can read the grids and
 * check them.
 */

export const GRID = 16;

/** What each character is. */
export const PALETTE = {
  o: '#0F291E', // the outline: deep forest
  b: '#FFF4D6', // the body: warm cream
  p: '#FDA4AF', // inside the ear
  e: '#0F291E', // the eye
  w: '#FFFFFF', // the light in the eye
  k: '#FDA4AF', // the cheek
  m: '#0F291E', // the mouth
  r: '#FB7185', // the tongue
  a: '#F97316', // the mark of alarm
  l: '#A3E635', // the leaf, in the light
  g: '#4D7C0F', // the leaf, in the shade
  s: '#3F6212', // the stem
  v: '#112A20', // the visor
  V: '#0B1512', // the brim of the visor
  y: '#BEF264', // the badge on the visor
};

const EMPTY = '................';

/** The body, without the ears. It does not change between frames. */
export const BODY = [
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  '..oooooooooooo..',
  '..obbbbbbbbbbo..',
  '.obbbbbbbbbbbbo.',
  '.obbbbbbbbbbbbo.',
  '.obbbbbbbbbbbbo.',
  '.obbbbbbbbbbbbo.',
  '.obbbbbbbbbbbbo.',
  '..obbbbbbbbbbo..',
  '..obbbbbbbbbbo..',
  '...obbbbbbbbo...',
  '...obboooobbo...',
  '....oo....oo....',
];

/** The ears. Frame 0 has both up; frame 1 has the right one twitched. */
export const EARS = [
  [
    EMPTY,
    EMPTY,
    '...oo......oo...',
    '..obbo....obbo..',
    '..obpb....bpbo..',
    ...Array(11).fill(EMPTY),
  ],
  [
    EMPTY,
    EMPTY,
    '...oo...........',
    '..obbo.....ooo..',
    '..obpb....bppbo.',
    ...Array(11).fill(EMPTY),
  ],
];

const rows = (map) => {
  const grid = Array(GRID).fill(EMPTY);
  for (const [row, line] of Object.entries(map)) grid[Number(row)] = line;
  return grid;
};

/**
 * The faces. One pair of frames for each state: the first is the
 * face at rest, the second is what it flickers to.
 */
export const FACES = {
  idle: [
    rows({ 7: '....ew....ew....', 8: '....ee....ee....', 9: '...k...mm...k...' }),
    // The blink: the eyes are a line.
    rows({ 8: '....ee....ee....', 9: '...k...mm...k...' }),
  ],
  happy: [
    rows({ 7: '....ee....ee....', 8: '...e..e..e..e...', 9: '...k..mmmm..k...', 10: '.......rr.......' }),
    rows({ 7: '....ee....ee....', 8: '...e..e..e..e...', 9: '...k...mm...k...' }),
  ],
  celebrate: [
    rows({ 7: '....ee....ee....', 8: '...e..e..e..e...', 9: '...k..mmmm..k...', 10: '......mrrm......' }),
    rows({ 7: '...e..e..e..e...', 8: '....ee....ee....', 9: '...k..mmmm..k...', 10: '.......rr.......' }),
  ],
  alert: [
    rows({
      1: '..............a.', 2: '..............a.', 3: '..............a.', 5: '..............a.',
      6: '....ee....ee....', 7: '....ew....ew....', 8: '....ee....ee....', 10: '.......mm.......',
    }),
    rows({
      6: '....ee....ee....', 7: '....we....we....', 8: '....ee....ee....', 10: '.......mm.......',
    }),
  ],
};

/** What it wears. A sprout for a family; a shopkeeper's visor for a business. */
export const OUTFITS = {
  family: rows({
    0: '.....ll..ll.....',
    1: '....lggllggl....',
    2: '.....lggggl.....',
    3: '.......ss.......',
  }),
  business: rows({
    2: '.....vvvvvv.....',
    3: '....vvvyyvvv....',
    4: '...VVVVVVVVVV...',
  }),
};

export const STATES = ['idle', 'happy', 'celebrate', 'alert'];
export const MODES = ['family', 'business'];

/** How long each frame is held, in milliseconds. */
export const IDLE_HOLD_MS = 3200;
export const BLINK_MS = 180;
export const JUMP_CYCLE_MS = 350;

/**
 * How long to hold a frame before showing the other one.
 *
 * At rest the mascot looks out for a little over three seconds and
 * blinks for a fifth of one. When it is pleased it bounces between
 * its two frames in time with the jump.
 */
export function frameHold(state, frame) {
  if (state === 'happy' || state === 'celebrate') return JUMP_CYCLE_MS;
  return frame === 0 ? IDLE_HOLD_MS : BLINK_MS;
}

/**
 * A grid as rectangles.
 *
 * Squares of the same colour that sit side by side on a row become
 * one rectangle, so the drawing is a few dozen shapes and not two
 * hundred and fifty-six.
 */
export function gridToRects(grid) {
  const rects = [];
  grid.forEach((line, y) => {
    let x = 0;
    while (x < line.length) {
      const key = line[x];
      if (key === '.') {
        x += 1;
        continue;
      }
      let width = 1;
      while (x + width < line.length && line[x + width] === key) width += 1;
      rects.push({ x, y, width, fill: PALETTE[key], key });
      x += width;
    }
  });
  return rects;
}

/** The layers of one frame, from the back to the front. */
export function mascotLayers({ state = 'idle', mode = 'family', frame = 0 } = {}) {
  const safeState = STATES.includes(state) ? state : 'idle';
  const safeMode = MODES.includes(mode) ? mode : 'family';
  const index = frame === 1 ? 1 : 0;
  return [
    { name: 'body', rects: gridToRects(BODY) },
    // The ears go over the body, so the foot of each ear opens into
    // the head instead of being cut off by the head's outline.
    { name: 'ears', rects: gridToRects(EARS[index]) },
    { name: 'face', rects: gridToRects(FACES[safeState][index]) },
    { name: 'outfit', rects: gridToRects(OUTFITS[safeMode]) },
  ];
}

/**
 * Where the sparks fly to.
 *
 * Eight of them, evenly round the mascot, alternating a star and a
 * coin. They are the same eight every time: a burst that is different
 * on every click cannot be checked, and nobody can tell the difference.
 */
export const SPARKS = Array.from({ length: 8 }, (_, index) => {
  const angle = (Math.PI * 2 * index) / 8 - Math.PI / 2;
  const reach = index % 2 === 0 ? 34 : 26;
  return {
    id: index,
    kind: index % 2 === 0 ? 'star' : 'coin',
    dx: Math.round(Math.cos(angle) * reach),
    dy: Math.round(Math.sin(angle) * reach),
    delay: index * 18,
  };
});

/** A star and a coin, five squares by five. */
export const SPARK_SHAPES = {
  star: ['..l..', '.lll.', 'lllll', '.lll.', '..l..'],
  coin: ['.aaa.', 'aayaa', 'ayaya', 'aayaa', '.aaa.'],
};

export const SPARK_LIFE_MS = 700;
export const JUMP_MS = 550;
