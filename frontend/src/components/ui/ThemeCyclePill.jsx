/**
 * One click to the next design: Korporat Catchy -> Royal Aurelia ->
 * Jade Sovereign -> Korporat Catchy. It is in the header and at the foot
 * of the sidebar, so the three can be compared from any page.
 */

import { clsx } from 'clsx';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from '../../i18n';
import { APP_THEMES, nextAppTheme } from '../../utils/appTheme';

export default function ThemeCyclePill({ compact = false, className = '' }) {
  const { appTheme, cycleAppTheme } = useTheme();
  const { t } = useTranslation();
  const current = APP_THEMES[appTheme] || APP_THEMES.corporate;
  const next = APP_THEMES[nextAppTheme(appTheme)];
  return (
    <button
      type="button"
      onClick={cycleAppTheme}
      className={clsx('theme-cycle-pill', compact && 'theme-cycle-pill--compact', className)}
      data-testid="theme-cycle"
      data-theme-now={appTheme}
      title={`${t(current.labelKey)} \u2192 ${t(next.labelKey)}`}
      aria-label={`${t('appearance.theme_cycle')}: ${t(next.labelKey)}`}
    >
      <span className="theme-cycle-pill__dots" aria-hidden="true">
        {current.swatch.map((c) => <i key={c} style={{ background: c }} />)}
      </span>
      {compact ? null : <span className="theme-cycle-pill__name">{t(current.labelKey)}</span>}
    </button>
  );
}
