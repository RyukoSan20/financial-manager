/**
 * The toast.
 *
 * The application used the browser's own `alert` for the moments that
 * matter: a wishlist item added, a budget that could not be saved, a
 * receipt that would not upload. That dialog is drawn by the browser,
 * not by the application, so it looks as though it belongs to a
 * different program. It cannot be styled, it cannot be translated, on
 * a phone it can sit behind the page, and it stops the application
 * dead while it is there.
 *
 * This is the same news, given by the application:
 *
 * - it slides in from the corner rather than taking over the screen;
 * - it carries the character, whose face says what kind of news this
 *   is before the words are read;
 * - it goes away by itself after a few seconds, and the reader can
 *   send it away sooner;
 * - it is announced to a screen reader, because a message that only
 *   exists visually is a message some readers never get.
 */

import { useEffect } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { MascotCompanion } from './MascotCompanion';

/**
 * The face for each kind of news.
 *
 * The face says what the words say, before the words are read.
 */
const MOOD = {
  success: 'happy',
  error: 'worried',
  warning: 'worried',
  info: 'shopkeeper',
};

const ICON = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const TONE = {
  success: 'moe-toast--success',
  error: 'moe-toast--error',
  warning: 'moe-toast--warning',
  info: 'moe-toast--info',
};

/**
 * One toast.
 */
export function MoeToastItem({ item, onDismiss }) {
  const { t } = useTranslation();
  const tone = TONE[item.type] || TONE.info;
  const Icon = ICON[item.type] || Info;
  const mood = MOOD[item.type] || MOOD.info;

  useEffect(() => {
    if (!item.duration || item.duration <= 0) return undefined;
    const timer = setTimeout(() => onDismiss?.(item.id), item.duration);
    return () => clearTimeout(timer);
  }, [item.id, item.duration, onDismiss]);

  return (
    <div
      className={`moe-toast ${tone}`.trim()}
      role={item.type === 'error' ? 'alert' : 'status'}
      aria-live={item.type === 'error' ? 'assertive' : 'polite'}
      data-type={item.type}
    >
      <MascotCompanion mood={mood} size={36} className="moe-toast__mascot" />

      <div className="moe-toast__body">
        {item.title ? <p className="moe-toast__title">{item.title}</p> : null}
        <p className="moe-toast__message">{item.message}</p>
        {item.action ? (
          <button type="button" className="moe-toast__action pressable" onClick={item.action.onClick}>
            {item.action.label}
          </button>
        ) : null}
      </div>

      <Icon className="moe-toast__icon" size={18} aria-hidden="true" />

      <button
        type="button"
        className="moe-toast__close pressable"
        onClick={() => onDismiss?.(item.id)}
        aria-label={t('moe.toast_dismiss', 'Close')}
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * The stack of toasts.
 *
 * It lives in the corner of the window, above everything else, and it
 * never takes the focus, so a reader who is typing is not interrupted.
 */
export default function MoeToast({ items = [], onDismiss }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="moe-toast-stack" aria-live="polite" aria-relevant="additions">
      {items.map((item) => (
        <MoeToastItem key={item.id} item={item} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

export { MOOD, TONE };
