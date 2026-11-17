/**
 * The Menu tab: everything that is not the floor, the map or the town.
 */

import { useMemo, useState } from 'react';
import { DB, ITEMS, RECIPES_BY_OUTPUT, CHARACTERS } from '../store/kobanEngine.js';
import { RequestCard } from './CustomerDeductionModal.jsx';
import KakeiboVaultLedgerTab from './KakeiboVaultLedgerTab.jsx';
import SkillCooldownDock from './SkillCooldownDock.jsx';
import RiggedCharacterPuppet from './RiggedCharacterPuppet.jsx';
import { GoldButton, Icon, Parchment, useKobanCopy } from './rpgKit.jsx';
import { ItemIcon } from './ui.jsx';

const CAST = ['koneko', 'minori', 'kaneru', 'kogane', 'mone', 'zenimaru'];

export default function MenuTab({ state, actions, nowMs, section, onSection, onOpenRequest, onNavigate }) {
  const C = useKobanCopy();
  const [mood, setMood] = useState({});
  const open = DB.customerRequests.filter((r) => r.chapter <= state.chapter && !state.solvedRequests.includes(r.id));
  const solved = DB.customerRequests.filter((r) => state.solvedRequests.includes(r.id));
  const found = useMemo(() => new Set(DB.items.filter((it) => (state.inventory[it.id] || 0) > 0 || (RECIPES_BY_OUTPUT[it.id] && state.knownRecipes.includes(RECIPES_BY_OUTPUT[it.id].id))).map((it) => it.id)), [state.inventory, state.knownRecipes]);
  const stock = Object.entries(state.inventory).filter(([id, q]) => q > 0 && ITEMS[id]);

  const entries = [
    { id: 'order', icon: 'mail', label: C.mOrder, badge: open.length },
    { id: 'ledger', icon: 'book', label: C.mLedger },
    { id: 'vault', icon: 'vault', label: C.mVault },
    { id: 'debt', icon: 'crown', label: C.mDebt },
    { id: 'book', icon: 'scroll', label: C.mBook(DB.items.length) },
    { id: 'cast', icon: 'people', label: C.mCast },
    { id: 'store', icon: 'crate', label: C.mStore },
  ];

  if (!section) {
    return (
      <Parchment className="krpg-menu" data-testid="panel-menu">
        <p className="krpg-menu__title">{C.menuTitle} · {C.chapter} {state.chapter}</p>
        <div className="krpg-menu__list">
          {entries.map((e) => (
            <GoldButton key={e.id} className="krpg-menu__btn" onClick={() => onSection(e.id)} data-testid={`menu-${e.id}`}>
              <Icon name={e.icon} size={20} />{e.label}
              {e.badge ? <span className="krpg-new">{e.badge}</span> : null}
            </GoldButton>
          ))}
        </div>
        <p className="krpg-menu__foot">
          <button type="button" className="krpg-linkbtn" onClick={() => onNavigate('/transactions')}>FinManager · catat transaksi</button>
          <button type="button" className="krpg-linkbtn" data-testid="menu-reset" onClick={() => { if (window.confirm(`${C.mReset}?`)) actions.resetSave(); }}>{C.mReset}</button>
        </p>
      </Parchment>
    );
  }

  const title = (entries.find((e) => e.id === section) || {}).label;
  return (
    <div className="krpg-menu-section" data-testid="panel-menu" data-section={section}>
      <div className="krpg-menu-section__head">
        <button type="button" className="krpg-back" onClick={() => onSection(null)} data-testid="menu-back"><Icon name="arrow" size={13} className="krpg-flip" />{C.menuTitle}</button>
        <b>{title}</b>
      </div>

      {section === 'order' ? (
        <Parchment className="krpg-pad">
          <p className="krpg-lead">{C.orderLead}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" data-testid="order-list">
            {open.map((r) => <RequestCard key={r.id} request={r} state={state} onOpen={onOpenRequest} />)}
            {solved.map((r) => <RequestCard key={r.id} request={r} state={state} solved />)}
          </div>
        </Parchment>
      ) : null}

      {section === 'ledger' || section === 'vault' || section === 'debt' ? (
        <div className="krpg-light" data-testid="panel-ledger"><KakeiboVaultLedgerTab state={state} actions={actions} /></div>
      ) : null}

      {section === 'book' ? (
        <Parchment className="krpg-pad">
          <p className="krpg-lead" data-testid="book-count">{found.size}/{DB.items.length} {C.found}</p>
          <div className="krpg-book">
            {DB.items.map((it, i) => (
              <span key={it.id} className={found.has(it.id) ? 'is-found' : 'is-unknown'} title={found.has(it.id) ? it.name : `No.${i + 1}`}>
                <img src={it.icon} alt={found.has(it.id) ? it.name : ''} loading="lazy" />
                <i>{i + 1}</i>
              </span>
            ))}
          </div>
        </Parchment>
      ) : null}

      {section === 'cast' ? (
        <Parchment className="krpg-pad">
          <div className="krpg-cast">
            {CAST.map((id) => (
              <button key={id} type="button" className="krpg-cast__one" onClick={() => setMood((m) => ({ ...m, [id]: { happy: 'think', think: 'sweat', sweat: 'walk', walk: 'happy' }[m[id] || 'happy'] }))} data-testid={`cast-${id}`}>
                <RiggedCharacterPuppet who={id} mood={mood[id] || 'happy'} size={104} />
                <b>{CHARACTERS[id]?.name || id}</b>
                <small>{CHARACTERS[id]?.role}</small>
              </button>
            ))}
          </div>
          <div className="krpg-light mt-3"><SkillCooldownDock state={state} nowMs={nowMs} onActivate={(id) => actions.activateSkill(id)} /></div>
        </Parchment>
      ) : null}

      {section === 'store' ? (
        <Parchment className="krpg-pad">
          <p className="krpg-lead">{stock.reduce((n, [, q]) => n + q, 0)} {C.storeTitle}</p>
          <div className="krpg-store">
            {stock.map(([id, q]) => <span key={id}><ItemIcon id={id} size={18} />{ITEMS[id].name} ×{q}</span>)}
          </div>
          <p className="krpg-lead mt-3">{C.logTitle}</p>
          <ul className="krpg-log">
            {state.log.length === 0 ? <li>{C.logEmpty}</li> : state.log.slice(0, 14).map((l, i) => <li key={i}>· {l.text}</li>)}
          </ul>
        </Parchment>
      ) : null}
    </div>
  );
}
