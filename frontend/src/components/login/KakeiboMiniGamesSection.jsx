/**
 * The mini-games.
 *
 * A sign-in page asks for something before it has given anything.
 * These two games invert that: a reader can play the whole of both
 * without an account, and the thing they learn while playing is the
 * thing the application does.
 *
 * Game one is the savings run. Coins and gems add to a pot, the fake
 * discounts take from it, and the pot is drawn as Mone's konpeito
 * bottle filling up - the same object the dashboard uses for a
 * savings goal, so the metaphor is learned here and recognised
 * later.
 *
 * Game two is the fortune capsule. One of the six companions comes
 * out of it with a money challenge for the day, which is how the
 * reader meets the guild before signing in.
 *
 * Both are deliberately cheap: no canvas, no physics, no timers
 * running when nobody is playing. The whole thing is state and CSS.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { useTranslation } from '../../i18n';
import { formatNative } from '../../utils/format';
import ClampShoujoMascot from '../mascot/ClampShoujoMascot';
import PixelArtBusinessIcon from '../ui/PixelArtBusinessIcon';
import { PETIT_CHIBI_CAST, PETIT_PERSONA_IDS, petitText } from '../mascot/petitChibiCast';
import { CampusHeading, MemphisBeads, MemphisBead } from './CampusKit.jsx';
import { campusCopy } from './campusCopy.js';

/* ---------------------------------------------------------------------------
   Game one: the savings run
   --------------------------------------------------------------------------- */

const ROUND_SECONDS = 15;
const SLOT_COUNT = 6;
const MASTER_TARGET = 150000;

/** What can appear in a slot, and what catching it is worth. */
const DROPS = [
  { kind: 'coin', value: 25000, icon: 'coin', tint: '#FFF0C2', ring: '#E8B84B' },
  { kind: 'coin', value: 25000, icon: 'coin', tint: '#FFF0C2', ring: '#E8B84B' },
  { kind: 'gem', value: 50000, icon: 'money_bag_rp', tint: '#DFF1E6', ring: '#3F7D62' },
  { kind: 'bomb', value: -15000, icon: 'receipt', tint: '#FBE0D6', ring: '#C2502C' },
];

/** One drop for a slot, picked so gems stay rarer than coins. */
const rollDrop = () => DROPS[Math.floor(Math.random() * DROPS.length)];

