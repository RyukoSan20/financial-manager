/**
 * The side-view battle.
 *
 * The rules are in store/battleSim.js; this is the stage they are
 * played on. One loop advances the fight and writes what changed -
 * health bars, poses, the charge ring - straight to the DOM, so the
 * fight runs at the screen's rate without a React render per frame.
 * React hears only about the things that appear and disappear:
 * projectiles, numbers, sparks, and the end.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { RAW, SOLDIER_CLASSES, STAGES, soldierStats, stageEnemies } from '../store/kobanEngine.js';
import { CHARGE_WARN_SEC, createBattle, frontEnemy, guardActive, guardReady, pressGuard, stepBattle } from '../store/battleSim.js';
import ParallelRpgSprite from './ParallelRpgSprite.jsx';
import { GoldButton, Icon, PatternBanner, useKobanCopy } from './rpgKit.jsx';
import { fmt } from './ui.jsx';

const WEAPON = { fencer: 'sword', wizard: 'staff', archer: 'bow' };
const PARTY_X = { fencer: 46, wizard: 22, archer: 33 };
const ENEMY_X = 76;
const GROUND = 84;

const SCENES = {
  plains: { sky: ['#8FD3F4', '#E3F6FF'], far: '#A9DCA0', near: '#7CC46E', ground: '#8ED07C', dirt: '#C9A26B', deco: 'flowers' },
  woods: { sky: ['#7CC9E8', '#D6F2E4'], far: '#4F9A5C', near: '#3F8450', ground: '#6DB864', dirt: '#A8824F', deco: 'trees' },
  falls: { sky: ['#7FD0F0', '#DDF6F0'], far: '#8FBFA0', near: '#6FA98A', ground: '#A6D48A', dirt: '#B89A6E', deco: 'falls' },
  volcano: { sky: ['#F0A070', '#FFE0B8'], far: '#8A5A4A', near: '#6B4038', ground: '#9A6A52', dirt: '#5C3A30', deco: 'lava' },
  rift: { sky: ['#4A3A7A', '#A88AD8'], far: '#3A2C5E', near: '#2C2148', ground: '#5E4A8A', dirt: '#33264F', deco: 'crystals' },
};

function Backdrop({ scene }) {
  const s = SCENES[scene] || SCENES.plains;
  return (
    <svg viewBox="0 0 400 240" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id={`bt-sky-${scene}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={s.sky[0]} /><stop offset="1" stopColor={s.sky[1]} /></linearGradient>
      </defs>
      <rect width="400" height="240" fill={`url(#bt-sky-${scene})`} />
      {scene !== 'rift' ? [[60, 34, 22], [84, 30, 16], [250, 50, 26], [280, 46, 18], [350, 26, 14]].map(([x, y, r], i) => <ellipse key={i} cx={x} cy={y} rx={r} ry={r * 0.4} fill="#FFFFFF" opacity=".85" />) : [[50, 30], [120, 60], [210, 24], [300, 52], [360, 20], [170, 80]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.6" fill="#FFFFFF" opacity=".8" />)}
      <path d="M0 150 Q50 96 110 132 Q160 84 230 128 Q290 92 340 124 Q375 108 400 130 V240 H0Z" fill={s.far} />
      {s.deco === 'lava' ? <><path d="M150 132 L196 62 L214 62 L262 132Z" fill="#5C3A30" /><path d="M196 62 h18 l4 12 q-13 8 -26 0z" fill="#F0703A" /><path d="M204 70 q-5 26 3 50" stroke="#F4A23A" strokeWidth="5" fill="none" strokeLinecap="round" /></> : null}
      {s.deco === 'falls' ? <><rect x="286" y="60" width="34" height="112" fill="#BFE8F7" /><path d="M292 62 v108 M303 62 v108 M314 62 v108" stroke="#FFFFFF" strokeWidth="2.5" opacity=".8" /><ellipse cx="303" cy="174" rx="34" ry="7" fill="#FFFFFF" opacity=".8" /></> : null}
      <path d="M0 174 Q70 140 140 164 Q210 134 280 162 Q340 142 400 160 V240 H0Z" fill={s.near} />
      {s.deco === 'trees' ? [18, 70, 132, 318, 374].map((x, i) => <g key={x}><rect x={x - 3} y={150 - (i % 2) * 10} width="6" height="36" fill="#6B4A2E" /><circle cx={x} cy={138 - (i % 2) * 10} r="20" fill={i % 2 ? '#3F8F4A' : '#2F7A40'} /><circle cx={x - 9} cy={148 - (i % 2) * 10} r="12" fill="#4FA356" /></g>) : null}
      {s.deco === 'crystals' ? [40, 150, 330, 372].map((x, i) => <path key={x} d={`M${x} 190 l8 -${30 + i * 6} 8 ${30 + i * 6}z`} fill={i % 2 ? '#B88CE8' : '#8EC9F0'} stroke="#FFFFFF" strokeWidth="1" opacity=".9" />) : null}
      <rect x="0" y="196" width="400" height="44" fill={s.ground} />
      <path d="M0 196 h400" stroke="#FFFFFF" strokeWidth="2" opacity=".35" />
      <rect x="0" y="222" width="400" height="18" fill={s.dirt} />
      {s.deco === 'flowers' ? [22, 96, 180, 262, 330, 384].map((x, i) => <g key={x}><path d={`M${x} 214 v-8`} stroke="#3F8F4A" strokeWidth="1.6" /><circle cx={x} cy="204" r="3" fill={i % 2 ? '#F7A9C0' : '#FFFFFF'} /><circle cx={x} cy="204" r="1.1" fill="#F4C542" /></g>) : null}
      {[40, 130, 220, 310, 380].map((x) => <path key={x} d={`M${x} 204 q3 -7 6 0 M${x + 9} 208 q3 -6 6 0`} stroke="#FFFFFF" strokeWidth="1.3" fill="none" opacity=".4" />)}
    </svg>
  );
}

export default function SideViewBattleStage({ dungeonId, state, onFinish, onExit }) {
  const C = useKobanCopy();
  const stage = STAGES.find((s) => s.dungeonId === dungeonId) || STAGES[0];

  // The fight is set up once, from the party as it was when it left.
  const setup = useMemo(() => {
    const soldiers = SOLDIER_CLASSES.map((c) => {
      const st = soldierStats(state, c.id);
      return { id: c.id, cls: c.id, who: c.who, hp: st.hp, atk: st.atk };
    });
    return { soldiers, enemies: stageEnemies(dungeonId) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dungeonId]);

  const battle = useRef(null);
  if (!battle.current) battle.current = createBattle(setup.soldiers, setup.enemies);

  const [fast, setFast] = useState(false);
  const fastRef = useRef(false);
  useEffect(() => { fastRef.current = fast; }, [fast]);

  const [enemyIdx, setEnemyIdx] = useState(0);
  const [fx, setFx] = useState([]);
  const [result, setResult] = useState(null);
  const serial = useRef(0);
  const dom = useRef({ party: {}, hp: {}, enemy: null, enemyHp: null, ring: null, warn: null, guard: null, shield: null, stage: null });
  const finishRef = useRef(onFinish);
  useEffect(() => { finishRef.current = onFinish; }, [onFinish]);

  const add = useCallback((item, life) => {
    serial.current += 1;
    const it = { ...item, id: serial.current };
    setFx((cur) => [...cur, it].slice(-22));
    window.setTimeout(() => setFx((cur) => cur.filter((f) => f.id !== it.id)), life);
  }, []);

  useEffect(() => {
    let raf = 0;
    let last = 0;
    let alive = true;
    const b = battle.current;
    const D = dom.current;

    const frame = (t) => {
      if (!alive) return;
      const real = Math.min(0.1, last ? (t - last) / 1000 : 0);
      last = t;
      const events = stepBattle(b, real * (fastRef.current ? 2.5 : 1));

      for (const e of events) {
        if (e.type === 'strike') {
          const from = PARTY_X[e.cls];
          if (e.cls === 'wizard') add({ kind: 'orb', from }, 420);
          else if (e.cls === 'archer') add({ kind: 'arrow', from }, 300);
          add({ kind: 'spark', x: ENEMY_X - 3 + Math.random() * 6, y: GROUND - 20 - Math.random() * 12 }, 380);
          add({ kind: 'dmg', x: ENEMY_X + (Math.random() * 8 - 4), y: GROUND - 36, text: e.dmg, tone: 'enemy' }, 800);
        } else if (e.type === 'bite' || e.type === 'heavy') {
          if (e.type === 'heavy') {
            add({ kind: 'flash' }, 360);
            D.stage?.classList.add('is-shake');
            window.setTimeout(() => D.stage?.classList.remove('is-shake'), 380);
          }
          const x = e.type === 'heavy' ? 34 : PARTY_X[e.target];
          add({ kind: 'dmg', x, y: GROUND - 38, text: e.dmg, tone: e.guarded ? 'guard' : 'party' }, 800);
        } else if (e.type === 'counter') {
          add({ kind: 'crit', x: ENEMY_X, y: GROUND - 46, text: e.dmg }, 1000);
          add({ kind: 'spark', x: ENEMY_X, y: GROUND - 24, big: true }, 460);
        } else if (e.type === 'down') {
          add({ kind: 'loot', x: ENEMY_X, y: GROUND - 16 }, 900);
          window.setTimeout(() => { if (alive) setEnemyIdx(b.idx); }, 420);
        } else if (e.type === 'won' || e.type === 'lost') {
          const won = e.type === 'won';
          const out = finishRef.current ? finishRef.current(won) : null;
          window.setTimeout(() => { if (alive) setResult({ won, loot: (out && out.loot) || [], gold: (out && out.gold) || 0 }); }, 700);
        }
      }

      // The poses and the bars.
      const guarding = guardActive(b);
      for (const p of b.party) {
        const el = D.party[p.id];
        if (el) {
          const pose = p.hp <= 0 ? 'down' : p.hitUntil > b.t ? 'hit' : guarding ? 'guard' : p.actUntil > b.t ? 'attack' : b.phase === 'won' ? 'cheer' : 'idle';
          if (el.dataset.pose !== pose) {
            el.dataset.pose = pose;
            const spr = el.querySelector('.prs');
            if (spr) spr.dataset.state = pose === 'down' ? 'idle' : pose;
          }
        }
        const bar = D.hp[p.id];
        if (bar) {
          const r = p.hp / p.maxHp;
          bar.style.transform = `scaleX(${r})`;
          bar.dataset.low = r < 0.35 ? 'true' : 'false';
        }
      }
      const en = frontEnemy(b);
      if (D.enemy) {
        const pose = !en ? 'gone' : en.hitUntil > b.t ? 'hit' : b.charge ? 'charge' : 'idle';
        if (D.enemy.dataset.pose !== pose) D.enemy.dataset.pose = pose;
      }
      if (D.enemyHp && en) D.enemyHp.style.transform = `scaleX(${en.hp / en.maxHp})`;
      if (D.warn) D.warn.dataset.on = b.charge ? 'true' : 'false';
      if (D.ring) D.ring.style.transform = b.charge ? `scale(${1 + 0.9 * (1 - (b.t - b.charge.from) / CHARGE_WARN_SEC)})` : 'scale(0)';
      if (D.shield) D.shield.dataset.on = guarding ? 'true' : 'false';
      if (D.guard) {
        const ready = guardReady(b);
        if (D.guard.disabled === ready) D.guard.disabled = !ready;
        D.guard.dataset.alert = b.charge && ready ? 'true' : 'false';
      }

      if (b.phase === 'fight') raf = window.requestAnimationFrame(frame);
      else raf = window.requestAnimationFrame(frame); // keep the poses settling
    };
    raf = window.requestAnimationFrame(frame);
    return () => { alive = false; window.cancelAnimationFrame(raf); };
  }, [add]);

  const guard = () => { pressGuard(battle.current); };
  const enemy = setup.enemies[Math.min(enemyIdx, setup.enemies.length - 1)];
  const cleared = enemyIdx >= setup.enemies.length;

  return (
    <div className="krpg-battle" data-testid="battle-stage" data-result={result ? (result.won ? 'won' : 'lost') : 'fighting'}>
      <PatternBanner tone="sky" className="krpg-battle__top">
        <span className="krpg-battle__title">{stage.name}</span>
        <label className="krpg-speed" data-testid="battle-speed">
          <input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} />
          <Icon name={fast ? 'check' : 'box'} size={18} />
          <span>{C.highSpeed}</span>
        </label>
      </PatternBanner>

      <div className="krpg-stage krpg-stage--battle" ref={(el) => { dom.current.stage = el; }}>
        <Backdrop scene={stage.scene} />

        {/* Koneko, cheering from the back. */}
        <span className="krpg-fighter" style={{ left: '8%', top: `${GROUND}%` }}>
          <ParallelRpgSprite who="koneko" dir="right" state="cheer" size={40} className="krpg-sprite" />
        </span>

        <span className="krpg-shield" ref={(el) => { dom.current.shield = el; }} data-on="false" aria-hidden="true" />

        {setup.soldiers.map((s) => (
          <span key={s.id} className="krpg-fighter" style={{ left: `${PARTY_X[s.cls]}%`, top: `${GROUND}%` }} ref={(el) => { dom.current.party[s.id] = el; }} data-pose="idle" data-testid={`battle-soldier-${s.id}`}>
            <span className="krpg-hp"><span ref={(el) => { dom.current.hp[s.id] = el; }} /></span>
            <ParallelRpgSprite who={s.who} dir="right" state="idle" weapon={WEAPON[s.cls]} size={46} className="krpg-sprite" />
          </span>
        ))}

        {!cleared && enemy ? (
          <span key={enemy.id} className={clsx('krpg-enemy', enemy.boss && 'is-boss')} style={{ left: `${ENEMY_X}%`, top: `${GROUND}%` }} ref={(el) => { dom.current.enemy = el; }} data-pose="idle" data-testid="battle-enemy">
            <span className="krpg-hp krpg-hp--enemy"><span ref={(el) => { dom.current.enemyHp = el; }} /></span>
            <span className="krpg-enemy__warn" ref={(el) => { dom.current.warn = el; }} data-on="false">!</span>
            <span className="krpg-enemy__ring" ref={(el) => { dom.current.ring = el; }} aria-hidden="true" />
            <span className="krpg-enemy__shadow" aria-hidden="true" />
            <img src={enemy.icon} alt={enemy.name} className="krpg-enemy__img" />
          </span>
        ) : null}

        {fx.map((f) => {
          if (f.kind === 'orb') return <span key={f.id} className="krpg-orb" style={{ '--from': `${f.from + 5}cqw`, '--to': `${ENEMY_X - 4}cqw`, top: `${GROUND - 26}%` }} aria-hidden="true"><i /><i /></span>;
          if (f.kind === 'arrow') return <span key={f.id} className="krpg-arrow" style={{ '--from': `${f.from + 5}cqw`, '--to': `${ENEMY_X - 4}cqw`, top: `${GROUND - 22}%` }} aria-hidden="true" />;
          if (f.kind === 'spark') return <svg key={f.id} className={clsx('krpg-spark', f.big && 'is-big')} style={{ left: `${f.x}%`, top: `${f.y}%` }} viewBox="0 0 40 40" aria-hidden="true"><path d="M20 0 l4 13 13 -6 -7 12 10 9 -14 -1 -2 13 -6 -12 -13 5 8 -11 -11 -8 14 -1z" fill="#FF9A3C" stroke="#FFF0B8" strokeWidth="1.6" /></svg>;
          if (f.kind === 'dmg') return <span key={f.id} className={`krpg-dmg krpg-dmg--${f.tone}`} style={{ left: `${f.x}%`, top: `${f.y}%` }}>{f.text}</span>;
          if (f.kind === 'crit') return <span key={f.id} className="krpg-dmg krpg-dmg--crit" style={{ left: `${f.x}%`, top: `${f.y}%` }}>CRITICAL {f.text}!</span>;
          if (f.kind === 'loot') return <span key={f.id} className="krpg-loot" style={{ left: `${f.x}%`, top: `${f.y}%` }} aria-hidden="true"><Icon name="crate" size={20} /><Icon name="coin" size={16} /></span>;
          if (f.kind === 'flash') return <span key={f.id} className="krpg-flash" aria-hidden="true" />;
          return null;
        })}

        {result ? (
          <div className="krpg-result" data-testid="battle-result">
            <p className={clsx('krpg-result__title', result.won ? 'is-won' : 'is-lost')}>{result.won ? C.victory : C.defeat}</p>
            {result.won ? (
              <>
                <p className="krpg-result__lead">{C.loot} · +{fmt(result.gold)}G</p>
                <div className="krpg-result__loot">
                  {Object.entries(result.loot.reduce((m, id) => ({ ...m, [id]: (m[id] || 0) + 1 }), {})).map(([id, n]) => (
                    <span key={id} title={RAW[id]?.name}><img src={RAW[id]?.icon} alt={RAW[id]?.name || ''} /><b>×{n}</b></span>
                  ))}
                </div>
              </>
            ) : null}
            <GoldButton onClick={onExit} data-testid="battle-exit">{C.backToMap}</GoldButton>
          </div>
        ) : null}
      </div>

      <PatternBanner tone="sky" className="krpg-battle__bottom">
        <button type="button" className="krpg-guard" onPointerDown={guard} onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') guard(); }} ref={(el) => { dom.current.guard = el; }} data-alert="false" data-testid="battle-guard">
          <Icon name="shield" size={26} />{C.guard}
        </button>
      </PatternBanner>
    </div>
  );
}
