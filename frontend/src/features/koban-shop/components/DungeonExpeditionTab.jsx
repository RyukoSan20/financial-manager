/**
 * Zenimaru's expedition board and Kaneru's risk ledger.
 *
 * Pick a dungeon, pick what to carry, read Kaneru's assessment -
 * contract cost against the koban in hand, odds against the loot -
 * and send the party. The battle itself resolves when the clock
 * says so; the log is generated at claim time from the stored
 * outcome, so a tab that was closed for the whole fight still gets
 * the full story.
 */

import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { DB, DUNGEONS, ITEMS, MONSTERS, RAW, expeditionWinRate, mercenaryCost } from '../store/kobanEngine.js';
import { Button, Card, ItemIcon, Pill, SectionTitle, fmt, mmss, secondsLeft } from './ui.jsx';

export default function DungeonExpeditionTab({ state, actions, nowMs }) {
  const [dungeonId, setDungeonId] = useState('whispering_woods');
  const [gear, setGear] = useState([]);
  const [report, setReport] = useState(null);

  const d = DUNGEONS[dungeonId];
  const locked = d.chapter > state.chapter;
  const running = state.expeditions.find((e) => e.status === 'running');
  const ready = state.expeditions.filter((e) => e.status === 'ready_to_claim');
  const cost = mercenaryCost(state, dungeonId);
  const winRate = expeditionWinRate(state, dungeonId, gear, nowMs);

  const gearable = useMemo(
    () => Object.entries(state.inventory).filter(([id, q]) => q > 0 && ITEMS[id] && ITEMS[id].tags.some((t) => ['weapon', 'armor', 'healing', 'stamina'].includes(t))).map(([id]) => ITEMS[id]),
    [state.inventory]
  );
  const toggleGear = (id) => setGear((g) => (g.includes(id) ? g.filter((x) => x !== id) : g.length < 3 ? [...g, id] : g));

  const launch = () => { actions.startExpedition(dungeonId, gear); setGear([]); };
  const claim = (id) => { const out = actions.resolveExpedition(id); setReport(out ? out.outcome : null); };

  const canLaunch = !locked && !running && state.stamina > 0 && state.koban >= cost;

  return (
    <div className="space-y-3" data-testid="dungeontab">
      {/* The forest the expedition goes into. */}
      <div
        className="koban-scene relative h-24 overflow-hidden rounded-[18px] border-2 border-[#4A3540] shadow-[0_4px_0_#DFD3C3] sm:h-32"
        style={{ backgroundImage: `url(${DB.meta.scenes.dungeon})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        data-testid="dungeon-scene"
      >
        <span className="absolute bottom-2 left-3 rounded-full border-2 border-[#4A3540] bg-[#FFF6D6] px-3 py-1 text-[11px] font-extrabold tracking-[0.1em] text-[#2C221E] shadow-[0_3px_0_#4A3540]">
          HUTAN BISU-BISU
        </span>
      </div>

      {/* The five zones. */}
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
        {DB.dungeons.map((z) => (
          <button key={z.id} type="button" onClick={() => setDungeonId(z.id)} data-testid={`dungeon-${z.id}`}
            className={clsx('shrink-0 rounded-full border-2 px-3 py-1 text-[11.5px] font-bold transition-transform active:scale-95', dungeonId === z.id ? 'border-[#4A3540] bg-[#2F4842] text-white' : 'border-[#4A3540]/30 bg-white text-[#4A3540]', z.chapter > state.chapter && 'opacity-40')}>
            {z.name}{z.chapter > state.chapter ? ' 🔒' : ''}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        {/* The briefing. */}
        <Card className="p-3 lg:col-span-7">
          <SectionTitle badge={`BAB ${d.chapter} · ${mmss(d.durationSec)}`} title={d.name} lead={locked ? `Terbuka di Bab ${d.chapter}.` : `Peluang dasar ${Math.round(d.baseWinRate * 100)}%. Bawa senjata, zirah, atau bekal untuk menaikkannya.`} />
          <div className="mb-2 flex flex-wrap gap-1">
            {d.monsters.map((mid) => MONSTERS[mid]).filter(Boolean).map((m) => (
              <span key={m.id} className="flex items-center gap-1 rounded-full border border-[#4A3540]/30 bg-[#FDE8E4] px-2 py-0.5 text-[10px] font-bold text-[#9E3B24]">
                <img src={m.icon} alt="" className="h-4 w-4" style={{ imageRendering: 'pixelated' }} />{m.name}
              </span>
            ))}
          </div>
          <p className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#8A7F72]">Perlengkapan (maks 3, habis dipakai)</p>
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
            {gearable.length === 0 ? <p className="text-[11.5px] text-[#8A7F72]">Tidak ada senjata/zirah/bekal di stok.</p> : null}
            {gearable.map((it) => (
              <button key={it.id} type="button" onClick={() => toggleGear(it.id)} data-testid={`gear-${it.id}`} title={it.name}
                className={clsx('flex shrink-0 flex-col items-center rounded-xl border-2 px-1.5 py-1 transition-transform active:scale-95', gear.includes(it.id) ? 'border-[#4A3540] bg-[#FFF6D6]' : 'border-[#4A3540]/25 bg-white')}>
                <ItemIcon id={it.id} size={30} />
                <span className="text-[9px] font-bold text-[#4A3540]">×{state.inventory[it.id]}</span>
              </button>
            ))}
          </div>

          {/* Kaneru's assessment. */}
          <div className="mt-3 rounded-2xl border-2 border-[#4A3540] bg-[#FFF6D6] p-2.5" data-testid="risk-ledger">
            <div className="flex items-center gap-2">
              <img src={DB.characters.find((c) => c.id === 'kaneru').face} alt="Kaneru" className="h-9 w-9 rounded-full border-2 border-[#4A3540] object-cover" />
              <p className="text-[11.5px] font-extrabold text-[#2C221E]">Penilaian Risiko Kaneru</p>
            </div>
            <dl className="mt-1.5 grid grid-cols-3 gap-1 text-center">
              <div><dt className="text-[9px] font-bold uppercase text-[#8A7F72]">Kontrak</dt><dd className={clsx('text-[14px] font-extrabold tabular-nums', state.koban >= cost ? 'text-[#2F4842]' : 'text-[#9E3B24]')}>{fmt(cost)} K</dd></div>
              <div><dt className="text-[9px] font-bold uppercase text-[#8A7F72]">Peluang</dt><dd className="text-[14px] font-extrabold tabular-nums text-[#2F4842]" data-testid="win-rate">{Math.round(winRate * 100)}%</dd></div>
              <div><dt className="text-[9px] font-bold uppercase text-[#8A7F72]">Stamina</dt><dd className="text-[14px] font-extrabold tabular-nums text-[#2C221E]">{state.stamina}/{state.staminaMax}</dd></div>
            </dl>
            {state.activeBuffs.kaneruDiscountPending ? <Pill tone="sage" className="mt-1">Abacus Audit: −30% aktif</Pill> : null}
            <p className="mt-1.5 text-[10.5px] text-[#5C4A2E]">
              {cost > state.koban * 0.5 ? 'Kaneru: kontrak ini lebih dari separuh kas. Pertimbangkan lagi.' : winRate < 0.5 ? 'Kaneru: peluang di bawah setengah. Bawa perlengkapan.' : 'Kaneru: anggaran dan peluang masuk akal.'}
            </p>
          </div>

          <Button tone="terracotta" className="mt-3 w-full" onClick={launch} disabled={!canLaunch} data-testid="launch-expedition">
            {running ? 'Pasukan sedang di luar' : state.stamina <= 0 ? 'Stamina habis (catat transaksi untuk tiket)' : `Berangkat · ${fmt(cost)} K`}
          </Button>
        </Card>

        {/* The board. */}
        <Card className="p-3 lg:col-span-5">
          <SectionTitle badge="PAPAN EKSPEDISI" title={running ? 'Sedang bertempur' : ready.length ? 'Siap diklaim' : 'Tidak ada pasukan di luar'} />
          {running ? (
            <div className="rounded-xl border-2 border-dashed border-[#4A3540]/40 p-2.5" data-testid="expedition-running">
              <p className="text-[12px] font-extrabold text-[#2C221E]">{DUNGEONS[running.dungeonId].name}</p>
              <p className="text-[20px] font-extrabold tabular-nums text-[#2F4842]">{mmss(secondsLeft(running.endTimeMs, nowMs))}</p>
              <p className="text-[10.5px] text-[#8A7F72]">Peluang {Math.round(running.winRate * 100)}% · Kogane bisa mempercepat 1 jam.</p>
            </div>
          ) : null}
          {ready.map((e) => (
            <Button key={e.id} className="mt-2 w-full" onClick={() => claim(e.id)} data-testid={`claim-${e.id}`}>
              Klaim hasil {DUNGEONS[e.dungeonId].name}
            </Button>
          ))}
          {report ? (
            <div className={clsx('mt-3 rounded-xl border-2 border-[#4A3540] p-2.5', report.won ? 'bg-[#E3F2EA]' : 'bg-[#FDE8E4]')} data-testid="battle-report">
              <p className="text-[12.5px] font-extrabold text-[#2C221E]">{report.won ? '⚔️ Menang!' : '💥 Kalah'}</p>
              <ul className="mt-1 space-y-0.5 text-[11px] text-[#4A3540]">
                {report.battleLog.map((line, i) => <li key={i} className="koban-log-line" style={{ animationDelay: `${i * 0.35}s` }}>{line}</li>)}
              </ul>
              {report.loot.length ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {report.loot.map((id, i) => <span key={i} className="flex items-center gap-1 rounded-full border border-[#4A3540]/30 bg-white px-1.5 py-0.5 text-[10px] font-bold"><ItemIcon id={id} size={14} />{RAW[id]?.name}</span>)}
                </div>
              ) : null}
            </div>
          ) : null}
          <p className="mt-3 text-[10.5px] text-[#8A7F72]">Menang {state.stats.expeditionsWon} · Kalah {state.stats.expeditionsLost}</p>
        </Card>
      </div>
    </div>
  );
}
