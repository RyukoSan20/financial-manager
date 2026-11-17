/**
 * The Quest tab: the world map, the drop table of a stage, the
 * soldier upgrade, and the door into the battle.
 *
 * A stage is tapped twice. The first tap frames it and shows what it
 * drops; the second spends the stamina and starts the fight.
 */

import { useState } from 'react';
import { clsx } from 'clsx';
import { SOLDIER_CLASSES, STAGES, partyLevel, soldierLevelCost, soldierStats, stageDrops } from '../store/kobanEngine.js';
import ParallelRpgSprite from './ParallelRpgSprite.jsx';
import SideViewBattleStage from './SideViewBattleStage.jsx';
import { GoldButton, Icon, Parchment, PatternBanner, RpgModal, Stars, WoodClose, useKobanCopy } from './rpgKit.jsx';
import { fmt } from './ui.jsx';

const WEAPON = { fencer: 'sword', wizard: 'staff', archer: 'bow' };

/** The valley: plains, woods, a river and its falls, a volcano, a rift. */
function WorldMapScene() {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true" data-testid="world-map-scene">
      <defs>
        <linearGradient id="wm-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7FD0F0" /><stop offset="1" stopColor="#4FB0DD" /></linearGradient>
        <linearGradient id="wm-land" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#B4E08A" /><stop offset="1" stopColor="#84C766" /></linearGradient>
        <radialGradient id="wm-rift" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#2C1B4F" /><stop offset=".7" stopColor="#6B4AA8" /><stop offset="1" stopColor="#B88CE8" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="400" height="300" fill="url(#wm-sea)" />
      {[[30, 20], [330, 280], [370, 150], [20, 250]].map(([x, y], i) => <path key={i} d={`M${x} ${y} q5 -4 10 0 q5 4 10 0`} stroke="#FFFFFF" strokeWidth="1.6" fill="none" opacity=".7" />)}
      {/* the land */}
      <path d="M26 54 Q60 14 140 22 Q210 6 286 20 Q362 22 380 84 Q396 150 366 214 Q340 280 250 284 Q160 296 84 270 Q16 246 14 168 Q8 96 26 54Z" fill="#E8D9A6" />
      <path d="M32 58 Q64 22 140 29 Q210 14 284 27 Q354 30 372 86 Q387 150 359 210 Q334 272 250 276 Q162 287 88 263 Q24 240 22 168 Q16 98 32 58Z" fill="url(#wm-land)" />
      {/* the mountains */}
      {[[232, 74, 34], [262, 62, 40], [208, 88, 26]].map(([x, y, r], i) => <g key={i}><path d={`M${x - r} ${y + r} L${x} ${y - r} L${x + r} ${y + r}Z`} fill="#A7A58E" stroke="#7D7B66" strokeWidth="1.2" /><path d={`M${x - r * 0.3} ${y - r * 0.4} L${x} ${y - r} L${x + r * 0.3} ${y - r * 0.4} l-${r * 0.15} ${r * 0.14} -${r * 0.15} -${r * 0.12} -${r * 0.15} ${r * 0.12}z`} fill="#FFFFFF" /></g>)}
      {/* the volcano */}
      <path d="M270 126 L296 62 L318 62 L346 126Z" fill="#7A4A40" stroke="#4A2E2A" strokeWidth="1.3" />
      <path d="M296 62 h22 l3 11 q-14 8 -28 0z" fill="#F0703A" /><path d="M304 70 q-6 22 2 44 M312 72 q5 16 0 34" stroke="#F4A23A" strokeWidth="3.4" fill="none" strokeLinecap="round" />
      {[[300, 48, 7], [312, 38, 9], [322, 26, 6]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill="#E8E0D8" opacity={0.85 - i * 0.2} />)}
      {/* the rift */}
      <ellipse cx="208" cy="52" rx="34" ry="19" fill="url(#wm-rift)" />
      <path d="M186 52 q10 -9 22 -2 q12 -8 22 2 q-12 9 -22 2 q-10 8 -22 -2z" fill="#1F1238" />
      {[[184, 40], [232, 42], [208, 32]].map(([x, y], i) => <path key={i} d={`M${x} ${y} l3 -9 3 9z`} fill="#D8C8F0" stroke="#FFFFFF" strokeWidth=".8" />)}
      {/* the river and the falls */}
      <path d="M248 150 Q262 172 252 196 Q238 224 268 246 Q292 262 300 284" stroke="#6FC6EE" strokeWidth="11" fill="none" strokeLinecap="round" />
      <path d="M248 150 Q262 172 252 196 Q238 224 268 246 Q292 262 300 284" stroke="#BFE8F7" strokeWidth="3" fill="none" strokeLinecap="round" strokeDasharray="6 10" />
      <rect x="236" y="118" width="22" height="36" rx="3" fill="#BFE8F7" stroke="#6FC6EE" strokeWidth="1.2" /><path d="M242 120 v32 M248 120 v32 M254 120 v32" stroke="#FFFFFF" strokeWidth="1.6" /><ellipse cx="247" cy="156" rx="19" ry="6" fill="#FFFFFF" opacity=".85" />
      <path d="M226 118 h44" stroke="#8A8872" strokeWidth="5" strokeLinecap="round" />
      {/* the woods */}
      {[[130, 118], [148, 106], [166, 122], [142, 134], [176, 106], [120, 136], [160, 140], [186, 126]].map(([x, y], i) => <g key={i}><rect x={x - 1.5} y={y + 4} width="3" height="8" fill="#6B4A2E" /><circle cx={x} cy={y} r="9.5" fill={i % 2 ? '#2F7A40' : '#3F8F4A'} stroke="#256233" strokeWidth=".9" /><circle cx={x - 3} cy={y - 3} r="3" fill="#5BB05E" /></g>)}
      {/* the plains */}
      {[[60, 190], [84, 214], [112, 196], [70, 232], [128, 226], [48, 212]].map(([x, y], i) => <g key={i}><path d={`M${x} ${y} q3 -8 6 0 M${x + 7} ${y + 2} q3 -7 6 0`} stroke="#5FA84E" strokeWidth="1.6" fill="none" strokeLinecap="round" /><circle cx={x + 14} cy={y - 2} r="2" fill={i % 2 ? '#F7A9C0' : '#FFFFFF'} /></g>)}
      {/* the village, where the shop is */}
      {[[52, 250, '#D9462F'], [70, 258, '#4E7BD0'], [38, 262, '#E8B84B']].map(([x, y, c], i) => <g key={i}><rect x={x - 6} y={y} width="12" height="9" fill="#FBF1D6" stroke="#8A5A3C" strokeWidth=".9" /><path d={`M${x - 8} ${y} l8 -7 8 7z`} fill={c} stroke="#4A2E2A" strokeWidth=".9" /></g>)}
      {/* the road between the stages */}
      <path d="M62 244 Q78 224 96 210 Q130 176 160 132 Q200 150 248 180 Q288 140 304 90 Q262 60 208 54" stroke="#F6E7C4" strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray="2 8" />
    </svg>
  );
}

