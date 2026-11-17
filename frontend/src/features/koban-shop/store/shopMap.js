/**
 * The shop as a tilemap, and the rules of walking in it.
 *
 * The room is a grid of square cells. Everything is measured in cells:
 * (0, 0) is the top-left corner of the room, x grows to the right and
 * y grows DOWN the screen, towards the viewer. The projection is
 * parallel (front-on, top-down), the one the reference game uses.
 *
 * Three layers:
 *   ground   one tile per cell, drawn flat
 *   props    furniture standing on the grid, anchored at the middle
 *            of its base, depth-sorted
 *   actors   people, anchored at their feet, depth-sorted with the
 *            props
 *
 * Depth is one rule for everything that stands up: the further down
 * the screen its base is, the later it is drawn.
 *     zIndex = Math.floor(base y in pixels)
 * So a customer above the counter is drawn behind it and Koneko, below
 * it, in front - with no special cases.
 *
 * No drawing and no clock in this file, so it can be tested as it is.
 */

export const TILE = 64;

/* --- the room ---------------------------------------------------------- */

const COLS = 16;
const ROWS = 17;
const WALL_ROWS = 5; // rows 0..4 are the back wall

const groundAt = (c, r) => {
  if (r < WALL_ROWS) {
    if (c === 4 || c === 11) return 'wall_brick';
    if (c > 4 && c < 11) {
      if (r < 4) return 'sky';
      return c === 7 || c === 8 ? 'door' : 'hedge';
    }
    return r === 4 ? 'wall_base' : 'wall_paper';
  }
  if (r === 5 && c >= 6 && c <= 9) return 'rug';
  if (r >= 7 && r <= 10 && c >= 2 && c <= 13) {
    return r === 7 || r === 10 || c === 2 || c === 13 ? 'carpet_edge' : 'carpet';
  }
  return 'floor_wood';
};

/** x, y: the middle of the base. w, h: the size of the picture. solid: the footprint. */
const prop = (id, tile, x, y, w, h, solid) => ({ id, tile, x, y, w, h, solid: solid || null });

const counterRun = () => {
  const out = [];
  for (let c = 0; c < COLS; c += 1) {
    const centre = c >= 4 && c <= 11;
    out.push(prop(`counter_${c}`, 'counter_front', c + 0.5, 12.3, 1, centre ? 1.1 : 0.95));
  }
  return out;
};

export const SHOP_MAP = Object.freeze({
  id: 'shop',
  cols: COLS,
  rows: ROWS,
  groundAt,
  props: [
    prop('window_l', 'window', 2, 4.4, 2, 2.5),
    prop('window_r', 'window', 14, 4.4, 2, 2.5),
    prop('cloud_a', 'cloud', 6.4, 1.3, 2, 0.75),
    prop('cloud_b', 'cloud', 9.6, 2.4, 1.6, 0.6),
    prop('cabinet', 'shelf_wood', 2, 6.0, 2, 2.25, { x: 1.05, y: 5.3, w: 1.9, h: 0.7 }),
    prop('ledger_table', 'ledger_table', 13.6, 6.1, 2.75, 1.5, { x: 12.3, y: 5.5, w: 2.6, h: 0.6 }),
    prop('pillar_l', 'pillar', 4.5, 6.4, 1, 2.5, { x: 4.15, y: 5.95, w: 0.7, h: 0.45 }),
    prop('pillar_r', 'pillar', 11.5, 6.4, 1, 2.5, { x: 11.15, y: 5.95, w: 0.7, h: 0.45 }),
    prop('tree_l', 'tree', 0.75, 8.3, 1.5, 2.25, { x: 0.35, y: 7.9, w: 0.8, h: 0.4 }),
    prop('tree_r', 'tree', 15.25, 8.3, 1.5, 2.25, { x: 14.85, y: 7.9, w: 0.8, h: 0.4 }),
    prop('umbrella_l', 'umbrella_table', 1.8, 10.6, 2, 2.5, { x: 1.1, y: 10.1, w: 1.4, h: 0.5 }),
    prop('umbrella_r', 'umbrella_table', 14.2, 10.6, 2, 2.5, { x: 13.5, y: 10.1, w: 1.4, h: 0.5 }),
    ...counterRun(),
  ],
  // The counter is one long body, whatever it is drawn from.
  solids: [{ id: 'counter', x: 0, y: 11.45, w: COLS, h: 0.85 }],
  // Where the floor a person can stand on begins and ends.
  walk: { x0: 0.35, x1: COLS - 0.35, y0: WALL_ROWS + 0.3, y1: ROWS - 0.25 },
  // The way in: a gap in the hedge.
  door: { x0: 7.3, x1: 8.7, y0: 4.35 },
  spots: {
    door: { x: 8, y: 4.6 },
    koneko: { x: 8, y: 13.7 },
    kaneru: { x: 13.6, y: 5.45 },
    seats: [{ x: 3.1, y: 10.5 }, { x: 12.9, y: 10.5 }],
    browseY: 11.0,
    slotY: 11.4,
  },
});

