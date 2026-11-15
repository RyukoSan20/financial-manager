/**
 * The skill dock.
 *
 * Six portraits across the top. Each one is a button; tapping it
 * fires that companion's skill. A ring around the portrait drains
 * while the skill recharges, so the player reads "how long" without
 * a number, and the number is there too for whoever wants it.
 */

import { clsx } from 'clsx';
import { DB } from '../store/kobanEngine.js';
import { mmss, secondsLeft } from './ui.jsx';

export default function SkillCooldownDock({ state, nowMs, onActivate }) {
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto px-1 py-1" data-testid="skilldock">
      {DB.characters.map((c) => {
        const slot = state.skills[c.id];
        const cdLeft = secondsLeft(slot.cooldownUntilMs, nowMs);
        const activeLeft = secondsLeft(slot.activeUntilMs, nowMs);
        const ready = cdLeft === 0;
        const pct = ready ? 100 : Math.round(100 - (cdLeft / c.skill.cooldownSec) * 100);
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onActivate(c.id)}
            disabled={!ready}
            data-testid={`skill-${c.id}`}
            title={`${c.skill.name} — ${c.skill.description}`}
            className={clsx(
              'relative flex shrink-0 flex-col items-center gap-0.5 rounded-2xl border-2 px-1.5 pb-1 pt-1.5 transition-transform active:scale-95',
              ready ? 'border-[#4A3540] bg-[#FFF6D6] shadow-[0_3px_0_#4A3540]' : 'border-[#4A3540]/30 bg-white',
              activeLeft > 0 && 'koban-skill-active'
            )}
          >
            <span
              className="relative h-12 w-12 overflow-hidden rounded-full border-2 border-[#4A3540]"
              style={{
                background: `conic-gradient(#2F4842 ${pct}%, #E5DAC9 ${pct}%)`,
                padding: 2,
              }}
            >
              <img src={c.face} alt={c.name} className={clsx('h-full w-full rounded-full object-cover', !ready && 'opacity-60 grayscale')} />
            </span>
            <span className="text-[9.5px] font-extrabold text-[#2C221E]">{c.name.split(' ')[0]}</span>
            <span className={clsx('text-[8.5px] font-bold tabular-nums', ready ? 'text-[#2F4842]' : 'text-[#9E3B24]')}>
              {activeLeft > 0 ? `ON ${mmss(activeLeft)}` : ready ? 'SIAP' : mmss(cdLeft)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