function SoldierUpgradeModal({ open, state, actions, onClose }) {
  const C = useKobanCopy();
  const [burst, setBurst] = useState(null);
  const up = (id) => {
    const before = (state.soldiers || {})[id] || 1;
    actions.levelUpSoldier(id);
    setBurst(`${id}-${before}`);
    window.setTimeout(() => setBurst(null), 700);
  };
  return (
    <RpgModal open={open} onClose={onClose} testId="soldier-modal">
      <Parchment className="krpg-soldiers">
        <div className="krpg-speech"><span>{C.soldierLead}</span><WoodClose onClick={onClose} label={C.close} /></div>
        <ul>
          {SOLDIER_CLASSES.map((c) => {
            const st = soldierStats(state, c.id);
            const cost = soldierLevelCost(st.lv);
            return (
              <li key={c.id} className={clsx('krpg-soldier', burst && burst.startsWith(c.id) && 'is-up')} data-testid={`soldier-${c.id}`}>
                <span className="krpg-soldier__art"><ParallelRpgSprite who={c.who} dir="down" state="idle" weapon={WEAPON[c.id]} size={40} className="krpg-sprite" /></span>
                <span className="krpg-soldier__info">
                  <b>{c.name} <i>({c.whoLabel})</i></b>
                  <span className="krpg-soldier__stats">
                    <em data-testid={`soldier-${c.id}-lv`}>Lv.{st.lv}</em>
                    <span><Icon name="heart" size={13} />{st.hp}</span>
                    <span><Icon name="sword" size={13} />{st.atk}</span>
                  </span>
                </span>
                <GoldButton onClick={() => up(c.id)} disabled={state.koban < cost} data-testid={`soldier-${c.id}-up`}>
                  <span className="krpg-stack"><small>{C.levelUp}</small>{fmt(cost)}G</span>
                </GoldButton>
              </li>
            );
          })}
        </ul>
      </Parchment>
    </RpgModal>
  );
}