/** The x of the four display slots, in cells. */
export const SLOT_X = Object.freeze([5, 7, 9, 11]);

/* --- depth ------------------------------------------------------------- */

export const depthOf = (y) => Math.floor(y * TILE);

/* --- bodies ------------------------------------------------------------ */

/** A person's footprint: a box around the feet. */
export const BODY = Object.freeze({ w: 0.6, h: 0.3 });

export const bodyBox = (x, y, body = BODY) => ({ x: x - body.w / 2, y: y - body.h, w: body.w, h: body.h });

export const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export const solidsOf = (map) => [...map.props.filter((p) => p.solid).map((p) => ({ id: p.id, ...p.solid })), ...(map.solids || [])];

const solidCache = new WeakMap();
const cachedSolids = (map) => {
  if (!solidCache.has(map)) solidCache.set(map, solidsOf(map));
  return solidCache.get(map);
};

/** May a body stand with its feet at (x, y)? */
export function canStand(map, x, y, body = BODY) {
  const box = bodyBox(x, y, body);
  const { walk, door } = map;
  const inRoom = box.x >= walk.x0 - body.w / 2 && box.x + box.w <= walk.x1 + body.w / 2 && y <= walk.y1 && box.y >= walk.y0 - body.h;
  const inDoor = door && y >= door.y0 && box.y < walk.y0 && box.x >= door.x0 - 0.05 && box.x + box.w <= door.x1 + 0.05;
  if (!inRoom && !inDoor) return false;
  if (!inDoor && box.y < walk.y0 - body.h) return false;
  return !cachedSolids(map).some((s) => overlaps(box, s));
}

/**
 * Move a body by (dx, dy), stopping at whatever is solid.
 *
 * The two axes are tried one after the other, so a body that meets a
 * wall at an angle slides along it instead of sticking to it.
 */
export function moveBody(map, pos, dx, dy, body = BODY) {
  let { x, y } = pos;
  let hit = false;
  if (dx) { if (canStand(map, x + dx, y, body)) x += dx; else hit = true; }
  if (dy) { if (canStand(map, x, y + dy, body)) y += dy; else hit = true; }
  return { x, y, hit };
}

/* --- finding a way ----------------------------------------------------- */

const gridCache = new WeakMap();

/** Which cells a body can stand in the middle of. */
export function walkGrid(map) {
  if (gridCache.has(map)) return gridCache.get(map);
  const grid = [];
  for (let r = 0; r < map.rows; r += 1) {
    const row = [];
    for (let c = 0; c < map.cols; c += 1) row.push(canStand(map, c + 0.5, r + 0.65));
    grid.push(row);
  }
  gridCache.set(map, grid);
  return grid;
}

