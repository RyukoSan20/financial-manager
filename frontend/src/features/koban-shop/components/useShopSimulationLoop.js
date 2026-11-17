/**
 * The shop floor's customers.
 *
 * Each customer is a small state machine - enter, stroll, inspect,
 * buy or shrug, leave (or sit a while first) - advanced once a frame.
 *
 * They live on the tilemap (store/shopMap.js). A position is in
 * cells; a route is found around the furniture with `findPath`; every
 * step is taken through `moveBody`, so a body that would enter a
 * counter, a pillar or a table is stopped by its bounding box rather
 * than drawn through it. Depth is the map's one rule:
 * zIndex = Math.floor(feet y in pixels).
 *
 * The loop writes position, depth and facing straight to the DOM, so
 * sixty updates a second cost no React render; React only hears about
 * a customer arriving, leaving, or changing their thought bubble.
 *
 * The money is not decided here. A purchase calls the engine's
 * `sellToCustomer`, and what the engine says was sold is what is shown.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ITEMS, SHELVES, itemPopularity, LIVE_FEVER_SPEED } from '../store/kobanEngine.js';
import { SHOP_MAP, SLOT_X, canStand, depthOf, findPath, moveBody } from '../store/shopMap.js';
import { placeAt } from './IsometricTilemapStage.jsx';
import { NPC_KINDS } from './ParallelRpgSprite.jsx';

const MAP = SHOP_MAP;
const WALK_SPEED = 2.5; // cells per second
const MAX_CUSTOMERS = 5;
const MIN_CUSTOMERS = 3;

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const facing = (dx, dy) => (Math.abs(dx) > Math.abs(dy) * 1.1 ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down');

/** How likely a customer is to buy, by how wanted the thing is. */
const buyChance = (itemId) => [0, 0.5, 0.7, 0.9][itemPopularity(itemId)] || 0.6;

/** A free place to stand somewhere on the carpet. */
const carpetSpot = () => {
  for (let i = 0; i < 12; i += 1) {
    const p = { x: rand(3, 13), y: rand(7.6, 10.2) };
    if (canStand(MAP, p.x, p.y)) return p;
  }
  return { x: 8, y: 9 };
};

