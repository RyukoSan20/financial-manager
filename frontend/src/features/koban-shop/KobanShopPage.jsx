/**
 * Koban & Co. General Goods.
 *
 * The page holds the HUD, the skill dock, and five tabs. The state is
 * the store's; the clock is read on a one-second heartbeat here ONLY
 * for display (cooldown rings, countdowns) - the economy never
 * advances from this timer, it advances from the store's own
 * reconcile on wake-up, which is what keeps it honest in a background
 * tab.
 */

import { useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { DB, ITEMS, SHELVES } from './store/kobanEngine.js';
import { useKobanStore } from './store/useKobanStore.js';
import { Button, Card, ItemIcon, Pill, Sheet, SectionTitle, fmt, mmss, secondsLeft } from './components/ui.jsx';
import SkillCooldownDock from './components/SkillCooldownDock.jsx';
import IsometricAtelierStage from './components/IsometricAtelierStage.jsx';
import HintCraftingModal from './components/HintCraftingModal.jsx';
import CustomerDeductionModal, { RequestCard } from './components/CustomerDeductionModal.jsx';
import DungeonExpeditionTab from './components/DungeonExpeditionTab.jsx';
import KakeiboVaultLedgerTab from './components/KakeiboVaultLedgerTab.jsx';
import './koban.css';

const TABS = [
  { id: 'shop', label: 'Shop', icon: '🏪' },
  { id: 'craft', label: 'Craft', icon: '⚒️' },
  { id: 'dungeon', label: 'Dungeon', icon: '⚔️' },
  { id: 'requests', label: 'Requests', icon: '💬' },
  { id: 'ledger', label: 'Ledger', icon: '📒' },
];

const useClock = () => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(id); }, []);
  return now;
};