const cellOf = (map, p) => ({ c: Math.max(0, Math.min(map.cols - 1, Math.floor(p.x))), r: Math.max(0, Math.min(map.rows - 1, Math.floor(p.y - 0.15))) });

function nearestFree(map, grid, cell) {
  if (grid[cell.r][cell.c]) return cell;
  let best = null;
  for (let r = 0; r < map.rows; r += 1) {
    for (let c = 0; c < map.cols; c += 1) {
      if (!grid[r][c]) continue;
      const d = (c - cell.c) ** 2 + (r - cell.r) ** 2;
      if (!best || d < best.d) best = { c, r, d };
    }
  }
  return best || cell;
}

/**
 * A way from one point to another around the furniture: A* over the
 * cells, eight directions, never cutting a corner. Returns the points
 * to walk through, ending at `to` itself.
 */
export function findPath(map, from, to) {
  const grid = walkGrid(map);
  const start = nearestFree(map, grid, cellOf(map, from));
  const goal = nearestFree(map, grid, cellOf(map, to));
  const key = (c, r) => r * map.cols + c;
  const open = [{ c: start.c, r: start.r, g: 0, f: 0 }];
  const came = new Map();
  const cost = new Map([[key(start.c, start.r), 0]]);
  const h = (c, r) => Math.hypot(c - goal.c, r - goal.r);

  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i += 1) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (cur.c === goal.c && cur.r === goal.r) {
      const cells = [];
      let k = key(cur.c, cur.r);
      while (k !== undefined && k !== key(start.c, start.r)) {
        cells.push({ x: (k % map.cols) + 0.5, y: Math.floor(k / map.cols) + 0.65 });
        k = came.get(k);
      }
      cells.reverse();
      // The last cell is replaced by the exact place asked for.
      if (cells.length) cells.pop();
      return [...cells, { x: to.x, y: to.y }];
    }
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (!dr && !dc) continue;
        const c = cur.c + dc;
        const r = cur.r + dr;
        if (c < 0 || r < 0 || c >= map.cols || r >= map.rows || !grid[r][c]) continue;
        if (dr && dc && (!grid[cur.r][c] || !grid[r][cur.c])) continue;
        const g = cur.g + (dr && dc ? 1.414 : 1);
        const k = key(c, r);
        if (cost.has(k) && cost.get(k) <= g) continue;
        cost.set(k, g);
        came.set(k, key(cur.c, cur.r));
        open.push({ c, r, g, f: g + h(c, r) });
      }
    }
  }
  return [{ x: to.x, y: to.y }];
}

/* --- the workshops: four small rooms on the same grid -------------------- */

const roomGround = (c, r) => (r < 2 ? (r === 1 ? 'wall_base' : 'wall_paper') : 'floor_wood');

export function facilityMap(id) {
  return {
    id: `facility_${id}`,
    cols: 8,
    rows: 5,
    groundAt: roomGround,
    props: [
      prop('window', 'window', 6.6, 1.75, 1.3, 1.6),
      prop('bench', 'workbench', 3, 3.7, 2.6, 1.95, { x: 1.75, y: 3.2, w: 2.5, h: 0.5 }),
      ...(id === 'restaurant' || id === 'wizardry' ? [prop('shelf', 'shelf_wood', 0.9, 2.5, 1.5, 1.7)] : []),
      ...(id === 'blacksmith' ? [prop('post', 'pillar', 0.7, 2.6, 0.8, 2)] : []),
      ...(id === 'seamstress' ? [prop('tree', 'tree', 0.7, 2.7, 1.1, 1.65)] : []),
    ],
    solids: [],
    walk: { x0: 0.3, x1: 7.7, y0: 2.2, y1: 4.8 },
    spots: { keeper: { x: 3, y: 3.15 }, wares: [{ x: 2.2, y: 2.95 }, { x: 3, y: 2.9 }, { x: 3.8, y: 2.95 }], wall: [{ x: 4.6, y: 1.15 }, { x: 5.3, y: 1.15 }] },
  };
}
