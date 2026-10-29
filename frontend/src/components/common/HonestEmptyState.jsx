/**
 * An empty page that says something useful.
 *
 * The old empty state was a grey circle with an icon in it, a title,
 * and one button. It filled the space and told the reader nothing
 * they did not already know: that there is nothing here yet.
 *
 * This one answers the three questions a reader actually has when a
 * page is empty:
 *
 * - What is this page for?
 * - Why is it empty?
 * - What do I do about it?
 *
 * So it carries a title, a sentence that says what the page is for, a
 * line that says what will make it stop being empty, and two actions:
 * the obvious one, and the one that is easier when the reader has
 * nothing yet.
 *
 * The mascot is part of it. A page that is empty because the reader
 * has not started is not a broken page, and a friendly face saying so
 * is truer than a warning.
 *
 * The words come from the reader's own language. The caller passes
 * the keys, and the component looks them up. Nothing here is written
 * in one language only.
 */

import { useState } from 'react';
import { useTranslation } from '../../i18n';
import FinBuddyMascot from './FinBuddyMascot';
import { getVariant, readerKey } from '../../utils/abTesting';

/**
 * The keys the component needs.
 *
 * The caller names them, because the wording of "what will make this
 * page stop being empty" is different on every page.
 */
const DEFAULT_KEYS = {
  title: 'common.empty_title',
  description: 'common.empty_description',
  hint: 'common.empty_hint',
  primary: 'common.empty_primary',
  secondary: 'common.empty_secondary',
};

export default function HonestEmptyState({
  titleKey,
  descriptionKey,
  hintKey,
  primaryActionKey,
  secondaryActionKey,
  title,
  description,
  hint,
  primaryAction,
  secondaryAction,
  onPrimary,
  onSecondary,
  mascotMood = 'idle',
  mascotSize = 72,
  secondary = true,
  className = '',
}) {
  const { t } = useTranslation();

  // A caller may pass the words directly, or the keys to look them
  // up by. The words win when both are given, because a caller that
  // has already written the sentence means it.
  const titleText = title || t(titleKey || DEFAULT_KEYS.title, DEFAULT_KEYS.title);
  const descriptionText =
    description || t(descriptionKey || DEFAULT_KEYS.description, DEFAULT_KEYS.description);
  const hintText = hint ? t(hintKey, hint) : t(hintKey || DEFAULT_KEYS.hint, '');

  const primaryText = primaryAction
    ? t(primaryActionKey, primaryAction)
    : t(primaryActionKey || DEFAULT_KEYS.primary, DEFAULT_KEYS.primary);
  const secondaryText = secondaryAction
    ? t(secondaryActionKey, secondaryAction)
    : t(secondaryActionKey || DEFAULT_KEYS.secondary, '');

  // A second action that is not named is not shown. An empty space on
  // the screen is not a button.
  const showSecondary = Boolean(secondary && (secondaryAction || secondaryActionKey) && onSecondary);

  // Which version of an empty page this reader sees. It is decided on
  // this device and never changes, so a reader who has seen the plain
  // version keeps seeing it and the comparison means something.
  const [version] = useState(() => getVariant('exp_empty_state', readerKey()));
  const plain = version === 'control';

  // The plain version: the words and one action, and no picture. It is
  // the version that was already there, and it is here so the two can
  // be compared.
  if (plain) {
    return (
      <div
        className={`honest-empty honest-empty--plain flex flex-col items-center justify-center text-center px-5 py-10 ${className}`.trim()}
      >
        <h3 className="honest-empty__title text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1.5">
          {titleText}
        </h3>

        {descriptionText && (
          <p className="honest-empty__description text-sm text-gray-600 dark:text-gray-300 max-w-md leading-relaxed">
            {descriptionText}
          </p>
        )}

        {hintText && (
          <p className="honest-empty__hint text-xs text-gray-500 dark:text-gray-400 max-w-sm mt-2 leading-relaxed">
            {hintText}
          </p>
        )}

        {onPrimary && (
          <div className="honest-empty__actions mt-5">
            <button
              type="button"
              onClick={onPrimary}
              className="honest-empty__primary inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform duration-150 hover:bg-primary-700 active:scale-95"
            >
              {primaryText}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`honest-empty flex flex-col items-center justify-center text-center px-5 py-10 ${className}`.trim()}
    >
      <div className="honest-empty__mascot mb-4">
        <FinBuddyMascot mood={mascotMood} size={mascotSize} />
      </div>

      <h3 className="honest-empty__title text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1.5">
        {titleText}
      </h3>

      {descriptionText && (
        <p className="honest-empty__description text-sm text-gray-600 dark:text-gray-300 max-w-md leading-relaxed">
          {descriptionText}
        </p>
      )}

      {hintText && (
        <p className="honest-empty__hint text-xs text-gray-500 dark:text-gray-400 max-w-sm mt-2 leading-relaxed">
          {hintText}
        </p>
      )}

      <div className="honest-empty__actions flex flex-wrap items-center justify-center gap-2 mt-5">
        {onPrimary && (
          <button
            type="button"
            onClick={onPrimary}
            className="honest-empty__primary inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform duration-150 hover:bg-primary-700 active:scale-95"
          >
            {primaryText}
          </button>
        )}

        {showSecondary && (
          <button
            type="button"
            onClick={onSecondary}
            className="honest-empty__secondary inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-transform duration-150 hover:bg-gray-50 active:scale-95 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            {secondaryText}
          </button>
        )}
      </div>
    </div>
  );
}