export default function KobanShopPage() {
  const { state, actions } = useKobanStore();
  const nowMs = useClock();
  const navigate = useNavigate();
  const [tab, setTab] = useState('shop');

  // The companion who just fired a skill celebrates for a moment.
  const [celebratingId, setCelebratingId] = useState(null);
  useEffect(() => {
    if (!celebratingId) return undefined;
    const id = window.setTimeout(() => setCelebratingId(null), 1400);
    return () => window.clearTimeout(id);
  }, [celebratingId]);
  const [restockShelfId, setRestockShelfId] = useState(null);
  const [requestId, setRequestId] = useState(null);

  const fever = state.feverModeUntil > nowMs;
  const stock = useMemo(() => Object.entries(state.inventory).filter(([, q]) => q > 0).map(([id, q]) => ({ ...ITEMS[id], qty: q })).filter((x) => x.id), [state.inventory]);
  const openRequests = DB.customerRequests.filter((r) => r.chapter <= state.chapter && !state.solvedRequests.includes(r.id));
  const solvedRequests = DB.customerRequests.filter((r) => state.solvedRequests.includes(r.id));
  const chapter = DB.meta.chapters.find((c) => c.chapter === state.chapter);

  return (
    <div className="koban-page mx-auto max-w-6xl pb-24 lg:pb-6" data-testid="koban-shop-page">
      {/* HUD */}
      <Card className="koban-hud mb-3 p-3" data-testid="koban-hud">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <Pill>{DB.meta.gameTitle.toUpperCase()}</Pill>
            <h1 className="mt-1 text-[1.15rem] font-extrabold tracking-[0.02em] text-[#2C221E]">Bab {state.chapter} · {chapter?.title}</h1>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Pill tone="cream" className="text-[12px]" data-testid="hud-koban">🪙 {fmt(state.koban)} K</Pill>
            <Pill tone="sakura" className="text-[12px]" data-testid="hud-gems">💎 {state.gems}</Pill>
            <Pill tone="sage" className="text-[12px]" data-testid="hud-rank">{'★'.repeat(state.rank)}{'☆'.repeat(5 - state.rank)} Rank</Pill>
            <Pill tone="ghost" className="text-[12px]">rep {state.reputation}</Pill>
            <Pill tone="ghost" className="text-[12px]">⚡ {state.stamina}/{state.staminaMax}</Pill>
          </div>
        </div>
        {/* King's Visit gauge */}
        <div className="mt-2.5">
          <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#8A7F72]">
            <span>👑 King&apos;s Visit Gauge</span>
            <span data-testid="hud-gauge">{fever ? `FEVER ${mmss(secondsLeft(state.feverModeUntil, nowMs))}` : `${state.kingVisitGauge}%`}</span>
          </div>
          <button type="button" onClick={() => actions.triggerFever()} disabled={state.kingVisitGauge < 100} className="mt-1 block h-3.5 w-full overflow-hidden rounded-full border-2 border-[#4A3540] bg-[#F4EFE6] disabled:cursor-default" aria-label="Royal Fever" data-testid="gauge-bar">
            <span className={clsx('block h-full rounded-full transition-[width] duration-500', fever ? 'koban-gauge--fever' : 'bg-gradient-to-r from-[#E8B84B] to-[#D96B43]')} style={{ width: fever ? '100%' : `${state.kingVisitGauge}%` }} />
          </button>
        </div>
        <div className="mt-2">
          <SkillCooldownDock
            state={state}
            nowMs={nowMs}
            onActivate={(id) => {
              actions.activateSkill(id);
              setCelebratingId(id);
            }}
          />
        </div>
      </Card>

      {/* The tabs.
          *
          * Two of them, on purpose. The desktop one sits in the flow
          * beside the panels. The phone one is FIXED, and a fixed
          * element inside the app's canvas is pinned to the canvas
          * rather than to the window - the canvas carries a transform
          * for its entrance animation, and a transform makes an
          * element the containing block for its fixed descendants.
          * The phone bar therefore goes through a portal onto
          * document.body, the same way the command bar does. */}
      <nav className="koban-tabs koban-tabs--inline hidden lg:flex lg:mb-3 lg:items-center lg:justify-start lg:gap-1.5 lg:rounded-full lg:border-2 lg:border-[#4A3540] lg:bg-[#FFFDF9]/95 lg:px-2 lg:py-1.5 lg:shadow-[0_4px_0_#DFD3C3]" aria-label="Koban tabs">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} data-testid={`tab-${t.id}`} aria-current={tab === t.id ? 'page' : undefined}
            className={clsx('flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-extrabold transition-transform active:scale-95', tab === t.id ? 'bg-[#2F4842] text-white' : 'text-[#4A3540]')}>
            <span className="text-[14px]">{t.icon}</span>{t.label}
            {t.id === 'requests' && openRequests.length ? <span className="ml-0.5 rounded-full bg-[#D96B43] px-1.5 text-[9px] text-white">{openRequests.length}</span> : null}
          </button>
        ))}
      </nav>

      {typeof document !== 'undefined'
        ? createPortal(
            <nav className="koban-tabs koban-tabs--fixed fixed inset-x-0 z-40 flex justify-around border-t-2 border-[#4A3540] bg-[#FFFDF9]/95 px-1 py-1.5 backdrop-blur lg:hidden" data-testid="koban-tabs" aria-label="Koban tabs">
              {TABS.map((t) => (
                <button key={t.id} type="button" onClick={() => setTab(t.id)} data-testid={`tab-${t.id}`} aria-current={tab === t.id ? 'page' : undefined}
                  className={clsx('flex flex-col items-center rounded-full px-3 py-1 text-[10.5px] font-extrabold transition-transform active:scale-95', tab === t.id ? 'bg-[#2F4842] text-white' : 'text-[#4A3540]')}>
                  <span className="text-[16px]">{t.icon}</span>{t.label}
                  {t.id === 'requests' && openRequests.length ? <span className="ml-0.5 rounded-full bg-[#D96B43] px-1.5 text-[9px] text-white">{openRequests.length}</span> : null}
                </button>
              ))}
            </nav>,
            document.body
          )
        : null}

      {/* Panels */}
      {tab === 'shop' ? (
        <div className="space-y-3" data-testid="panel-shop">
          <IsometricAtelierStage
            state={state}
            nowMs={nowMs}
            onShelfTap={setRestockShelfId}
            onCustomerTap={(id) => setRequestId(id)}
            celebratingId={celebratingId}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Card className="p-3">
              <SectionTitle badge="GUDANG" title={`${stock.reduce((a, s) => a + s.qty, 0)} barang siap jual`} lead="Ketuk rak di toko untuk menata." />
              <div className="flex flex-wrap gap-1.5">
                {stock.length === 0 ? <p className="text-[12px] text-[#8A7F72]">Kosong. Buka tab Craft.</p> : stock.slice(0, 16).map((s) => <span key={s.id} className="flex items-center gap-1 rounded-full border border-[#4A3540]/30 bg-white px-2 py-0.5 text-[10.5px] font-bold"><ItemIcon id={s.id} size={16} />{s.name} ×{s.qty}</span>)}
              </div>
            </Card>
            <Card className="p-3">
              <SectionTitle badge="BUKU HARIAN" title="Catatan toko" />
              <ul className="max-h-40 space-y-1 overflow-y-auto text-[11px] text-[#4A3540]">
                {state.log.length === 0 ? <li className="text-[#8A7F72]">Belum ada catatan.</li> : state.log.slice(0, 12).map((l, i) => <li key={i}>· {l.text}</li>)}
              </ul>
            </Card>
          </div>
        </div>
      ) : null}

      {tab === 'craft' ? <div data-testid="panel-craft"><HintCraftingModal state={state} actions={actions} nowMs={nowMs} embedded /></div> : null}
      {tab === 'dungeon' ? <div data-testid="panel-dungeon"><DungeonExpeditionTab state={state} actions={actions} nowMs={nowMs} /></div> : null}

      {tab === 'requests' ? (
        <div className="space-y-3" data-testid="panel-requests">
          <SectionTitle badge="MEJA PAYUNG KOGANE" title={`${openRequests.length} permintaan terbuka`} lead="Sempurna 150% · Cocok 100% · Salah 0% (barang kembali)." />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {openRequests.map((r) => <RequestCard key={r.id} request={r} state={state} onOpen={setRequestId} />)}
            {solvedRequests.map((r) => <RequestCard key={r.id} request={r} state={state} solved />)}
          </div>
        </div>
      ) : null}

      {tab === 'ledger' ? <div data-testid="panel-ledger"><KakeiboVaultLedgerTab state={state} actions={actions} /></div> : null}

      {/* Restock drawer */}
      <Sheet open={!!restockShelfId} onClose={() => setRestockShelfId(null)} title={`Isi ${SHELVES.find((s) => s.id === restockShelfId)?.name || ''}`}>
        <div data-testid="restock-drawer">
          {stock.length === 0 ? <p className="text-[12px] text-[#8A7F72]">Gudang kosong. Racik dulu di tab Craft.</p> : null}
          <div className="grid grid-cols-2 gap-2">
            {stock.map((s) => (
              <button key={s.id} type="button" data-testid={`restock-${s.id}`} onClick={() => { actions.restockShelf(restockShelfId, s.id, s.qty); setRestockShelfId(null); }}
                className="flex items-center gap-2 rounded-xl border-2 border-[#4A3540]/30 bg-white p-2 text-left transition-transform active:scale-95">
                <ItemIcon id={s.id} size={34} />
                <span className="min-w-0"><span className="block truncate text-[12px] font-extrabold text-[#2C221E]">{s.name}</span><span className="text-[10.5px] text-[#8A7F72]">×{s.qty} · {fmt(s.sellPrice)} K</span></span>
              </button>
            ))}
          </div>
        </div>
      </Sheet>

      {/* Deduction modal */}
      {requestId ? <CustomerDeductionModal requestId={requestId} state={state} actions={actions} onClose={() => setRequestId(null)} /> : null}

      {/* Offline earnings */}
      <Sheet open={!!state.pendingOfflineReport} onClose={() => actions.dismissOfflineReport()} title="Laporan Saat Toko Ditinggal">
        {state.pendingOfflineReport ? (
          <div data-testid="offline-report">
            <div className="flex gap-2">
              <img src={DB.characters[0].face} alt="Koneko" className="h-12 w-12 rounded-full border-2 border-[#4A3540] object-cover" />
              <img src={DB.characters[2].face} alt="Kaneru" className="h-12 w-12 rounded-full border-2 border-[#4A3540] object-cover" />
            </div>
            <p className="mt-2 text-[13px] text-[#2C221E]"><strong>Koneko:</strong> Selama {mmss(state.pendingOfflineReport.elapsedSec)} kamu pergi, {state.pendingOfflineReport.itemsSoldCount} barang laku!</p>
            <p className="mt-1 text-[13px] text-[#2C221E]"><strong>Kaneru:</strong> Pemasukan tercatat <span className="font-extrabold text-[#2F4842]">+{fmt(state.pendingOfflineReport.earnedKoban)} Koban</span>.</p>
            <Button className="mt-3 w-full" onClick={() => actions.dismissOfflineReport()}>Terima kasih!</Button>
          </div>
        ) : null}
      </Sheet>

      <p className="mt-6 text-center text-[10px] text-[#8A7F72]">
        Simpanan lokal · <button type="button" className="underline" onClick={() => { if (window.confirm('Mulai ulang toko dari awal?')) actions.resetSave(); }}>mulai ulang</button> · <button type="button" className="underline" onClick={() => navigate('/transactions')}>catat transaksi asli</button>
      </p>
    </div>
  );
}