function CoinCatcherGame({ C, onEnter, busy }) {
  const { language } = useTranslation();
  const [phase, setPhase] = useState('idle'); // idle | playing | over
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(ROUND_SECONDS);
  const [slots, setSlots] = useState(() => new Array(SLOT_COUNT).fill(null));
  const [pops, setPops] = useState([]);
  const [mood, setMood] = useState('idle');
  const [said, setSaid] = useState('');
  const popId = useRef(0);

  const money = useCallback((value) => formatNative(value, 'IDR'), []);

  // The clock. One interval for the whole round, cleared the moment
  // the round ends or the component goes away - a timer that outlives
  // its card is a leak that keeps re-rendering a page nobody is on.
  useEffect(() => {
    if (phase !== 'playing') return undefined;
    const tick = window.setInterval(() => {
      setLeft((current) => {
        if (current <= 1) {
          setPhase('over');
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(tick);
  }, [phase]);

  // The drops. Slots refill on their own while the round runs, so the
  // board keeps moving even if the reader stops tapping.
  useEffect(() => {
    if (phase !== 'playing') return undefined;
    const refill = window.setInterval(() => {
      setSlots((current) => {
        const next = [...current];
        // One or two slots change on each pass, never the whole
        // board: a board that replaces itself is unplayable.
        const changes = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < changes; i += 1) {
          const at = Math.floor(Math.random() * SLOT_COUNT);
          next[at] = Math.random() < 0.22 ? null : { ...rollDrop(), key: `${Date.now()}-${at}-${i}` };
        }
        return next;
      });
    }, 850);
    return () => window.clearInterval(refill);
  }, [phase]);

  useEffect(() => {
    if (phase === 'over') {
      setSlots(new Array(SLOT_COUNT).fill(null));
      setSaid(C.coin_done);
      setMood(score >= MASTER_TARGET ? 'celebrate' : 'idle');
    }
  }, [phase, score, C.coin_done]);

  const start = () => {
    setScore(0);
    setLeft(ROUND_SECONDS);
    setPops([]);
    setMood('happy');
    setSaid(C.coin_hint);
    setSlots(new Array(SLOT_COUNT).fill(null).map((_, index) => ({
      ...rollDrop(),
      key: `seed-${index}`,
    })));
    setPhase('playing');
  };

  /** Catching one thing. */
  const grab = (index) => {
    if (phase !== 'playing') return;
    const drop = slots[index];
    if (!drop) return;

    setScore((current) => Math.max(0, current + drop.value));
    setSlots((current) => {
      const next = [...current];
      next[index] = null;
      return next;
    });

    // The badge that floats off the slot that was tapped.
    popId.current += 1;
    const id = popId.current;
    const label =
      drop.value > 0 ? `+${Math.round(drop.value / 1000)}rb ✦` : `−${Math.round(-drop.value / 1000)}rb`;
    setPops((current) => [...current, { id, index, label, good: drop.value > 0 }]);
    window.setTimeout(() => {
      setPops((current) => current.filter((pop) => pop.id !== id));
    }, 850);

    if (drop.kind === 'bomb') {
      setMood('alert');
      setSaid(C.coin_bomb);
    } else {
      setMood('celebrate');
      setSaid(C.coin_cheer);
    }
  };

  const fill = Math.min(100, Math.round((score / MASTER_TARGET) * 100));
  const isMaster = score >= MASTER_TARGET;

  return (
    <article
      className={clsx(
        'minigame-card relative overflow-visible rounded-[24px] border-2 border-[#4A3540]',
        'bg-white px-3 pb-4 pt-6 shadow-[0_6px_0_#DFD3C3] sm:px-5 sm:pb-5'
      )}
      data-testid="coin-catcher-game"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <span>
          <h3 className="flex items-center gap-2 text-[1.05rem] font-extrabold tracking-[0.02em] text-[#2C221E]">
            <PixelArtBusinessIcon name="coin" size={18} badge={false} />
            {C.coin_title}
          </h3>
          <p className="mt-0.5 text-[11.5px] font-semibold text-[#8A7F72]">{C.coin_sub}</p>
        </span>
        <span className="flex items-center gap-2">
          <span className="rounded-full border-2 border-[#4A3540] bg-[#FFF6D6] px-3 py-1 text-[11px] font-extrabold tabular-nums text-[#2C221E]">
            {C.coin_time}: {left}s
          </span>
        </span>
      </header>

      {/* The score and the bottle. */}
      <div className="mt-3 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#8A7F72]">
            {C.coin_score}
          </p>
          <p
            className="truncate text-[clamp(1.1rem,4.5vw,1.6rem)] font-extrabold tabular-nums text-[#2F4842]"
            data-testid="coin-score"
          >
            {money(score)}
          </p>
          {/* The bottle, drawn as a meter. */}
          <div className="mt-1.5">
            <div className="flex items-center justify-between text-[10px] font-bold text-[#8A7F72]">
              <span>{C.coin_bottle}</span>
              <span className="tabular-nums">{fill}%</span>
            </div>
            <div className="konpeito-bottle mt-1 h-3 w-full overflow-hidden rounded-full border-2 border-[#4A3540] bg-[#F4EFE6]">
              <span
                className="konpeito-bottle__fill block h-full rounded-full"
                style={{ width: `${fill}%` }}
              />
            </div>
          </div>
        </div>
        {/* The companion, reacting. */}
        <div className="shrink-0 overflow-visible pt-2">
          <ClampShoujoMascot
            persona="mone"
            size={84}
            mood={mood}
            said={said}
            interactive={false}
            label="Mone"
          />
        </div>
      </div>

      {/* The board. */}
      <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-2.5">
        {slots.map((drop, index) => {
          const pop = pops.find((item) => item.index === index);
          return (
            <button
              key={index}
              type="button"
              onClick={() => grab(index)}
              disabled={phase !== 'playing' || !drop}
              data-testid={`coin-slot-${index}`}
              aria-label={drop ? (drop.kind === 'bomb' ? C.coin_bomb_label : C.coin_score) : 'kosong'}
              className={clsx(
                'coin-slot relative flex aspect-square items-center justify-center overflow-visible',
                'rounded-2xl border-2 transition-transform duration-150',
                drop
                  ? 'coin-slot--full border-[#4A3540] active:scale-90'
                  : 'border-dashed border-[#DBCFBE] bg-[#FBF8F2]'
              )}
              style={drop ? { background: drop.tint, boxShadow: `0 3px 0 ${drop.ring}` } : undefined}
            >
              {drop ? (
                <span className="coin-drop-pop flex flex-col items-center gap-0.5">
                  <PixelArtBusinessIcon name={drop.icon} size={26} badge={false} />
                  <span
                    className="text-[9.5px] font-extrabold"
                    style={{ color: drop.value > 0 ? '#2F4842' : '#9E3B24' }}
                  >
                    {drop.value > 0 ? '+' : '−'}
                    {Math.abs(drop.value) / 1000}rb
                  </span>
                </span>
              ) : null}
              {pop ? (
                <span
                  className={clsx(
                    'coin-pop pointer-events-none absolute -top-1 left-1/2 z-20 -translate-x-1/2',
                    'whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-extrabold',
                    pop.good ? 'bg-[#2F4842] text-white' : 'bg-[#C2502C] text-white'
                  )}
                >
                  {pop.label}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* What to do next. */}
      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        {phase !== 'playing' ? (
          <button
            type="button"
            onClick={start}
            data-testid="coin-start"
            className={clsx(
              'flex items-center gap-1.5 rounded-full border-2 border-[#4A3540] bg-[#2F4842]',
              'px-4 py-2 text-[12.5px] font-bold text-white shadow-[0_3px_0_#4A3540]',
              'transition-transform active:translate-y-0.5 active:scale-95'
            )}
          >
            <PixelArtBusinessIcon name="coin" size={15} badge={false} />
            {phase === 'over' ? C.coin_again : C.coin_start}
          </button>
        ) : (
          <p className="text-[11.5px] font-semibold text-[#5C6460]">{C.coin_hint}</p>
        )}

        {isMaster ? (
          <span
            className="flex items-center gap-1.5 rounded-full border-2 border-[#4A3540] bg-[#FFF6D6] px-3 py-1.5 text-[11.5px] font-extrabold text-[#2C221E] shadow-[0_3px_0_#4A3540]"
            data-testid="coin-master-badge"
          >
            <MemphisBead kind="star" colour="#E8B84B" size={13} />
            {C.coin_master}
          </span>
        ) : null}
      </div>

      {isMaster ? (
        <button
          type="button"
          onClick={onEnter}
          disabled={busy}
          data-testid="coin-enter-dashboard"
          className={clsx(
            'mt-2.5 flex w-full items-center justify-center gap-2 rounded-full border-2 border-[#4A3540]',
            'bg-[#D96B43] px-4 py-2.5 text-[12.5px] font-bold text-white shadow-[0_4px_0_#4A3540]',
            'transition-transform active:translate-y-0.5 disabled:opacity-60'
          )}
        >
          {C.coin_enter}
          <span aria-hidden="true">→</span>
        </button>
      ) : null}
    </article>
  );
}

/* ---------------------------------------------------------------------------
   Game two: the fortune capsule
   --------------------------------------------------------------------------- */

/** A money challenge and a saving tip for each of the six. */
const FORTUNES = {
  mone: {
    challenge: {
      id: 'Catat tiga pengeluaran kecil hari ini, sekecil apa pun.',
      en: 'Write down three small spends today, however small.',
      ja: '今日の小さな支出を3つ記録してみて。',
    },
    tip: {
      id: 'Yang tumbuh besar selalu mulai dari yang receh.',
      en: 'What grows large always starts from small change.',
      ja: '大きく育つものは、いつも小銭から始まります。',
    },
  },
  kaneru: {
    challenge: {
      id: 'Bagi penghasilan bulan ini jadi 50/30/20 sekali saja.',
      en: "Split this month's income into 50/30/20, just once.",
      ja: '今月の収入を一度だけ50/30/20に分けてみて。',
    },
    tip: {
      id: 'Anggaran yang seimbang tidak perlu keras pada dirimu.',
      en: 'A balanced budget does not need to be harsh on you.',
      ja: 'バランスの取れた予算は、自分に厳しくなくていい。',
    },
  },
  kogane: {
    challenge: {
      id: 'Hitung satu aset yang sudah kamu punya, bukan yang ingin dibeli.',
      en: 'Count one asset you already own, not one you want.',
      ja: '欲しい物ではなく、すでに持っている資産を1つ数えて。',
    },
    tip: {
      id: 'Kekayaan yang dijaga lama lebih tenang dari yang dikejar.',
      en: 'Wealth kept for long is calmer than wealth chased.',
      ja: '長く守る富は、追いかける富より穏やかです。',
    },
  },
  zenimaru: {
    challenge: {
      id: 'Kumpulkan kembalian hari ini di satu tempat.',
      en: "Gather today's loose change into one place.",
      ja: '今日のおつりを一か所に集めてみて。',
    },
    tip: {
      id: 'Yang receh paling sering hilang karena tidak pernah dicatat.',
      en: 'Small change vanishes because it is never written down.',
      ja: '小銭が消えるのは、記録されないからです。',
    },
  },
  minori: {
    challenge: {
      id: 'Pilih satu tujuan menabung dan beri nama yang jelas.',
      en: 'Pick one savings goal and give it a clear name.',
      ja: '貯金の目標を1つ選んで、はっきり名前をつけて。',
    },
    tip: {
      id: 'Tujuan yang punya nama lebih mudah diingat saat tergoda.',
      en: 'A goal with a name is easier to recall when tempted.',
      ja: '名前のある目標は、誘惑のときに思い出しやすい。',
    },
  },
  koneko: {
    challenge: {
      id: 'Lewati satu pembelian impulsif hari ini dan catat nilainya.',
      en: 'Skip one impulse buy today and write down its value.',
      ja: '今日は衝動買いを1つ我慢して、その金額を記録して。',
    },
    tip: {
      id: 'Yang tidak jadi dibeli boleh dihitung sebagai tabungan.',
      en: 'What you did not buy may be counted as savings.',
      ja: '買わなかったものは、貯金として数えていい。',
    },
  },
};

const fortuneText = (personaId, field, language) => {
  const entry = FORTUNES[personaId]?.[field];
  if (!entry) return '';
  return entry[language] || entry.id;
};

function GachaGame({ C }) {
  const { language } = useTranslation();
  const [spinning, setSpinning] = useState(false);
  const [drawn, setDrawn] = useState(null);
  const [collected, setCollected] = useState([]);
  const timer = useRef(null);

  // A spin left running when the card goes away would set state on a
  // card that is gone.
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const spin = () => {
    if (spinning) return;
    setSpinning(true);
    timer.current = window.setTimeout(() => {
      const pick = PETIT_PERSONA_IDS[Math.floor(Math.random() * PETIT_PERSONA_IDS.length)];
      setDrawn(pick);
      setCollected((current) => (current.includes(pick) ? current : [...current, pick]));
      setSpinning(false);
    }, 900);
  };

  const persona = drawn ? PETIT_CHIBI_CAST[drawn] : null;

  return (
    <article
      className={clsx(
        'minigame-card relative overflow-visible rounded-[24px] border-2 border-[#4A3540]',
        'bg-white px-3 pb-4 pt-6 shadow-[0_6px_0_#DFD3C3] sm:px-5 sm:pb-5'
      )}
      data-testid="gacha-game"
    >
      <header>
        <h3 className="flex items-center gap-2 text-[1.05rem] font-extrabold tracking-[0.02em] text-[#2C221E]">
          <PixelArtBusinessIcon name="money_bag_yen" size={18} badge={false} />
          {C.gacha_title}
        </h3>
        <p className="mt-0.5 text-[11.5px] font-semibold text-[#8A7F72]">{C.gacha_sub}</p>
      </header>

      {/* The machine. */}
      <div className="mt-3 flex items-start gap-3">
        <div
          className={clsx(
            'gacha-machine relative flex h-[118px] w-[96px] shrink-0 flex-col items-center',
            'overflow-visible rounded-[18px] border-2 border-[#4A3540] bg-[#FDE8E4] p-2',
            'shadow-[0_4px_0_#C98C7B]'
          )}
          aria-hidden="true"
        >
          {/* The glass dome full of capsules. */}
          <span className="relative flex h-[58px] w-[74px] items-center justify-center overflow-hidden rounded-t-full border-2 border-[#4A3540] bg-white/80">
            {['#F9C6B0', '#E8B84B', '#8FBFA8', '#C9A7D4', '#F4A6A0'].map((colour, index) => (
              <span
                key={colour}
                className={clsx('absolute block h-4 w-4 rounded-full border border-[#4A3540]/40', spinning && 'gacha-capsule-shake')}
                style={{
                  background: colour,
                  left: `${8 + index * 13}px`,
                  bottom: `${4 + (index % 3) * 11}px`,
                  animationDelay: `${index * 0.08}s`,
                }}
              />
            ))}
          </span>
          {/* The knob and the chute. */}
          <span className={clsx('mt-1.5 block h-5 w-5 rounded-full border-2 border-[#4A3540] bg-[#FFF6D6]', spinning && 'gacha-knob-turn')} />
          <span className="mt-1.5 block h-5 w-10 rounded-md border-2 border-[#4A3540] bg-[#4A3540]/85" />
        </div>

        {/* What came out. */}
        <div className="min-w-0 flex-1">
          {spinning ? (
            <p className="text-[12px] font-bold text-[#8A7F72]">{C.gacha_spinning}</p>
          ) : persona ? (
            <div className="gacha-reveal" data-testid="gacha-card">
              <span className="flex items-center gap-2">
                <ClampShoujoMascot
                  persona={drawn}
                  size={52}
                  mood="happy"
                  interactive={false}
                  label={persona.name}
                />
                <span className="min-w-0">
                  <p className="truncate text-[13.5px] font-extrabold text-[#2C221E]">
                    {persona.name}
                  </p>
                  <p className="truncate text-[10.5px] font-semibold text-[#8A7F72]">
                    {petitText(persona, 'tagline', language)}
                  </p>
                </span>
              </span>
              <p className="mt-2 text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#9E3B24]">
                {C.gacha_challenge}
              </p>
              <p className="text-[12px] font-semibold leading-snug text-[#4A3540]">
                {fortuneText(drawn, 'challenge', language)}
              </p>
              <p className="mt-1.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#3F7D62]">
                {C.gacha_tip}
              </p>
              <p className="text-[12px] leading-snug text-[#5C6460]">
                {fortuneText(drawn, 'tip', language)}
              </p>
            </div>
          ) : (
            <p className="text-[12px] leading-snug text-[#5C6460]">{C.gacha_sub}</p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={spin}
        disabled={spinning}
        data-testid="gacha-spin"
        className={clsx(
          'mt-3 flex w-full items-center justify-center gap-2 rounded-full border-2 border-[#4A3540]',
          'bg-[#C9699A] px-4 py-2 text-[12.5px] font-bold text-white shadow-[0_3px_0_#4A3540]',
          'transition-transform active:translate-y-0.5 active:scale-95 disabled:opacity-60'
        )}
      >
        {drawn ? C.gacha_again : C.gacha_spin}
        <MemphisBead kind="star" colour="#FFFFFF" size={13} />
      </button>

      {/* The set, so a reader can see what is still missing. */}
      <p className="mt-2.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#8A7F72]">
        {C.gacha_collected} · {collected.length}/{PETIT_PERSONA_IDS.length}
      </p>
      <span className="mt-1 flex flex-wrap gap-1">
        {PETIT_PERSONA_IDS.map((id) => (
          <span
            key={id}
            className={clsx(
              'rounded-full border px-2 py-0.5 text-[10px] font-bold',
              collected.includes(id)
                ? 'border-[#4A3540] bg-[#FFF6D6] text-[#2C221E]'
                : 'border-dashed border-[#DBCFBE] text-[#BCB1A2]'
            )}
          >
            {PETIT_CHIBI_CAST[id].name}
          </span>
        ))}
      </span>
    </article>
  );
}

/* ---------------------------------------------------------------------------
   The section
   --------------------------------------------------------------------------- */

export default function KakeiboMiniGamesSection({ onGuest, busy = false, className = '' }) {
  const { language } = useTranslation();
  const C = useMemo(() => campusCopy(language), [language]);

  return (
    <section
      id="MiniGame"
      className={clsx('campus-section relative overflow-visible bg-[#FDE8E4] px-4 py-10 sm:py-14', className)}
      data-testid="minigames-section"
    >
      <MemphisBeads seed={0} />
      <div className="relative mx-auto max-w-6xl">
        <CampusHeading badge={C.game_badge} title={C.game_title} lead={C.game_lead} />
        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <CoinCatcherGame C={C} onEnter={onGuest} busy={busy} />
          </div>
          <div className="lg:col-span-5 lg:translate-y-4">
            <GachaGame C={C} />
          </div>
        </div>
      </div>
    </section>
  );
}

export { CoinCatcherGame, GachaGame, FORTUNES };
