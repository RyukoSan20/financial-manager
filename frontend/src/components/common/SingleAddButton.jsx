// The one add button.
//
// Each page had its own add button, in its own place: some in the
// header, some in the empty state, some in both. So a reader had to
// look for it every time, and on a narrow screen the one in the
// header was the first thing to be pushed off.
//
// This puts one button in the same place on every page that can add
// something. It sits above the bottom navigation on a phone, and in
// the corner on a bigger screen.
//
// It is behind the `SINGLE_ADD` reader switch. With the switch off,
// each page keeps the button it had.

import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { batch6 } from '../../i18n/keys_batch6';
import { readerFlag } from '../../utils/featureFlags';

/**
 * Is the single add button on?
 *
 * Read on every render, so that turning the switch on changes the
 * page straight away.
 */
export function isSingleAddOn() {
  return readerFlag('SINGLE_ADD');
}

/**
 * The button.
 *
 * `href` is where the button goes. `label` is the text, which is
 * empty on a phone because the icon says it already.
 */
export default function SingleAddButton({ href, label, onClick, className = '' }) {
  const { language } = useTranslation();
  const K = batch6[language]?.a5 || batch6.id.a5;
  const navigate = useNavigate();

  if (!isSingleAddOn()) return null;

  const text = label || K.single_add_label;

  const handle = (event) => {
    if (onClick) {
      event.preventDefault();
      onClick();
      return;
    }
    event.preventDefault();
    navigate(href);
  };

  return (
    <div className={`fixed bottom-24 right-4 lg:bottom-8 lg:right-8 z-40 ${className}`}>
      <button
        type="button"
        onClick={handle}
        aria-label={text}
        title={text}
        className="flex items-center gap-2 bg-primary-600 text-white rounded-full shadow-lg hover:bg-primary-700 active:scale-95 transition-all h-14 px-4"
      >
        <Plus className="w-5 h-5" />
        {/* The text is for the wider screens; on a phone the icon
            says it, and the text would only take up room. */}
        <span className="hidden sm:inline text-sm font-medium pr-4">{text}</span>
        <span className="sm:hidden w-5" />
      </button>
    </div>
  );
}
