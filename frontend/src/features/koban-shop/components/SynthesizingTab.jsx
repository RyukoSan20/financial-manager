/**
 * The Synthesizing tab: the town from above, and the four workshops.
 *
 * The town is drawn. A workshop, once opened, is a small tilemap room
 * with its keeper's overworld sprite at the bench; the keeper's
 * high-resolution portrait is the puppet beside it, which is the only
 * place the painting is used - it talks, it does not walk.
 */

import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { DB, FACILITY_KEEPER, CHARACTERS, affinityHearts, purchaseRecipe, recipeProgress, recipePurchaseCost, ITEMS } from '../store/kobanEngine.js';
import { facilityMap } from '../store/shopMap.js';
import IsometricTilemapStage, { Actor } from './IsometricTilemapStage.jsx';
import ParallelRpgSprite from './ParallelRpgSprite.jsx';
import RiggedCharacterPuppet from './RiggedCharacterPuppet.jsx';
import HintCraftingModal from './HintCraftingModal.jsx';
import { GoldButton, Icon, Parchment, PatternBanner, WoodClose, useKobanCopy, useTypewriter } from './rpgKit.jsx';
import { fmt } from './ui.jsx';

const ORDER = ['restaurant', 'wizardry', 'blacksmith', 'seamstress'];
const SPOT = { restaurant: { x: 17, y: 52 }, wizardry: { x: 50, y: 21 }, blacksmith: { x: 83, y: 50 }, seamstress: { x: 50, y: 82 } };
const WORK = { restaurant: 'none', wizardry: 'staff', blacksmith: 'hammer', seamstress: 'none' };

const facilityItems = (id) => DB.items.filter((it) => it.facility === id);
const emblemOf = (id) => (facilityItems(id)[0] || {}).icon;

function Cottage({ x, y, roof, w = 30 }) {
  return (
    <g>
      <ellipse cx={x} cy={y + 15} rx={w * 0.62} ry="4" fill="#2C1B12" opacity=".18" />
      <rect x={x - w / 2} y={y - 6} width={w} height="20" fill="#FBF1D6" stroke="#4A2E12" strokeWidth="1.2" />
      <path d={`M${x - w / 2 - 4} ${y - 5} L${x} ${y - 22} L${x + w / 2 + 4} ${y - 5}Z`} fill={roof} stroke="#4A2E12" strokeWidth="1.2" />
      <rect x={x - 4} y={y + 3} width="8" height="11" rx="1" fill="#8A5A3C" stroke="#4A2E12" strokeWidth="1" />
      <rect x={x + w / 2 - 10} y={y - 1} width="6" height="6" fill="#8FD0F4" stroke="#4A2E12" strokeWidth=".9" />
    </g>
  );
}

function TownMapScene() {
  return (
    <svg viewBox="0 0 400 320" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true" data-testid="town-map-scene">
      <rect width="400" height="320" fill="#9BD37E" />
      {[[30, 40], [120, 290], [350, 30], [200, 150], [70, 200], [300, 270]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx="46" ry="26" fill="#8BC870" opacity=".7" />)}
      {/* the river and its bridge */}
      <path d="M352 0 Q322 70 346 140 Q372 210 338 320" stroke="#6FC6EE" strokeWidth="34" fill="none" />
      <path d="M352 0 Q322 70 346 140 Q372 210 338 320" stroke="#BFE8F7" strokeWidth="4" fill="none" strokeDasharray="10 16" />
      <rect x="312" y="150" width="76" height="22" rx="4" fill="#C9C2B0" stroke="#4A2E12" strokeWidth="1.3" />
      {[322, 338, 354, 370].map((x) => <path key={x} d={`M${x} 151 v20`} stroke="#9A937F" strokeWidth="1.2" />)}
      {/* the roads */}
      <path d="M200 160 L70 166 M200 160 L200 70 M200 160 L330 161 M200 160 L200 262" stroke="#E6D7B4" strokeWidth="20" strokeLinecap="round" />
      <path d="M200 160 L70 166 M200 160 L200 70 M200 160 L330 161 M200 160 L200 262" stroke="#D4C296" strokeWidth="1.4" strokeDasharray="5 7" fill="none" />
      {/* the plaza and the fountain */}
      <ellipse cx="200" cy="160" rx="62" ry="46" fill="#E6D7B4" stroke="#B8A67A" strokeWidth="1.6" />
      {Array.from({ length: 14 }, (_, i) => { const a = (i / 14) * Math.PI * 2; return <ellipse key={i} cx={200 + Math.cos(a) * 44} cy={160 + Math.sin(a) * 32} rx="6" ry="4" fill="#D4C296" />; })}
      <ellipse cx="200" cy="163" rx="22" ry="14" fill="#C9C2B0" stroke="#4A2E12" strokeWidth="1.3" />
      <ellipse cx="200" cy="161" rx="17" ry="10" fill="#8FD0F4" />
      <rect x="197" y="144" width="6" height="16" rx="2" fill="#C9C2B0" stroke="#4A2E12" strokeWidth="1" />
      <path d="M200 144 q-9 -8 -12 6 M200 144 q9 -8 12 6" stroke="#FFFFFF" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* the cottages */}
      <Cottage x={114} y={96} roof="#D9462F" /><Cottage x={286} y={92} roof="#4E7BD0" /><Cottage x={110} y={240} roof="#E8B84B" />
      <Cottage x={280} y={246} roof="#D9462F" /><Cottage x={36} y={104} roof="#4E7BD0" w={24} /><Cottage x={150} y={36} roof="#E8B84B" w={24} />
      {/* the trees */}
      {[[22, 30], [60, 262], [20, 296], [246, 34], [300, 300], [152, 284], [258, 200], [140, 196], [386, 100], [384, 240], [80, 40]].map(([x, y], i) => (
        <g key={i}><rect x={x - 2} y={y + 4} width="4" height="9" fill="#6B4A2E" /><circle cx={x} cy={y} r="11" fill={i % 2 ? '#3F8F4A' : '#4FA356'} stroke="#2F6B34" strokeWidth="1" /><circle cx={x - 3} cy={y - 3} r="3.4" fill="#6DBB5E" /></g>
      ))}
    </svg>
  );
}

