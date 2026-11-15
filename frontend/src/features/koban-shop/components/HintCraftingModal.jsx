/**
 * Minori's workshop.
 *
 * Two ways to make something. A known recipe is a button: tap, and
 * if the shelf of raw materials covers it, the thing is made. An
 * unknown recipe is a clue - the output named, one ingredient named,
 * the rest hidden - and a bench where the player lays two or three
 * raw materials down and tries. A wrong try costs nothing, so the
 * bench invites experiment instead of punishing it.
 */

import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { DB, ITEMS, RAW, RECIPES } from '../store/kobanEngine.js';
import { Button, Card, ItemIcon, Pill, SectionTitle, Sheet, fmt } from './ui.jsx';

export default function HintCraftingModal({ state, actions, nowMs, embedded = false, open = true, onClose }) {
  const [facility, setFacility] = useState('restaurant');
  const [bench, setBench] = useState([]);
  const [flash, setFlash] = useState(null);

  const chapterFacilities = useMemo(() => {
    const ch = DB.meta.chapters.find((c) => c.chapter === state.chapter) || DB.meta.chapters[0];
    const unlocked = ch.unlockedFacilities || DB.meta.chapters.filter((c) => c.chapter <= state.chapter).flatMap((c) => c.unlockedFacilities || []);
    return new Set(unlocked.length ? unlocked : ['restaurant', 'blacksmith']);
  }, [state.chapter]);

  const recipes = useMemo(
    () => DB.recipes.filter((r) => r.facility === facility && r.unlockChapter <= state.chapter).sort((a, b) => a.tier - b.tier),
    [facility, state.chapter]
  );
  const known = recipes.filter((r) => state.knownRecipes.includes(r.id));
  const locked = recipes.filter((r) => !state.knownRecipes.includes(r.id)).slice(0, 12);
  const rawOwned = DB.rawMaterials.filter((r) => (state.rawInventory[r.id] || 0) > 0);

  const canCraft = (r) => r.ingredients.every((i) => (state.rawInventory[i.itemId] || 0) >= i.qty);

  const craft = (rid) => {
    const out = actions.craftRecipe(rid);
    if (out && out.crafted) setFlash({ kind: 'ok', text: `${out.doubled ? 'Bountiful Harvest! ' : ''}${ITEMS[RECIPES[rid].outputItemId].name} ×${out.crafted}` });
    else setFlash({ kind: 'bad', text: 'Bahan belum cukup.' });
    window.setTimeout(() => setFlash(null), 1800);
  };

  const tryBench = () => {
    if (bench.length < 2) return;
    const out = actions.discoverRecipe(bench);
    if (out && out.discovered) setFlash({ kind: 'ok', text: `Resep baru: ${ITEMS[RECIPES[out.discovered].outputItemId].name}!` });
    else if (out && out.crafted) setFlash({ kind: 'ok', text: 'Resep sudah dikenal — dibuat lagi.' });
    else setFlash({ kind: 'bad', text: 'Tidak jadi apa-apa. Bahan dikembalikan.' });
    setBench([]);
    window.setTimeout(() => setFlash(null), 2200);
  };

  const toggleBench = (id) => setBench((b) => (b.includes(id) ? b.filter((x) => x !== id) : b.length < 3 ? [...b, id] : b));

  const body = (
    <div data-testid="craft-studio">
      <div
        className="relative mb-3 overflow-hidden rounded-[18px] border-2 border-[#4A3540]"
        style={{ aspectRatio: '21 / 7', backgroundImage: `url(${DB.meta.scenes.workshop})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
      >
        <img src={DB.characters.find((c) => c.id === 'minori').sprite} alt="Minori" className="koban-chara absolute bottom-0 left-[52%] w-[16%] -translate-x-1/2" />
        {flash ? (
          <div className={clsx('absolute left-2 top-2 rounded-xl border-2 border-[#4A3540] px-3 py-1 text-[12px] font-extrabold', flash.kind === 'ok' ? 'bg-[#E3F2EA] text-[#1F3A2E]' : 'bg-[#FDE8E4] text-[#9E3B24]')} data-testid="craft-flash">
            {flash.text}
          </div>
        ) : null}
      </div>

      {/* The facility filter. */}
      <div className="no-scrollbar mb-3 flex gap-1.5 overflow-x-auto">
        {DB.facilities.map((f) => {
          const unlocked = chapterFacilities.has(f.id) || f.unlockChapter <= state.chapter;
          return (
            <button
              key={f.id}
              type="button"
              disabled={!unlocked}
              onClick={() => setFacility(f.id)}
              data-testid={`facility-${f.id}`}
              className={clsx(
                'shrink-0 rounded-full border-2 px-3 py-1 text-[11.5px] font-bold transition-transform active:scale-95',
                facility === f.id ? 'border-[#4A3540] bg-[#2F4842] text-white' : 'border-[#4A3540]/30 bg-white text-[#4A3540]',
                !unlocked && 'opacity-40'
              )}
            >
              {f.icon} {f.name}{!unlocked ? ' 🔒' : ''}
            </button>
          );
        })}
      </div>

      {/* The bench. */}
      <Card className="mb-3 p-3">
        <SectionTitle badge="MEJA PERCOBAAN" title="Temukan resep baru" lead="Pilih 2–3 bahan mentah lalu coba. Gagal tidak menghabiskan bahan." />
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
          {rawOwned.length === 0 ? <p className="text-[12px] text-[#8A7F72]">Belum ada bahan mentah. Kirim Zenimaru ke dungeon.</p> : null}
          {rawOwned.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => toggleBench(r.id)}
              data-testid={`raw-${r.id}`}
              className={clsx('flex shrink-0 flex-col items-center rounded-xl border-2 px-1.5 py-1 transition-transform active:scale-95', bench.includes(r.id) ? 'border-[#4A3540] bg-[#FFF6D6]' : 'border-[#4A3540]/25 bg-white')}
              title={r.name}
            >
              <ItemIcon id={r.id} size={32} />
              <span className="text-[9px] font-bold text-[#4A3540]">×{state.rawInventory[r.id]}</span>
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[11px] font-bold text-[#5C6460]">Di meja: {bench.map((id) => RAW[id].name).join(' + ') || '—'}</span>
          <Button size="sm" tone="terracotta" onClick={tryBench} disabled={bench.length < 2} data-testid="bench-try">Coba Racik</Button>
        </div>
      </Card>

      {/* Known recipes. */}
      <SectionTitle badge="RESEP DIKENAL" title={`${known.length} resep`} />
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {known.map((r) => {
          const out = ITEMS[r.outputItemId];
          const ok = canCraft(r);
          return (
            <Card key={r.id} className="p-2">
              <div className="flex items-center gap-2">
                <ItemIcon id={out.id} size={36} />
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-extrabold text-[#2C221E]">{out.name}</p>
                  <p className="text-[10px] text-[#8A7F72]">T{r.tier} · jual {fmt(out.sellPrice)}</p>
                </div>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {r.ingredients.map((i) => (
                  <Pill key={i.itemId} tone={(state.rawInventory[i.itemId] || 0) >= i.qty ? 'sage' : 'sakura'} className="text-[9.5px]">
                    <ItemIcon id={i.itemId} size={12} /> {i.qty}× {RAW[i.itemId]?.name}
                  </Pill>
                ))}
              </div>
              <Button size="sm" className="mt-2 w-full" onClick={() => craft(r.id)} disabled={!ok} data-testid={`craft-${r.id}`}>
                Racik · punya {state.inventory[out.id] || 0}
              </Button>
            </Card>
          );
        })}
      </div>

      {/* Locked clues. */}
      <SectionTitle badge="PETUNJUK RESEP" title="Belum ditemukan" lead="Satu bahan disebut, sisanya teka-teki." />
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {locked.map((r) => (
          <div key={r.id} className="flex items-center gap-2 rounded-xl border border-dashed border-[#4A3540]/40 bg-white/70 px-2 py-1.5">
            <ItemIcon id={r.outputItemId} size={28} className="opacity-60 grayscale" />
            <p className="text-[11px] italic text-[#5C6460]">“{r.recipeClue}”</p>
          </div>
        ))}
      </div>
    </div>
  );

  if (embedded) return body;
  return <Sheet open={open} onClose={onClose} title="Bengkel Minori" wide>{body}</Sheet>;
}
