// The reminders.
//
// A reminder is a nudge to record the day's spending. It is opt-in:
// nothing is sent, and nothing is even asked for, until the reader
// turns the reminders on.
//
// The reminder is shown by the browser, not by this page. The service
// worker already knows how to show a notification and to open the app
// when it is tapped, so this schedules the work and hands it over.
//
// Nothing is sent anywhere. The reminder never leaves the device.

import { useEffect, useRef } from 'react';
import { useTranslation } from '../../i18n';
import { batch6 } from '../../i18n/keys_batch6';
import { readerFlag } from '../../utils/featureFlags';
import { api } from '../../services/api';

/** Where the reader is sent when they tap the reminder. */
const TARGET = '/transactions';

/**
 * Has the browser allowed notifications?
 *
 * 'default' means it has not been asked yet, which is different from
 * 'denied'. The first one can still be asked for; the second cannot.
 */
export function permissionState() {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

/**
 * Ask the browser for permission.
 *
 * The answer is whatever the browser says. It has to be asked for from
 * a click, which is why this is called from a button rather than on
 * load.
 */
export async function askPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/**
 * Show one reminder now.
 *
 * This is the "send one now" button on the settings page. It uses the
 * service worker where there is one, because that is the path that
 * works when the page is closed, and falls back to the plain
 * notification API.
 */
export async function showNow(title, body) {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission !== 'granted') return false;

  try {
    const registration = await navigator.serviceWorker?.getRegistration?.();
    if (registration) {
      await registration.showNotification(title, {
        body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        data: { url: TARGET },
        tag: 'finmanager-reminder',
      });
      return true;
    }
  } catch {
    /* fall through to the plain notification */
  }

  try {
    // eslint-disable-next-line no-new
    new Notification(title, { body, icon: '/icons/icon-192x192.png', tag: 'finmanager-reminder' });
    return true;
  } catch {
    return false;
  }
}

/**
 * When the next reminder is due.
 *
 * The reminder is worked out from the last one that was shown, so
 * closing the tab does not make it appear twice in a row, and the
 * frequency is the one the reader chose.
 */
export function nextDue(lastShownAt, frequency, now = Date.now()) {
  if (!frequency || frequency === 'never') return null;

  const DAY = 24 * 60 * 60 * 1000;
  const from = lastShownAt ? Number(lastShownAt) : now;

  switch (frequency) {
    case 'daily':
      return from + DAY;
    case 'weekly':
      return from + 7 * DAY;
    case 'monthly':
      return from + 30 * DAY;
    default:
      return null;
  }
}

/**
 * The scheduler.
 *
 * It sits in the app and wakes up on a timer. When the time comes, it
 * asks the server whether the reader has anything to be reminded
 * about, and shows a reminder if there is.
 *
 * The server decides whether to remind, so the reminder can be about
 * something real: an unpaid bill that is due, a budget that has run
 * out, or a day with nothing recorded.
 */
export default function ReminderScheduler() {
  const { language } = useTranslation();
  const K = batch6[language]?.a5 || batch6.id.a5;
  const timerRef = useRef(null);

  useEffect(() => {
    // The reminders are off until they are turned on. Nothing is
    // scheduled, nothing is asked of the browser, and nothing is sent.
    if (!readerFlag('REMINDERS')) return undefined;
    if (typeof Notification === 'undefined') return undefined;
    if (Notification.permission !== 'granted') return undefined;

    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;

      let settings = null;
      try {
        settings = await api.request('/settings/notifications');
      } catch {
        // The server is not reachable. Nothing is shown, and the next
        // tick tries again.
        return;
      }

      // The reminders are opt-in. The reader has to have turned them
      // on, and the server is the one that remembers that.
      if (!settings?.reminder_enabled) return;

      const frequency = settings?.reminder_frequency;
      const lastShown = window.localStorage.getItem('reminderLastShown');
      const due = nextDue(lastShown, frequency);

      if (due && Date.now() >= due) {
        let reminder = null;
        try {
          reminder = await api.request('/reminders/next');
        } catch {
          reminder = null;
        }

        // Nothing to remind about is not a reason to show a reminder.
        if (reminder && reminder.should_remind) {
          // The sentence the server sends is written in one language,
          // so the code is what is shown. The code has a name in the
          // reader's language; the sentence is only the fallback.
          const codeKey = reminder.message_key || `reminder_code_${reminder.code}`;
          const body = K[codeKey] || reminder.message || K.reminders_intro;
          const shown = await showNow(
            reminder.title || K.reminders_title,
            body
          );
          if (shown) {
            window.localStorage.setItem('reminderLastShown', String(Date.now()));
          }
        } else {
          // There was nothing to say. The clock still moves, so the
          // reader is asked again at the next interval rather than on
          // every tick.
          window.localStorage.setItem('reminderLastShown', String(Date.now()));
        }
      }
    };

    // The timer runs every fifteen minutes, which is often enough for
    // a daily reminder to land near the right time and rare enough not
    // to keep the phone awake.
    timerRef.current = setInterval(tick, 15 * 60 * 1000);
    tick();

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [K]);

  return null;
}