export default function QuestTab({ state, actions, onBattleChange }) {
  const C = useKobanCopy();
  const [selected, setSelected] = useState(null);
  const [upgrade, setUpgrade] = useState(false);
  const [battle, setBattle] = useState(null);
  const [notice, setNotice] = useState('');

  const stage = STAGES.find((s) => s.dungeonId === selected) || null;
  const drops = stage ? stageDrops(stage.dungeonId) : [];
  const lv = partyLevel(state);

  const tap = (id) => {
    if (selected !== id) { setSelected(id); setNotice(''); return; }
    if (state.stamina <= 0) { setNotice(C.noStamina); return; }
    const out = actions.beginBattle(id);
    if (out && out.ok) { setBattle(id); onBattleChange?.(true); }
  };

  if (battle) {
    return (
      <SideViewBattleStage
        dungeonId={battle}
        state={state}
        onFinish={(won) => actions.finishBattle(battle, won)}
        onExit={() => { setBattle(null); setSelected(null); onBattleChange?.(false); }}
      />
    );
  }

  return (
    <div className="krpg-quest" data-testid="panel-quest">
      <PatternBanner tone="sky" className="krpg-quest__top">
        {stage ? (
          <Parchment className="krpg-drops" data-testid="quest-drops">
            <p className="krpg-drops__title"><b>{stage.name}</b> — {C.itemsToObtain}</p>
            <div className="krpg-drops__row">
              {drops.map((d) => (
                <span key={d.id} className="krpg-drop" title={d.name}>
                  <img src={d.icon} alt={d.name} />
                  {d.rare ? <i className="krpg-rare">R</i> : null}
                  <b>{state.rawInventory[d.id] || 0}</b>
                </span>
              ))}
            </div>
            <p className={clsx('krpg-drops__rec', lv < stage.level && 'is-under')} data-testid="quest-rec">
              {C.recLevel}: <b>Lv.{stage.level}+</b> <span>({C.partyLv} {lv})</span>
            </p>
          </Parchment>
        ) : (
          <p className="krpg-quest__hint"><Icon name="map" size={18} />{C.worldTitle} · {C.partyLv} {lv}</p>
        )}
      </PatternBanner>

      <div className="krpg-stage krpg-stage--map">
        <WorldMapScene />
        <span className="krpg-fighter" style={{ left: '9%', top: '94%' }} data-testid="quest-koneko">
          <ParallelRpgSprite who="koneko" dir="up" state="idle" size={42} className="krpg-sprite" />
        </span>
        {STAGES.map((s) => (
          <button
            key={s.dungeonId}
            type="button"
            className={clsx('krpg-node', selected === s.dungeonId && 'is-selected', lv < s.level && 'is-hard')}
            style={{ left: `${s.x}%`, top: `${s.y}%` }}
            onClick={() => tap(s.dungeonId)}
            data-testid={`stage-${s.dungeonId}`}
            aria-pressed={selected === s.dungeonId}
          >
            {selected === s.dungeonId ? <span className="krpg-node__confirm" data-testid="stage-confirm">{C.tapConfirm}</span> : null}
            <span className="krpg-node__pin"><Stars n={s.stars} size={10} /></span>
            <span className="krpg-node__name">{s.name}</span>
            <span className="krpg-node__lv">Lv.{s.level}+</span>
          </button>
        ))}
        {notice ? <p className="krpg-toast" role="status" data-testid="quest-notice">{notice}</p> : null}
      </div>

      <PatternBanner tone="sky" className="krpg-quest__bottom">
        <GoldButton tone="wood" onClick={() => setUpgrade(true)} data-testid="soldier-upgrade"><Icon name="arrow" size={14} />{C.soldierUpgrade}</GoldButton>
      </PatternBanner>

      <SoldierUpgradeModal open={upgrade} state={state} actions={actions} onClose={() => setUpgrade(false)} />
    </div>
  );
}
