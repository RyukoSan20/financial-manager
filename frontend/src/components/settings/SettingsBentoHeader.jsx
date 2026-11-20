/**
 * The banner across the top of the settings page.
 *
 * It answers four questions in one band of the page: what am I
 * looking at (the category and the title), how do I find the one thing
 * I came for (the filter), where do I change the whole look of the app
 * (the link to the concept page), and is anything happening (the
 * companion).
 *
 * The filter is a real filter over the settings categories. It filters
 * the rail and the workspace together, so a reader who types "privasi"
 * sees only the privacy cards and nothing else on the page.
 *
 * Every colour here comes from the concept tokens, so the banner
 * changes with the concept like everything else.
 */

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import SettingsMascotCompanion from './SettingsMascotCompanion';

/**
 * The search glyph.
 *
 * Drawn rather than borrowed: an OS emoji would not follow the
 * concept's colours and would look like a sticker on a flat banner.
 */
function SearchGlyph() {
  return (
    <svg
      className="sbg-search__icon"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="M12.8 12.8 L17 17" />
    </svg>
  );
}

/**
 * The little arrow that says "this goes somewhere else".
 */
function ArrowGlyph() {
  return (
    <svg
      viewBox="0 0 20 20"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 10h11" />
      <path d="M11 6l4 4-4 4" />
    </svg>
  );
}

/**
 * The close glyph for the filter box.
 */
function CloseGlyph() {
  return (
    <svg
      viewBox="0 0 20 20"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}

export default function SettingsBentoHeader({
  eyebrow,
  title,
  subtitle,
  query = '',
  onQueryChange,
  searchPlaceholder,
  appearanceLabel,
  categoryLabel,
  signOutLabel,
  onSignOut,
  mascotPersona = 'kaneru',
  mascotMessage,
  mascotHint,
  celebrateSignal = 0,
  resultCount,
  totalCount,
}) {
  const hasQuery = useMemo(() => query.trim().length > 0, [query]);

  return (
    <header className="sbg-banner" data-testid="settings-bento-header">
      <div className="sbg-banner__main">
        {eyebrow ? (
          <span className="sbg-banner__eyebrow" data-testid="settings-bento-eyebrow">
            {eyebrow}
          </span>
        ) : null}

        <h1 className="sbg-banner__title" data-testid="settings-bento-title">
          {title}
        </h1>

        {subtitle ? <p className="sbg-banner__subtitle">{subtitle}</p> : null}

        <div className="sbg-banner__row">
          <div className="sbg-search">
            <SearchGlyph />
            <input
              type="search"
              className="sbg-search__input"
              placeholder={searchPlaceholder}
              value={query}
              onChange={(event) => onQueryChange?.(event.target.value)}
              data-testid="settings-bento-search"
              aria-label={title}
            />
            {hasQuery ? (
              <button
                type="button"
                className="sbg-search__clear"
                onClick={() => onQueryChange?.('')}
                data-testid="settings-bento-search-clear"
                aria-label="clear"
              >
                <CloseGlyph />
              </button>
            ) : null}
          </div>

          <Link
            to="/settings/appearance"
            className="sbg-pill"
            data-testid="settings-bento-appearance-link"
          >
            {appearanceLabel}
            <ArrowGlyph />
          </Link>

          {onSignOut ? (
            <button
              type="button"
              className="sbg-pill sbg-pill--ghost"
              onClick={onSignOut}
              data-testid="settings-bento-sign-out"
            >
              {signOutLabel}
            </button>
          ) : null}

          {typeof resultCount === 'number' && typeof totalCount === 'number' ? (
            <span className="sbg-rail__count" data-testid="settings-bento-result-count">
              <span className="sbg-rail__count-label">{categoryLabel}</span>
              <span className="sbg-rail__count-value">{resultCount}/{totalCount}</span>
            </span>
          ) : null}
        </div>
      </div>

      {mascotMessage ? (
        <SettingsMascotCompanion
          persona={mascotPersona}
          message={mascotMessage}
          hint={mascotHint}
          celebrateSignal={celebrateSignal}
        />
      ) : null}
    </header>
  );
}
