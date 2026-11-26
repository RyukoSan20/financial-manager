/**
 * Koban & Co. General Goods.
 *
 * Four tabs, as in the game it is modelled on: Shop, Quest,
 * Synthesizing, Menu. The rooms are tilemaps and the people in them
 * are overworld sprites; the character paintings appear only where a
 * character talks (the workshops, the cast page, the reports).
 *
 * The state is the store's. The clock is read on a one-second
 * heartbeat here ONLY for display (countdowns) - the idle economy
 * advances from the store's own reconcile on wake-up, and the live
 * sales come from the customers on the floor.
 */

import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { BADGES, DB } from './store/kobanEngine.js';
import { useKobanStore } from './store/useKobanStore.js';
import { fmt, mmss } from './components/ui.jsx';
import { GoldButton, Icon, Parchment, RpgModal, WoodClose, useKobanCopy } from './components/rpgKit.jsx';
import TopGoldPlaqueHud from './components/TopGoldPlaqueHud.jsx';
import ParallelShopViewport from './components/ParallelShopViewport.jsx';
import DisplaySelectModal from './components/DisplaySelectModal.jsx';
import QuestTab from './components/QuestTab.jsx';
import SynthesizingTab from './components/SynthesizingTab.jsx';
import MenuTab from './components/MenuTab.jsx';
import CustomerDeductionModal from './components/CustomerDeductionModal.jsx';
import RiggedCharacterPuppet from './components/RiggedCharacterPuppet.jsx';
import './koban.css';
import './koban-rpg.css';
import './koban-rpg-ui.css';

const TABS = [
  { id: 'shop', icon: 'shop' },
  { id: 'quest', icon: 'map' },
  { id: 'synth', icon: 'flask' },
  { id: 'menu', icon: 'menu' },
];

const useClock = () => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(id); }, []);
  return now;
};

function Dock({ tab, onTab, badge, className, testId }) {
  const C = useKobanCopy();
  return (
    <nav className={clsx('krpg-dock', className)} data-testid={testId} aria-label="Koban tabs">
      {TABS.map((t) => (
        <button key={t.id} type="button" onClick={() => onTab(t.id)} data-testid={`tab-${t.id}`} aria-current={tab === t.id ? 'page' : undefined} className={clsx('krpg-dock__btn', tab === t.id && 'is-on')}>
          <Icon name={t.icon} size={22} />
          <span>{C.tabs[t.id]}</span>
          {t.id === 'menu' && badge ? <i className="krpg-dock__badge">{badge}</i> : null}
        </button>
      ))}
    </nav>
  );
}

export default function KobanShopPage() {
  const { state, actions } = useKobanStore();
  const C = useKobanCopy();
  const nowMs = useClock();
  const navigate = useNavigate();
  const [tab, setTab] = useState('shop');
  const [menuSection, setMenuSection] = useState(null);
  const [slotId, setSlotId] = useState(null);
  const [badgeOpen, setBadgeOpen] = useState(false);
  const [requestId, setRequestId] = useState(null);

  const openRequests = DB.customerRequests.filter((r) => r.chapter <= state.chapter && !state.solvedRequests.includes(r.id));
  const goTab = (id) => { setTab(id); if (id === 'menu') setMenuSection(null); };
  const report = state.pendingOfflineReport;

  return (
    <div className="krpg-page" data-testid="koban-shop-page">
      <TopGoldPlaqueHud state={state} onBack={() => navigate('/')} />

      <Dock tab={tab} onTab={goTab} badge={openRequests.length} className="krpg-dock--inline" />
      {typeof document !== 'undefined'
        ? createPortal(<Dock tab={tab} onTab={goTab} badge={openRequests.length} className="krpg-dock--fixed" testId="koban-tabs" />, document.body)
        : null}

      {tab === 'shop' ? (
        <div data-testid="panel-shop">
          <ParallelShopViewport
            state={state}
            actions={actions}
            nowMs={nowMs}
            openRequests={openRequests.length}
            onSlotTap={setSlotId}
            onBadgeShop={() => setBadgeOpen(true)}
            onOrderBox={() => { setTab('menu'); setMenuSection('order'); }}
          />
        </div>
      ) : null}

      {tab === 'quest' ? <QuestTab state={state} actions={actions} /> : null}
      {tab === 'synth' ? <SynthesizingTab state={state} actions={actions} nowMs={nowMs} /> : null}
      {tab === 'menu' ? <MenuTab state={state} actions={actions} nowMs={nowMs} section={menuSection} onSection={setMenuSection} onOpenRequest={setRequestId} onNavigate={navigate} /> : null}

      {slotId ? <DisplaySelectModal shelfId={slotId} state={state} actions={actions} onClose={() => setSlotId(null)} /> : null}

      <RpgModal open={badgeOpen} onClose={() => setBadgeOpen(false)} testId="badge-modal">
        <Parchment className="krpg-badges">
          <div className="krpg-speech"><span>{C.badgeTitle}</span><WoodClose onClick={() => setBadgeOpen(false)} label={C.close} /></div>
          <ul>
            {BADGES.map((b) => {
              const owned = !!(state.badges || {})[b.id];
              return (
                <li key={b.id} data-testid={`badge-${b.id}`} data-owned={owned ? 'true' : 'false'}>
                  <Icon name="shield" size={26} />
                  <span><b>{b.name}</b><small>{b.desc}</small></span>
                  <GoldButton disabled={owned || state.koban < b.cost} onClick={() => actions.buyBadge(b.id)} data-testid={`badge-${b.id}-buy`}>{owned ? C.owned : `${fmt(b.cost)}G`}</GoldButton>
                </li>
              );
            })}
          </ul>
        </Parchment>
      </RpgModal>

      {requestId ? <div className="krpg-light"><CustomerDeductionModal requestId={requestId} state={state} actions={actions} onClose={() => setRequestId(null)} /></div> : null}

      <RpgModal open={!!report} onClose={() => actions.dismissOfflineReport()} testId="offline-report">
        {report ? (
          <Parchment className="krpg-report">
            <div className="krpg-speech"><span>{C.offlineTitle}</span><WoodClose onClick={() => actions.dismissOfflineReport()} label={C.close} /></div>
            <div className="krpg-report__body">
              <RiggedCharacterPuppet who="koneko" mood="happy" size={110} />
              <p><b>Koneko:</b> {mmss(report.elapsedSec)} · {report.itemsSoldCount} barang laku!<br /><b>Kaneru:</b> <em>+{fmt(report.earnedKoban)}G</em></p>
            </div>
            <GoldButton onClick={() => actions.dismissOfflineReport()}>{C.thanks}</GoldButton>
          </Parchment>
        ) : null}
      </RpgModal>
    </div>
  );
}