function Hearts({ n }) {
  return <span className="krpg-hearts" data-testid="facility-hearts" data-hearts={n}>{[0, 1, 2, 3].map((i) => <Icon key={i} name={i < n ? 'heart' : 'heart-empty'} size={15} />)}</span>;
}

function FacilityStudio({ id, state, actions, nowMs, onClose, onCycle }) {
  const C = useKobanCopy();
  const keeper = FACILITY_KEEPER[id];
  const map = useMemo(() => facilityMap(id), [id]);
  const wares = useMemo(() => facilityItems(id).slice(0, 3), [id]);
  const [line, setLine] = useState(null);
  const [mood, setMood] = useState('happy');
  const [synth, setSynth] = useState(false);
  const text = line || C.greet[id];
  const { shown, talking } = useTypewriter(text);
  const progress = recipeProgress(state, id);
  const cost = recipePurchaseCost(state, id);
  const soldOut = progress.known >= progress.all;

  const buy = () => {
    if (soldOut) { setLine(C.recipeNone); setMood('think'); return; }
    if (state.koban < cost) { setLine(C.notEnough); setMood('sweat'); return; }
    const preview = purchaseRecipe(state, id).recipe;
    const out = actions.purchaseRecipe(id);
    const got = (out && out.recipe) || preview;
    if (got) { setLine(C.recipeBought(ITEMS[got.outputItemId]?.name || '')); setMood('happy'); }
  };

  return (
    <div className="krpg-studio" data-testid="facility-studio" data-facility={id}>
      <div className="krpg-studio__view">
        <IsometricTilemapStage map={map} className="krpg-studio__room" data-testid="facility-room">
          <Actor map={map} x={map.spots.keeper.x} y={map.spots.keeper.y} data-testid="facility-keeper-sprite">
            <ParallelRpgSprite who={keeper} dir="down" state="work" weapon={WORK[id]} size={46} className="krpg-sprite" />
          </Actor>
          {wares.map((it, i) => (
            <img key={it.id} src={it.icon} alt="" className="krpg-ware" style={{ left: `${(map.spots.wares[i].x / map.cols) * 100}%`, top: `${(map.spots.wares[i].y / map.rows) * 100}%`, zIndex: Math.floor(3.7 * 64) + 1 }} />
          ))}
        </IsometricTilemapStage>
        <div className="krpg-studio__bust">
          <RiggedCharacterPuppet who={keeper} mood={mood} isTalking={talking} size={150} draggable label={CHARACTERS[keeper]?.name} data-testid="facility-puppet" />
        </div>
        <button type="button" className="krpg-cycle krpg-cycle--prev" onClick={() => onCycle(-1)} aria-label="Previous" data-testid="facility-prev"><svg viewBox="0 0 20 28" width="18" height="26" aria-hidden="true"><path d="M17 2 L3 14 L17 26Z" fill="#F4C542" stroke="#4A2E12" strokeWidth="2" strokeLinejoin="round" /></svg></button>
        <button type="button" className="krpg-cycle krpg-cycle--next" onClick={() => onCycle(1)} aria-label="Next" data-testid="facility-next"><svg viewBox="0 0 20 28" width="18" height="26" aria-hidden="true"><path d="M3 2 L17 14 L3 26Z" fill="#F4C542" stroke="#4A2E12" strokeWidth="2" strokeLinejoin="round" /></svg></button>
      </div>

      <div className="krpg-scroll" data-testid="facility-dialogue">
        <span className="krpg-scroll__cap" aria-hidden="true" />
        <div className="krpg-scroll__body">
          <p className="krpg-scroll__head"><b>{CHARACTERS[keeper]?.name || keeper}</b><Hearts n={affinityHearts(state, id)} /></p>
          <p className="krpg-scroll__text" aria-live="polite">{shown}<span className="krpg-caret" aria-hidden="true" /></p>
        </div>
        <span className="krpg-scroll__cap" aria-hidden="true" />
      </div>

      <Parchment className="krpg-action">
        <div className="krpg-action__head">
          <img src={emblemOf(id)} alt="" width="26" height="26" />
          <b>{C.facility[id]}</b>
          <span className="krpg-dots" aria-hidden="true"><Icon name="star" size={11} /><i /><i /><i /><Icon name="star" size={11} /></span>
          <WoodClose onClick={onClose} label={C.close} />
        </div>
        <GoldButton className="krpg-action__btn" onClick={() => setSynth(true)} data-testid="facility-synthesize"><Icon name="book" size={18} />{C.synthRecipe}</GoldButton>
        <GoldButton className="krpg-action__btn" onClick={buy} data-testid="facility-buy-recipe">
          <Icon name="scroll" size={18} />{C.buyRecipe} <b data-testid="facility-progress">{progress.known}/{progress.all}</b>
          <small>{soldOut ? '' : `${fmt(cost)}G`}</small>
          {!soldOut ? <span className="krpg-new">{C.newTag}</span> : null}
        </GoldButton>
      </Parchment>

      {synth ? <HintCraftingModal key={id} state={state} actions={actions} nowMs={nowMs} open onClose={() => setSynth(false)} initialFacility={id} /> : null}
    </div>
  );
}

