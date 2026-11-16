/**
 * The ledger.
 *
 * Four things that are about money rather than about the shop floor:
 * the royal debt, paid in stages; Mone's vault, which compounds;
 * the bridge to the reader's real finances; and the encyclopedia of
 * everything the shop can make.
 */

import { useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { DB, ITEMS } from '../store/kobanEngine.js';
import { useKakeiboSnapshot } from '../store/useKobanStore.js';
import { Button, Card, ItemIcon, Pill, SectionTitle, fmt } from './ui.jsx';

export default function KakeiboVaultLedgerTab({ state, actions }) {
  const [deposit, setDeposit] = useState(100);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [snapshot, setSnapshot] = useState(null);
  const [claimed, setClaimed] = useState(null);
  const bridge = useKakeiboSnapshot();

  useEffect(() => {
    let alive = true;
    bridge.load().then((s) => { if (alive) setSnapshot(s); }).catch((err) => { if (alive) setSnapshot({ ...bridge.empty, error: String(err?.message || err) }); });
    return () => { alive = false; };
  }, [bridge]);

  const stages = DB.meta.debtStages;
  const paidStages = useMemo(() => { let acc = 0; let n = 0; for (const s of stages) { acc += s; if (state.debtPaid >= acc) n += 1; } return n; }, [state.debtPaid, stages]);
  const nextDue = useMemo(() => { let acc = 0; for (const s of stages) { acc += s; if (state.debtPaid < acc) return acc - state.debtPaid; } return 0; }, [state.debtPaid, stages]);
  const debtLeft = DB.meta.kingdomDebtTotal - state.debtPaid;

  const items = useMemo(() => DB.items.filter((it) => (filter === 'all' || it.facility === filter) && (!query || it.name.toLowerCase().includes(query.toLowerCase()))), [filter, query]);

  const claim = () => { if (!snapshot) return; const out = actions.claimKakeibo(snapshot); setClaimed(out ? out.rewards : []); };

  return (
    <div className="space-y-3" data-testid="ledger-tab">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        {/* The debt. */}
        <Card className="p-3 lg:col-span-5" data-testid="royal-debt">
          <SectionTitle badge="UTANG KERAJAAN" title={`${fmt(debtLeft)} Koban tersisa`} lead={`${paidStages}/${stages.length} tahap lunas · cicilan mingguan ${fmt(DB.meta.weeklyDebtInstallment)}`} />
          <div className="h-3 w-full overflow-hidden rounded-full border-2 border-[#4A3540] bg-[#F4EFE6]">
            <span className="block h-full rounded-full bg-gradient-to-r from-[#2F4842] to-[#8FBFA8]" style={{ width: `${Math.round((state.debtPaid / DB.meta.kingdomDebtTotal) * 100)}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {stages.map((s, i) => <Pill key={i} tone={i < paidStages ? 'sage' : 'ghost'}>T{i + 1} · {fmt(s)}</Pill>)}
          </div>
          <Button className="mt-3 w-full" onClick={() => actions.payDebtStage()} disabled={nextDue <= 0 || state.koban < nextDue} data-testid="pay-debt">
            {nextDue <= 0 ? 'Lunas! Restu Sang Raja' : `Bayar tahap ${paidStages + 1} · ${fmt(nextDue)} K`}
          </Button>
        </Card>

        {/* The vault. */}
        <Card
          className="koban-vault relative overflow-hidden p-3 lg:col-span-7"
          data-testid="mone-vault"
          style={{ '--koban-vault-scene': `url(${DB.meta.scenes.vault})` }}
        >
          <SectionTitle badge="BRANKAS MONE" title={`${fmt(state.vault.balance)} Koban tersimpan`} lead={`Bunga majemuk ${(DB.meta.vaultInterestPerHour * 100).toFixed(1)}% per jam nyata · total bunga ${fmt(state.vault.totalInterestEarned)}`} />
          <div className="flex flex-wrap items-center gap-2">
            <input type="number" min="1" value={deposit} onChange={(e) => setDeposit(Number(e.target.value) || 0)} className="w-28 rounded-full border-2 border-[#4A3540] px-3 py-1.5 text-[12.5px] font-bold text-[#2C221E]" aria-label="Jumlah" data-testid="vault-amount" />
            <Button size="sm" onClick={() => actions.depositVault(deposit)} disabled={deposit <= 0 || state.koban < 1} data-testid="vault-deposit">Setor</Button>
            <Button size="sm" tone="ghost" onClick={() => actions.withdrawVault(deposit)} disabled={state.vault.balance <= 0} data-testid="vault-withdraw">Tarik</Button>
            <span className="text-[11px] text-[#8A7F72]">Skill Mone: bunga instan 5% dari saldo.</span>
          </div>
        </Card>
      </div>

      {/* The bridge. */}
      <Card className="p-3" data-testid="kakeibo-bridge">
        <SectionTitle badge="JEMBATAN KAKEIBO" title="Hadiah dari catatan keuangan asli" lead="Game membaca transaksi, anggaran, dan tujuan dari akunmu — bukan dari game." />
        {!snapshot ? <p className="text-[12px] text-[#8A7F72]">Membaca catatan…</p> : (
          <>
            <dl className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border border-[#4A3540]/25 bg-[#FFF6D6] p-2"><dt className="text-[9px] font-bold uppercase text-[#8A7F72]">Transaksi hari ini</dt><dd className="text-[18px] font-extrabold text-[#2C221E]" data-testid="tx-today">{snapshot.transactionsToday}</dd></div>
              <div className="rounded-xl border border-[#4A3540]/25 bg-[#E3F2EA] p-2"><dt className="text-[9px] font-bold uppercase text-[#8A7F72]">Anggaran aman</dt><dd className="text-[18px] font-extrabold text-[#1F3A2E]">{snapshot.budgetsUnder}/{snapshot.budgetsTotal}</dd></div>
              <div className="rounded-xl border border-[#4A3540]/25 bg-[#FDE8E4] p-2"><dt className="text-[9px] font-bold uppercase text-[#8A7F72]">Tujuan</dt><dd className="text-[18px] font-extrabold text-[#9E3B24]">{snapshot.goalsProgress}%</dd></div>
            </dl>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button tone="terracotta" size="sm" onClick={claim} data-testid="claim-kakeibo">Klaim Hadiah Hari Ini</Button>
              <span className="text-[11px] text-[#5C6460]">Zenimaru: tiket stamina untuk tiap hari mencatat · Mone: peti +400 K & 3 permata bila semua anggaran aman bulan ini.</span>
            </div>
            {claimed ? (
              <p className="mt-2 text-[12px] font-bold text-[#2F4842]" data-testid="kakeibo-claimed">
                {claimed.length === 0 ? 'Belum ada yang bisa diklaim hari ini. Catat transaksi dulu!' : claimed.map((r) => (r.kind === 'stamina' ? `+${r.amount} stamina` : `Peti: +${r.koban} K, +${r.gems} permata`)).join(' · ')}
              </p>
            ) : null}
            {snapshot.error ? <p className="mt-1 text-[10.5px] text-[#9E3B24]">Tidak bisa membaca API: {snapshot.error}</p> : null}
          </>
        )}
      </Card>

      {/* The encyclopedia. */}
      <Card className="p-3" data-testid="encyclopedia">
        <SectionTitle badge="ENSIKLOPEDIA" title={`${DB.items.length} barang · ${DB.meta.svgCount} ikon 8-bit`} />
        <div className="mb-2 flex flex-wrap gap-1.5">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari…" className="w-36 rounded-full border-2 border-[#4A3540]/40 px-3 py-1 text-[12px]" aria-label="Cari barang" />
          {['all', ...DB.facilities.map((f) => f.id)].map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)} className={clsx('rounded-full border-2 px-2.5 py-0.5 text-[11px] font-bold active:scale-95', filter === f ? 'border-[#4A3540] bg-[#2F4842] text-white' : 'border-[#4A3540]/30 bg-white text-[#4A3540]')}>
              {f === 'all' ? 'Semua' : DB.facilities.find((x) => x.id === f).name}
            </button>
          ))}
        </div>
        <div className="grid max-h-[50vh] grid-cols-3 gap-1.5 overflow-y-auto sm:grid-cols-5 lg:grid-cols-8">
          {items.map((it) => {
            const known = state.knownRecipes.includes(`recipe_${it.id.replace(/^item_/, '')}`);
            return (
              <div key={it.id} className={clsx('rounded-xl border p-1.5 text-center', known ? 'border-[#4A3540]/40 bg-white' : 'border-dashed border-[#4A3540]/25 bg-white/60')} title={`${it.name} · ${it.tags.join(', ')}`}>
                <ItemIcon id={it.id} size={36} className={known ? '' : 'opacity-50 grayscale'} />
                <p className="mt-0.5 truncate text-[9.5px] font-bold text-[#2C221E]">{it.name}</p>
                <p className="text-[8.5px] text-[#8A7F72]">T{it.tier} · {fmt(it.sellPrice)}</p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* The story. */}
      <Card className="p-3" data-testid="story-archive">
        <SectionTitle badge="ARSIP CERITA" title="Aurelia & Retakan Abyssal" />
        <ol className="space-y-1.5">
          {DB.meta.chapters.map((ch) => {
            const open = state.unlockedStory.includes(ch.chapter);
            return (
              <li key={ch.chapter} className={clsx('rounded-xl border px-2.5 py-1.5', open ? 'border-[#4A3540]/40 bg-[#FFF6D6]' : 'border-dashed border-[#4A3540]/25 bg-white/60')}>
                <p className="text-[12px] font-extrabold text-[#2C221E]">Bab {ch.chapter} · {ch.title} {open ? '' : '🔒'}</p>
                {open ? <p className="text-[11.5px] text-[#4A3540]">{ch.lore}</p> : <p className="text-[10.5px] text-[#8A7F72]">Selesaikan permintaan dengan sempurna untuk membuka.</p>}
              </li>
            );
          })}
        </ol>
        <p className="mt-2 text-[10.5px] text-[#8A7F72]">Catatan Kogane: {state.requestLog.filter((r) => r.tier === 'perfect').length} jawaban sempurna.</p>
      </Card>
    </div>
  );
}

export { ITEMS };
