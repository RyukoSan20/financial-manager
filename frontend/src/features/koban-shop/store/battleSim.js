/**
 * The side-view battle, as rules.
 *
 * No drawing and no clock in here: `stepBattle` is handed a slice of
 * time and says what happened in it. That is what lets the stage run
 * it at 1x or 2.5x, and what lets a test play a whole fight in a loop.
 *
 *   - Each soldier strikes the enemy at the front on their own beat.
 *   - The enemy at the front strikes one soldier on its beat.
 *   - A boss also winds up a heavy blow: a warning, then a hit on the
 *     whole party. A guard that is up when it lands takes 80% off it
 *     and answers with a critical counter from everyone standing.
 */

export const GUARD_ACTIVE_SEC = 0.9;
export const GUARD_COOLDOWN_SEC = 2.4;
export const GUARD_REDUCTION = 0.8;
export const CHARGE_WARN_SEC = 1.3;
const BEAT = { fencer: 1.05, wizard: 1.7, archer: 1.3 };
const ENEMY_BEAT = 1.7;
const BOSS_HEAVY_EVERY = 6.2;
const NEXT_ENEMY_DELAY = 0.75;

export function createBattle(soldiers, enemies) {
  return {
    t: 0,
    phase: 'fight',
    party: soldiers.map((s, i) => ({ ...s, maxHp: s.hp, cd: 0.5 + i * 0.3, actUntil: 0, hitUntil: 0 })),
    enemies: enemies.map((e) => ({ ...e, maxHp: e.hp, hitUntil: 0 })),
    idx: 0,
    enemyCd: 1.4,
    heavyIn: BOSS_HEAVY_EVERY * 0.6,
    charge: null,
    guardUntil: 0,
    guardReadyAt: 0,
    waitUntil: 0,
    guards: 0,
  };
}

export const livingParty = (b) => b.party.filter((p) => p.hp > 0);
export const frontEnemy = (b) => b.enemies[b.idx] || null;
export const guardActive = (b) => b.guardUntil > b.t;
export const guardReady = (b) => b.t >= b.guardReadyAt && b.phase === 'fight';

/** Raise the guard, if it is ready. */
export function pressGuard(b) {
  if (!guardReady(b)) return false;
  b.guardUntil = b.t + GUARD_ACTIVE_SEC;
  b.guardReadyAt = b.t + GUARD_COOLDOWN_SEC;
  return true;
}

/**
 * Advance the fight by `dt` seconds. Mutates `b` and returns the list
 * of things that happened, for the stage to draw:
 *   { type: 'strike', by, cls, dmg }      a soldier hit the front enemy
 *   { type: 'bite', target, dmg, guarded }
 *   { type: 'warn' }                      the boss started winding up
 *   { type: 'heavy', dmg, guarded }       the heavy blow landed
 *   { type: 'counter', dmg }              the guarded counter
 *   { type: 'down', enemy }               an enemy fell
 *   { type: 'fallen', target }            a soldier fell
 *   { type: 'won' } | { type: 'lost' }
 */
export function stepBattle(b, dt, rng = Math.random) {
  const events = [];
  if (b.phase !== 'fight') return events;
  b.t += dt;

  const enemy = frontEnemy(b);
  if (!enemy) { b.phase = 'won'; events.push({ type: 'won' }); return events; }

  // Between two enemies there is a breath.
  if (b.waitUntil > b.t) return events;

  const swing = (base) => Math.max(1, Math.round(base * (0.85 + rng() * 0.3)));

  const hurtEnemy = (dmg) => {
    enemy.hp = Math.max(0, enemy.hp - dmg);
    enemy.hitUntil = b.t + 0.3;
    if (enemy.hp <= 0) {
      events.push({ type: 'down', enemy: enemy.id, boss: !!enemy.boss });
      b.idx += 1;
      b.charge = null;
      b.enemyCd = ENEMY_BEAT;
      b.heavyIn = BOSS_HEAVY_EVERY * 0.6;
      b.waitUntil = b.t + NEXT_ENEMY_DELAY;
      if (b.idx >= b.enemies.length) { b.phase = 'won'; events.push({ type: 'won' }); }
      return true;
    }
    return false;
  };

  // The party.
  for (const p of b.party) {
    if (p.hp <= 0) continue;
    p.cd -= dt;
    if (p.cd <= 0) {
      p.cd += BEAT[p.cls] || 1.3;
      p.actUntil = b.t + 0.42;
      const dmg = swing(p.atk);
      events.push({ type: 'strike', by: p.id, cls: p.cls, dmg });
      if (hurtEnemy(dmg)) return events;
    }
  }

  const hurtSoldier = (p, raw) => {
    const guarded = guardActive(b);
    const dmg = Math.max(1, Math.round(raw * (guarded ? 1 - GUARD_REDUCTION : 1)));
    p.hp = Math.max(0, p.hp - dmg);
    p.hitUntil = b.t + 0.34;
    if (p.hp <= 0) events.push({ type: 'fallen', target: p.id });
    return { dmg, guarded };
  };

  // The boss's heavy blow.
  if (enemy.boss) {
    if (b.charge) {
      if (b.t >= b.charge.until) {
        const guarded = guardActive(b);
        let total = 0;
        for (const p of livingParty(b)) total += hurtSoldier(p, enemy.atk * 2.2).dmg;
        events.push({ type: 'heavy', dmg: total, guarded });
        b.charge = null;
        b.heavyIn = BOSS_HEAVY_EVERY;
        b.enemyCd = ENEMY_BEAT;
        if (guarded) {
          b.guards += 1;
          const counter = Math.round(livingParty(b).reduce((sum, p) => sum + p.atk, 0) * 1.5);
          for (const p of livingParty(b)) p.actUntil = b.t + 0.42;
          events.push({ type: 'counter', dmg: counter });
          if (hurtEnemy(counter)) return events;
        }
      }
    } else {
      b.heavyIn -= dt;
      if (b.heavyIn <= 0) {
        b.charge = { from: b.t, until: b.t + CHARGE_WARN_SEC };
        events.push({ type: 'warn' });
      }
    }
  }

  // The ordinary bite, when the boss is not winding up.
  if (!b.charge) {
    b.enemyCd -= dt;
    if (b.enemyCd <= 0) {
      b.enemyCd += ENEMY_BEAT;
      const alive = livingParty(b);
      if (alive.length) {
        const fencer = alive.find((p) => p.cls === 'fencer');
        const target = fencer && rng() < 0.6 ? fencer : alive[Math.floor(rng() * alive.length)];
        const { dmg, guarded } = hurtSoldier(target, swing(enemy.atk));
        events.push({ type: 'bite', target: target.id, dmg, guarded });
      }
    }
  }

  if (!livingParty(b).length) { b.phase = 'lost'; events.push({ type: 'lost' }); }
  return events;
}

/** Play a whole fight with no guard, or a perfect one. For tests and odds. */
export function autoPlay(soldiers, enemies, { guard = false, rng = Math.random, maxSec = 600 } = {}) {
  const b = createBattle(soldiers, enemies);
  const dt = 0.05;
  while (b.phase === 'fight' && b.t < maxSec) {
    if (guard && b.charge && b.charge.until - b.t <= GUARD_ACTIVE_SEC * 0.5) pressGuard(b);
    stepBattle(b, dt, rng);
  }
  return b;
}
