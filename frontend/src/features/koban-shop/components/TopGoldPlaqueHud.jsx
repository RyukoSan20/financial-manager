/**
 * The strip above every scene: three embossed gold plaques on a cream
 * bar, over a brown diamond-checkered border.
 */

import { Icon, useKobanCopy } from './rpgKit.jsx';
import { fmt } from './ui.jsx';

export default function TopGoldPlaqueHud({ state, onBack }) {
  const C = useKobanCopy();
  return (
    <header className="krpg-top" data-testid="koban-hud">
      <div className="krpg-top__bar">
        <button type="button" className="krpg-back" onClick={onBack} data-testid="koban-back">
          <svg viewBox="0 0 20 20" width="12" height="12" aria-hidden="true"><path d="M12.5 3.5 L6 10 l6.5 6.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
          {C.back}
        </button>
        <div className="krpg-plaques">
          <span className="krpg-plaque" data-testid="hud-koban" title={C.gold}><Icon name="coin" size={17} /><b>{fmt(state.koban)}</b><i>G</i></span>
          <span className="krpg-plaque" data-testid="hud-pop" title={C.pop}><Icon name="smile" size={17} /><b>{fmt(state.popularity || 0)}</b><i>P</i></span>
          <span className="krpg-plaque" data-testid="hud-stamina" title={C.stamina}><Icon name="bolt" size={17} /><b>{state.stamina}/{state.staminaMax}</b></span>
        </div>
      </div>
      <div className="krpg-checker" aria-hidden="true" />
    </header>
  );
}
