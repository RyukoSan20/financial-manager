/**
 * "Please select the items to display."
 *
 * Two parchment cards. The top one is the spec of the item under the
 * cursor; the bottom one is the storeroom as a four-column grid. The
 * first tap on an item selects it (a green double frame, and
 * `TapToConfirm` above it); the second tap puts it on the counter.
 */

import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { DB, ITEMS, ITEM_NUMBER, SHELVES, itemBonus, itemPopularity } from '../store/kobanEngine.js';
import { GoldButton, Icon, Parchment, RpgModal, WoodClose, useKobanCopy } from './rpgKit.jsx';
import { fmt } from './ui.jsx';

const MASTERY_CAP = 15;
const SORTS = ['price', 'qty', 'pop'];

export default function DisplaySelectModal({ shelfId, state, actions, onClose }) {
  const C = useKobanCopy();
  const shelf = SHELVES.find((s) => s.id === shelfId);
  const slot = state.shelves.find((s) => s.id === shelfId);
  const [selected, setSelected] = useState(null);
  const [sort, setSort] = useState('price');

  const stock = useMemo(() => {
    const list = Object.entries(state.inventory)
      .filter(([, q]) => q > 0)
      .map(([id, qty]) => ({ ...ITEMS[id], qty, pop: itemPopularity(id) }))
      .filter((x) => x.id);
    const by = {
      price: (a, b) => b.sellPrice - a.sellPrice,
      qty: (a, b) => b.qty - a.qty,
      pop: (a, b) => b.pop - a.pop || b.sellPrice - a.sellPrice,
    }[sort];
    return list.sort(by);
  }, [state.inventory, sort]);

  if (!shelf || !slot) return null;

  const onCounter = slot.itemId && slot.qty > 0 ? ITEMS[slot.itemId] : null;
  const shown = (selected && stock.find((s) => s.id === selected)) || (onCounter ? { ...onCounter, qty: slot.qty, pop: itemPopularity(onCounter.id) } : stock[0]) || null;
  const facility = shown ? DB.facilities.find((f) => f.id === shown.facility) : null;
  const mastery = shown ? Math.min(MASTERY_CAP, (state.mastery || {})[shown.id] || 0) : 0;

  const confirm = (id) => {
    // Something else on the slot goes back to the storeroom first.
    if (slot.itemId && slot.itemId !== id && slot.qty > 0) actions.clearShelf(shelfId);
    actions.restockShelf(shelfId, id, state.inventory[id] || 0);
    onClose();
  };

  const tap = (id) => (selected === id ? confirm(id) : setSelected(id));

  const recommend = () => {
    // The best earner: price, weighted by how much the town wants it.
    const best = [...stock].sort((a, b) => b.sellPrice * (0.7 + 0.15 * b.pop) - a.sellPrice * (0.7 + 0.15 * a.pop))[0];
    if (best) setSelected(best.id);
  };

  return (
    <RpgModal open onClose={onClose} testId="display-select-modal" className="krpg-display">
      {/* the spec card */}
      <Parchment className="krpg-spec" data-testid="display-spec">
        {shown ? (
          <>
            <span className="krpg-spec__icon"><img src={shown.icon} alt="" width="48" height="48" /></span>
            <dl className="krpg-spec__rows">
              <div><dt>{C.no}{ITEM_NUMBER[shown.id]}</dt><dd className="is-name" data-testid="display-spec-name">{shown.name}</dd></div>
              <div><dt>{C.get}</dt><dd>{facility ? C.facility[facility.id] : '-'}</dd></div>
              <div className="is-split">
                <span><dt>{C.price}</dt><dd>{fmt(shown.sellPrice)}G</dd></span>
                <span><dt>{C.popularity}</dt><dd>{C[`pop${shown.pop}`]}</dd></span>
              </div>
              <div className="is-split">
                <span><dt>{C.bonus}</dt><dd>{itemBonus(shown.id)}</dd></span>
                <span className="krpg-mastery" title={`${mastery}/${MASTERY_CAP}`}>
                  <span className="krpg-mastery__bar"><span style={{ transform: `scaleX(${mastery / MASTERY_CAP})` }} /></span>
                  <b>{mastery}/{MASTERY_CAP}</b>
                </span>
              </div>
            </dl>
          </>
        ) : (
          <p className="krpg-spec__empty">{C.emptyStore}</p>
        )}
      </Parchment>

      {/* the storeroom */}
      <Parchment className="krpg-grid-card">
        <div className="krpg-speech">
          <span>{C.selectTitle}</span>
          <WoodClose onClick={onClose} label={C.close} />
        </div>

        <div className="krpg-inv" data-testid="display-grid">
          {stock.length === 0 ? <p className="krpg-inv__empty">{C.emptyStore}</p> : null}
          {stock.map((it) => (
            <button
              key={it.id}
              type="button"
              className={clsx('krpg-cell', selected === it.id && 'is-selected')}
              onClick={() => tap(it.id)}
              data-testid={`display-item-${it.id}`}
              aria-pressed={selected === it.id}
              aria-label={`${it.name} ×${it.qty}`}
            >
              {selected === it.id ? <span className="krpg-cell__confirm" data-testid="display-confirm">{C.tapToConfirm}</span> : null}
              <img src={it.icon} alt="" loading="lazy" />
              <span className="krpg-cell__qty">{it.qty}</span>
              <span className="krpg-cell__pop"><span style={{ transform: `scaleX(${it.pop / 3})` }} /></span>
            </button>
          ))}
        </div>

        <div className="krpg-display__foot">
          <button type="button" className="krpg-sort" onClick={() => setSort(SORTS[(SORTS.indexOf(sort) + 1) % SORTS.length])} data-testid="display-sort" data-sort={sort}>
            <span>{C.sortOrder}</span>
            <b>{{ price: C.sortPrice, qty: C.sortQty, pop: C.sortPop }[sort]}</b>
          </button>
          <GoldButton tone="coral" onClick={recommend} disabled={!stock.length} data-testid="display-recommend">
            <Icon name="arrow" size={14} />{C.recommended}
          </GoldButton>
        </div>
        {onCounter ? (
          <button type="button" className="krpg-linkbtn" onClick={() => { actions.clearShelf(shelfId); onClose(); }} data-testid="display-takeback">
            {C.takeBack}: {onCounter.name} ×{slot.qty}
          </button>
        ) : null}
      </Parchment>
    </RpgModal>
  );
}