export function useShopSimulationLoop({ stateRef, actions, enabled = true }) {
  const [npcs, setNpcs] = useState([]);
  const [effects, setEffects] = useState([]);
  const [konekoState, setKonekoState] = useState('idle');
  const sim = useRef({ list: [], nextSpawnAt: 0, last: 0, serial: 0, fx: 0 });
  const els = useRef(new Map());
  const konekoTimer = useRef(0);

  const register = useCallback((id) => (el) => {
    if (el) els.current.set(id, { el, sprite: el.querySelector('.prs') });
    else els.current.delete(id);
  }, []);

  const setBubble = useCallback((id, bubble) => {
    setNpcs((cur) => cur.map((n) => (n.id === id ? { ...n, bubble } : n)));
  }, []);

  const addEffect = useCallback((effect, life) => {
    sim.current.fx += 1;
    const fx = { ...effect, id: sim.current.fx };
    setEffects((cur) => [...cur, fx].slice(-14));
    window.setTimeout(() => setEffects((cur) => cur.filter((e) => e.id !== fx.id)), life);
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    const S = sim.current;
    const { spots } = MAP;
    let raf = 0;
    let alive = true;

    const goTo = (npc, target, next) => {
      npc.path = findPath(MAP, npc, target);
      npc.goal = target;
      npc.phase = 'walk';
      npc.next = next;
      npc.stuck = 0;
    };

    const spawn = () => {
      S.serial += 1;
      const npc = {
        id: `c${S.serial}`, kind: pick(NPC_KINDS),
        x: spots.door.x + rand(-0.25, 0.25), y: spots.door.y,
        dir: 'down', phase: 'walk', path: [], goal: null, next: 'choose',
        timer: 0, tried: 0, slot: -1, bought: false, stuck: 0,
      };
      goTo(npc, carpetSpot(), Math.random() < 0.5 ? 'stroll' : 'choose');
      S.list.push(npc);
      setNpcs((cur) => [...cur, { id: npc.id, kind: npc.kind, bubble: null }]);
    };

    const choose = (npc, st) => {
      // Go to a stocked slot if there is one; otherwise look at an empty one.
      const stocked = st.shelves.map((s, i) => (s.itemId && s.qty > 0 ? i : -1)).filter((i) => i >= 0 && i !== npc.slot);
      const idx = stocked.length ? pick(stocked) : Math.floor(Math.random() * SHELVES.length);
      npc.slot = idx;
      goTo(npc, { x: SLOT_X[idx] + rand(-0.2, 0.2), y: spots.browseY }, 'inspect');
    };

    const exit = (npc) => goTo(npc, { x: spots.door.x, y: spots.door.y - 0.15 }, 'gone');

    const leave = (npc) => {
      if (!npc.bought && Math.random() < 0.3) goTo(npc, pick(spots.seats), 'sit');
      else exit(npc);
    };

    const decide = (npc, st) => {
      const slot = st.shelves[npc.slot];
      const stocked = slot && slot.itemId && slot.qty > 0;
      if (stocked && Math.random() < buyChance(slot.itemId)) {
        const out = actions.sellToCustomer(slot.id);
        if (out && out.sale) {
          npc.bought = true;
          setBubble(npc.id, { type: 'smile' });
          addEffect({ type: 'coin', sx: npc.x, sy: npc.y - 1.2, ex: spots.koneko.x, ey: spots.koneko.y - 1.6 }, 700);
          addEffect({ type: 'gain', x: npc.x, y: npc.y - 2.4, gold: out.sale.gold, pop: out.sale.pop, qty: out.sale.qty }, 1300);
          addEffect({ type: 'pop', slot: npc.slot }, 500);
          setKonekoState('cheer');
          window.clearTimeout(konekoTimer.current);
          konekoTimer.current = window.setTimeout(() => setKonekoState('idle'), 900);
          npc.phase = 'pause'; npc.timer = 0.7; npc.next = 'leave';
          return;
        }
      }
      setBubble(npc.id, { type: 'sweat' });
      npc.tried += 1;
      npc.phase = 'pause'; npc.timer = 0.7;
      const another = st.shelves.some((s, i) => i !== npc.slot && s.itemId && s.qty > 0);
      npc.next = npc.tried < 2 && another ? 'choose' : 'leave';
    };

    const arrive = (npc, st, i) => {
      if (npc.next === 'stroll') goTo(npc, carpetSpot(), 'choose');
      else if (npc.next === 'choose') choose(npc, st);
      else if (npc.next === 'inspect') {
        npc.phase = 'inspect';
        npc.timer = rand(1.5, 2.5);
        npc.dir = 'down';
        const slot = st.shelves[npc.slot];
        const item = slot && slot.itemId && slot.qty > 0 ? ITEMS[slot.itemId] : null;
        setBubble(npc.id, item ? { type: 'item', icon: item.icon } : { type: 'sweat' });
        if (!item) npc.timer = 0.9;
      } else if (npc.next === 'sit') { npc.phase = 'sit'; npc.timer = rand(3.5, 6); npc.dir = 'down'; }
      else if (npc.next === 'gone') {
        S.list.splice(i, 1);
        setNpcs((cur) => cur.filter((n) => n.id !== npc.id));
        return false;
      }
      return true;
    };

    const frame = (t) => {
      if (!alive) return;
      const dt = Math.min(0.1, S.last ? (t - S.last) / 1000 : 0);
      S.last = t;
      const st = stateRef.current;
      const now = Date.now();
      const fever = st.feverModeUntil > now;
      const bell = st.activeBuffs && st.activeBuffs.konekoBellUntil > now;
      const speed = fever ? LIVE_FEVER_SPEED : 1;
      const rush = speed * (bell ? 2 : 1) * (st.badges && st.badges.welcome_bell ? 1.25 : 1);

      if (S.list.length < MAX_CUSTOMERS && t >= S.nextSpawnAt) {
        spawn();
        const base = S.list.length < MIN_CUSTOMERS ? rand(900, 1600) : rand(2600, 5200);
        S.nextSpawnAt = t + base / rush;
      }

      for (let i = S.list.length - 1; i >= 0; i -= 1) {
        const npc = S.list[i];
        let pose = 'idle';

        if (npc.phase === 'walk') {
          pose = 'walk';
          const target = npc.path[0];
          if (!target) { if (!arrive(npc, st, i)) continue; }
          else {
            const dx = target.x - npc.x;
            const dy = target.y - npc.y;
            const dist = Math.hypot(dx, dy);
            const step = WALK_SPEED * speed * dt;
            if (dist <= Math.max(step, 0.04)) {
              if (canStand(MAP, target.x, target.y)) { npc.x = target.x; npc.y = target.y; }
              npc.path.shift();
              if (!npc.path.length && !arrive(npc, st, i)) continue;
            } else {
              const moved = moveBody(MAP, npc, (dx / dist) * step, (dy / dist) * step);
              const went = Math.hypot(moved.x - npc.x, moved.y - npc.y);
              npc.x = moved.x; npc.y = moved.y;
              npc.dir = facing(dx, dy);
              // Stopped by furniture: find another way round; give up on a
              // point that cannot be reached rather than push at it for ever.
              if (moved.hit && went < step * 0.35) {
                npc.stuck += 1;
                if (npc.stuck > 3) { npc.path.shift(); npc.stuck = 0; }
                else if (npc.goal) npc.path = findPath(MAP, npc, npc.goal);
              }
            }
          }
        } else if (npc.phase === 'inspect') {
          npc.timer -= dt * speed;
          if (npc.timer <= 0) decide(npc, st);
        } else if (npc.phase === 'pause') {
          npc.timer -= dt * speed;
          if (npc.timer <= 0) {
            setBubble(npc.id, null);
            if (npc.next === 'choose') choose(npc, st); else leave(npc);
          }
        } else if (npc.phase === 'sit') {
          npc.timer -= dt * speed;
          if (npc.timer <= 0) exit(npc);
        }

        const ref = els.current.get(npc.id);
        if (ref) {
          ref.el.style.transform = placeAt(MAP, npc.x, npc.y);
          ref.el.style.zIndex = String(depthOf(npc.y));
          ref.el.style.opacity = '1';
          const spr = ref.sprite || (ref.sprite = ref.el.querySelector('.prs'));
          if (spr) {
            if (spr.dataset.dir !== npc.dir) spr.dataset.dir = npc.dir;
            if (spr.dataset.state !== pose) spr.dataset.state = pose;
          }
        }
      }
      raf = window.requestAnimationFrame(frame);
    };

    raf = window.requestAnimationFrame(frame);
    return () => {
      alive = false;
      window.cancelAnimationFrame(raf);
      window.clearTimeout(konekoTimer.current);
      S.list = []; S.last = 0;
      setNpcs([]);
    };
  }, [enabled, actions, stateRef, setBubble, addEffect]);

  return { npcs, effects, konekoState, register };
}

export default useShopSimulationLoop;
