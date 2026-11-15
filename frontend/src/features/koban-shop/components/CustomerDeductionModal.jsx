/**
 * Kogane's umbrella table.
 *
 * A customer says what is wrong. Kogane says what kind of thing
 * would fix it. The player picks something from stock. Three
 * outcomes: the exact thing (150%, and a piece of the story), a
 * thing of the right kind (100%), or the wrong thing - which the
 * customer hands back, so a guess never costs the item.
 */

import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { DB, ITEMS, REQUESTS, evaluateRequest } from '../store/kobanEngine.js';
import { Button, Card, ItemIcon, Pill, Sheet, fmt } from './ui.jsx';

export function RequestCard({ request, state, onOpen, solved }) {
  return (
    <Card className={clsx('p-3', solved && 'opacity-70')} data-testid={`request-${request.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <Pill tone={solved ? 'sage' : 'sakura'}>{solved ? 'SELESAI' : `BAB ${request.chapter}`}</Pill>
          <p className="mt-1 text-[13px] font-extrabold text-[#2C221E]">{request.customerName}</p>
        </div>
        <span className="text-right text-[11px] font-bold text-[#2F4842]">+{fmt(request.baseRewardKoban)} K<br /><span className="text-[#8A7F72]">+{request.reputationPoints} rep</span></span>
      </div>
      <p className="mt-1.5 text-[12px] leading-snug text-[#4A3540]">“{request.complaint}”</p>
      {!solved ? <Button size="sm" className="mt-2" onClick={() => onOpen(request.id)}>Bantu</Button> : null}
    </Card>
  );
}

export default function CustomerDeductionModal({ requestId, state, actions, onClose }) {
  const request = REQUESTS[requestId];
  const [picked, setPicked] = useState(null);
  const [result, setResult] = useState(null);

  const stock = useMemo(
    () => Object.entries(state.inventory).filter(([, q]) => q > 0).map(([id]) => ITEMS[id]).filter(Boolean),
    [state.inventory]
  );

  if (!request) return null;

  const give = () => {
    if (!picked) return;
    const out = actions.solveRequest(request.id, picked);
    setResult(out ? out.result : null);
  };

  const preview = picked ? evaluateRequest(request, picked) : null;

  return (
    <Sheet open onClose={onClose} title="Meja Payung Kogane" wide>
      <div data-testid="deduction-modal">
        <div className="flex items-start gap-3">
          <img src={DB.characters.find((c) => c.id === 'kogane').face} alt="Kogane" className="h-14 w-14 shrink-0 rounded-full border-2 border-[#4A3540] object-cover" />
          <div>
            <p className="text-[13px] font-extrabold text-[#2C221E]">{request.customerName}</p>
            <p className="mt-0.5 text-[12.5px] leading-snug text-[#4A3540]">“{request.complaint}”</p>
            <p className="mt-2 rounded-xl border border-[#4A3540]/30 bg-[#FFF6D6] px-2.5 py-1.5 text-[11.5px] text-[#5C4A2E]">
              <strong>Kogane:</strong> {request.koganeHint}
            </p>
          </div>
        </div>

        {result ? (
          <div className={clsx('mt-3 rounded-2xl border-2 border-[#4A3540] p-3', result.tier === 'perfect' ? 'bg-[#E3F2EA]' : result.tier === 'acceptable' ? 'bg-[#FFF6D6]' : 'bg-[#FDE8E4]')} data-testid={`verdict-${result.tier}`}>
            <p className="text-[13px] font-extrabold text-[#2C221E]">
              {result.tier === 'perfect' ? '✦ Sempurna! 150% Koban' : result.tier === 'acceptable' ? 'Cukup cocok. 100% Koban' : 'Bukan itu. Barang dikembalikan.'}
            </p>
            <p className="text-[12px] text-[#4A3540]">+{fmt(result.reward)} Koban</p>
            {result.story ? <p className="mt-2 border-t border-[#4A3540]/20 pt-2 text-[12px] italic text-[#1F3A2E]">📜 {result.story}</p> : null}
            <Button size="sm" className="mt-2" onClick={onClose}>Tutup</Button>
          </div>
        ) : (
          <>
            <p className="mb-1.5 mt-3 text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#8A7F72]">Pilih dari stok</p>
            {stock.length === 0 ? <p className="text-[12px] text-[#8A7F72]">Stok kosong. Racik dulu di Bengkel.</p> : null}
            <div className="grid max-h-[36vh] grid-cols-4 gap-1.5 overflow-y-auto sm:grid-cols-6">
              {stock.map((it) => (
                <button key={it.id} type="button" onClick={() => setPicked(it.id)} data-testid={`pick-${it.id}`} title={it.name}
                  className={clsx('flex flex-col items-center rounded-xl border-2 p-1.5 transition-transform active:scale-95', picked === it.id ? 'border-[#4A3540] bg-[#FFF6D6]' : 'border-[#4A3540]/25 bg-white')}>
                  <ItemIcon id={it.id} size={34} />
                  <span className="mt-0.5 w-full truncate text-[9px] font-bold text-[#4A3540]">{it.name}</span>
                  <span className="text-[8.5px] text-[#8A7F72]">×{state.inventory[it.id]}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-[11px] text-[#5C6460]">
                {picked ? <>Tag: {ITEMS[picked].tags.slice(0, 4).join(', ')}</> : 'Belum memilih'}
                {preview && preview.tier !== 'wrong' ? <Pill tone="sage" className="ml-1">tag cocok</Pill> : null}
              </span>
              <Button tone="terracotta" onClick={give} disabled={!picked} data-testid="give-item">Serahkan</Button>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}