export default function SynthesizingTab({ state, actions, nowMs }) {
  const C = useKobanCopy();
  const [open, setOpen] = useState(null);
  const [notice, setNotice] = useState('');

  const unlockAt = useMemo(() => {
    const at = {};
    DB.meta.chapters.forEach((c) => (c.unlockedFacilities || []).forEach((f) => { if (!at[f] || c.chapter < at[f]) at[f] = c.chapter; }));
    ORDER.forEach((f) => { if (!at[f]) at[f] = 1; });
    return at;
  }, []);
  const unlocked = ORDER.filter((f) => unlockAt[f] <= state.chapter);

  const tap = (f) => {
    if (unlockAt[f] > state.chapter) { setNotice(`${C.facility[f]}: ${C.locked(unlockAt[f])}`); return; }
    setNotice(''); setOpen(f);
  };
  const cycle = (d) => {
    const list = unlocked.length ? unlocked : ORDER;
    setOpen(list[(list.indexOf(open) + d + list.length) % list.length]);
  };

  if (open) return <div data-testid="panel-synth"><FacilityStudio key={open} id={open} state={state} actions={actions} nowMs={nowMs} onClose={() => setOpen(null)} onCycle={cycle} /></div>;

  return (
    <div className="krpg-town" data-testid="panel-synth">
      <PatternBanner tone="gold" className="krpg-town__top"><b>{C.townTitle}</b><span>{C.pickFacility}</span></PatternBanner>
      <div className="krpg-stage krpg-stage--town">
        <TownMapScene />
        {ORDER.map((f) => (
          <button key={f} type="button" className={clsx('krpg-emblem', unlockAt[f] > state.chapter && 'is-locked')} style={{ left: `${SPOT[f].x}%`, top: `${SPOT[f].y}%` }} onClick={() => tap(f)} data-testid={`facility-${f}`}>
            <span className="krpg-emblem__art"><img src={emblemOf(f)} alt="" /></span>
            <span className="krpg-emblem__name">{C.facility[f]}</span>
          </button>
        ))}
        {notice ? <p className="krpg-toast" role="status" data-testid="town-notice">{notice}</p> : null}
      </div>
      <PatternBanner tone="gold" className="krpg-town__bottom" />
    </div>
  );
}
