/**
 * The shop floor.
 *
 * The room is a tilemap (store/shopMap.js) drawn cell by cell by
 * <IsometricTilemapStage>: there is no picture of a room under it and
 * nobody painted into it. Everyone in the room is an overworld sprite
 * standing on the grid, depth-sorted with the furniture, and the
 * customers are kept out of the furniture by their bounding boxes.
 *
 * The high-resolution character paintings are not used here. They
 * belong to the dialogue and crafting screens.
 */

import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { ITEMS, SHELVES } from '../store/kobanEngine.js';
import { SHOP_MAP, SLOT_X, depthOf } from '../store/shopMap.js';
import IsometricTilemapStage, { Actor } from './IsometricTilemapStage.jsx';
import ParallelRpgSprite from './ParallelRpgSprite.jsx';
import { Icon, useKobanCopy } from './rpgKit.jsx';
import { fmt, mmss, secondsLeft } from './ui.jsx';
import { useShopSimulationLoop } from './useShopSimulationLoop.js';

const MAP = SHOP_MAP;
const pctX = (x) => `${(x / MAP.cols) * 100}%`;
const pctY = (y) => `${(y / MAP.rows) * 100}%`;

/** The width of one cell on the screen, so a sprite stays in proportion to the grid. */
function useCellSize(ref, cols) {
  const [cell, setCell] = useState(24);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => setCell(el.getBoundingClientRect().width / cols);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, cols]);
  return cell;
}

function Bubble({ bubble }) {
  if (!bubble) return null;
  return (
    <span className="krpg-thought" aria-hidden="true">
      {bubble.type === 'item' ? <img src={bubble.icon} alt="" /> : <Icon name={bubble.type === 'smile' ? 'smile' : 'sweat'} size={16} />}
    </span>
  );
}

export default function ParallelShopViewport({ state, actions, nowMs, openRequests = 0, onSlotTap, onBadgeShop, onOrderBox }) {
  const C = useKobanCopy();
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);
  const { npcs, effects, konekoState, register } = useShopSimulationLoop({ stateRef, actions });

  const wrap = useRef(null);
  const cell = useCellSize(wrap, MAP.cols);
  const sprite = Math.round(cell * 1.55);

  const fever = state.feverModeUntil > nowMs;
  const gauge = fever ? 100 : state.kingVisitGauge;
  const popSlot = effects.find((e) => e.type === 'pop');
  const { spots } = MAP;

  return (
    <div ref={wrap} className="krpg-shopwrap">
      <IsometricTilemapStage map={MAP} className={clsx('krpg-stage--shop', fever && 'is-fever')} data-testid="parallel-shop" data-fever={fever ? 'true' : 'false'}>
        {/* the two who work here */}
        <Actor map={MAP} x={spots.kaneru.x} y={spots.kaneru.y} data-testid="shop-kaneru">
          <ParallelRpgSprite who="kaneru" dir="down" state="idle" size={sprite} className="krpg-sprite" />
        </Actor>
        <Actor map={MAP} x={spots.koneko.x} y={spots.koneko.y} data-testid="shop-koneko">
          <ParallelRpgSprite who="koneko" dir="up" state={konekoState} size={Math.round(sprite * 1.08)} className="krpg-sprite" />
        </Actor>

        {/* the customers */}
        {npcs.map((n) => (
          <span key={n.id} ref={register(n.id)} className="ktm-actor" style={{ opacity: 0 }} data-testid="shop-customer" data-kind={n.kind}>
            <Bubble bubble={n.bubble} />
            <ParallelRpgSprite who={n.kind} dir="down" state="walk" size={sprite} className="krpg-sprite" />
          </span>
        ))}

        {/* the four display slots, on the counter top */}
        {SHELVES.map((shelf, i) => {
          const slot = state.shelves.find((s) => s.id === shelf.id) || {};
          const item = slot.itemId && slot.qty > 0 ? ITEMS[slot.itemId] : null;
          return (
            <button
              key={shelf.id}
              type="button"
              className={clsx('krpg-slot', item ? 'is-stocked' : 'is-empty', popSlot && popSlot.slot === i && 'is-pop')}
              style={{ left: pctX(SLOT_X[i]), top: pctY(spots.slotY), zIndex: depthOf(12.3) + 1 }}
              onClick={() => onSlotTap(shelf.id)}
              data-testid={`display-slot-${i + 1}`}
              data-stocked={item ? 'true' : 'false'}
              aria-label={item ? `${item.name} ×${slot.qty}` : C.tapToDisplay.join(' ')}
            >
              {item ? (
                <>
                  <img src={item.icon} alt="" className="krpg-slot__icon" />
                  <span className="krpg-slot__qty">{slot.qty}</span>
                  <span className="krpg-slot__glint" aria-hidden="true" />
                </>
              ) : (
                <span className="krpg-slot__tap"><span>{C.tapToDisplay[0]}</span><span>{C.tapToDisplay[1]}</span></span>
              )}
            </button>
          );
        })}

        {/* coins, gains */}
        {effects.map((e) => {
          if (e.type === 'coin') {
            return <span key={e.id} className="krpg-coin" style={{ '--sx': `${(e.sx / MAP.cols) * 100}cqw`, '--sy': `${(e.sy / MAP.rows) * 100}cqh`, '--ex': `${(e.ex / MAP.cols) * 100}cqw`, '--ey': `${(e.ey / MAP.rows) * 100}cqh` }} aria-hidden="true"><Icon name="coin" size={16} /></span>;
          }
          if (e.type === 'gain') {
            return (
              <span key={e.id} className="krpg-gain" style={{ left: pctX(e.x), top: pctY(e.y) }} data-testid="shop-gain">
                <b>+{fmt(e.gold)}G</b><i>+{e.pop}P</i>
              </span>
            );
          }
          return null;
        })}

        {fever ? (
          <span className="krpg-rain" aria-hidden="true">
            {Array.from({ length: 16 }, (_, i) => <span key={i} style={{ left: `${(i * 37 + 9) % 100}%`, animationDelay: `${(i * 0.23) % 2.2}s`, animationDuration: `${1.9 + (i % 5) * 0.28}s` }} />)}
          </span>
        ) : null}

        {/* the plaques that float over the room */}
        <div className="krpg-hud-left">
          <button type="button" className="krpg-ribbon" onClick={onBadgeShop} data-testid="hud-badge-shop"><Icon name="shield" size={15} />{C.badgeShop}</button>
          <button type="button" className="krpg-ribbon" onClick={onOrderBox} data-testid="hud-order-box">
            <Icon name="mail" size={15} />{C.orderBox}
            {openRequests > 0 ? <span className="krpg-new">{C.newTag}</span> : null}
          </button>
        </div>
        <div className="krpg-hud-right">
          <div className="krpg-fever" data-testid="hud-fever">
            <span className="krpg-fever__label">{C.fever} <b data-testid="hud-gauge">{fever ? mmss(secondsLeft(state.feverModeUntil, nowMs)) : `${gauge}%`}</b></span>
            <span className="krpg-fever__bar"><span style={{ transform: `scaleX(${gauge / 100})` }} /></span>
          </div>
          {fever || gauge >= 100 ? <span className="krpg-bonus" data-testid="hud-bonus">{C.bonusChance}</span> : null}
        </div>
      </IsometricTilemapStage>
    </div>
  );
}
