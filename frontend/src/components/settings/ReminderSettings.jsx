// The reminders, on the settings page.
//
// The reader turns the reminders on here, says how often they want
// them, and can try one out to see what it looks like.
//
// Nothing is sent anywhere. The reminder is shown by the browser on
// this device, and it stops the moment the reader turns it off.

import { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n';
import { batch6 } from '../../i18n/keys_batch6';
import { readerFlag } from '../../utils/featureFlags';
import { api } from '../../services/api';
import {
  askPermission,
  permissionState,
  showNow,
} from '../notifications/ReminderScheduler';

const FREQUENCIES = ['daily', 'weekly', 'monthly'];

export default function ReminderSettings() {
  const { language } = useTranslation();
  const K = batch6[language]?.a5 || batch6.id.a5;

  const [enabled, setEnabled] = useState(false);
  const [frequency, setFrequency] = useState('daily');
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [time, setTime] = useState('19:00');
  const [permission, setPermission] = useState('default');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  // The reminders are a reader switch. When it is off, the panel is
  // not shown at all, and nothing is scheduled.
  const enabledByReader = readerFlag('REMINDERS');

  useEffect(() => {
    if (!enabledByReader) return undefined;
    setPermission(permissionState());

    let cancelled = false;
    api
      .request('/settings/notifications')
      .then((settings) => {
        if (cancelled || !settings) return;
        setEnabled(Boolean(settings.reminder_enabled));
        if (settings.reminder_frequency) setFrequency(settings.reminder_frequency);
        if (settings.reminder_time) setTime(settings.reminder_time);
        if (settings.reminder_day_of_week !== null && settings.reminder_day_of_week !== undefined) {
          setDayOfWeek(Number(settings.reminder_day_of_week));
        }
      })
      .catch(() => {
        /* the settings are not available; the reader can still set them */
      });

    return () => {
      cancelled = true;
    };
  }, [enabledByReader]);

  if (!enabledByReader) return null;

  const save = async (next) => {
    setSaving(true);
    try {
      await api.request('/settings/notifications', {
        method: 'PUT',
        body: JSON.stringify({
          reminder_enabled: next.enabled,
          reminder_frequency: next.frequency,
          reminder_day_of_week: next.dayOfWeek,
          reminder_time: next.time,
        }),
      });
      setStatus(K.reminders_saved);
    } catch {
      setStatus(K.reminders_not_enabled);
    } finally {
      setSaving(false);
    }
  };

  const onToggle = async (value) => {
    setEnabled(value);

    if (value && permission !== 'granted') {
      const answer = await askPermission();
      setPermission(answer);
      if (answer !== 'granted') {
        // The browser refused. The reader is told, rather than being
        // left wondering why nothing comes.
        setStatus(K.reminders_permission_denied);
        setEnabled(false);
        await save({ enabled: false, frequency, dayOfWeek, time });
        return;
      }
    }

    await save({ enabled: value, frequency, dayOfWeek, time });
  };

  const sendATest = async () => {
    const sent = await showNow(K.reminders_title, K.reminders_intro);
    setStatus(sent ? K.reminders_test_sent : K.reminders_permission_needed);
  };

  const days = [
    { value: 0, label: 'Sun' },
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' },
    { value: 6, label: 'Sat' },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {K.reminders_title}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">{K.reminders_intro}</p>
      </div>

      {/* The switch itself. */}
      <label className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {K.reminders_title}
        </span>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
          className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          aria-label={K.reminders_title}
        />
      </label>

      {/* What the browser has said about the permission. */}
      {permission === 'denied' && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          {K.reminders_permission_denied}
        </p>
      )}
      {permission === 'granted' && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          {K.reminders_permission_granted}
        </p>
      )}
      {permission === 'unsupported' && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {K.reminders_permission_needed}
        </p>
      )}

      {/* The frequency, and the day and time for the weekly one. */}
      {enabled && (
        <div className="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {K.reminders_frequency}
            </label>
            <select
              value={frequency}
              onChange={(e) => {
                setFrequency(e.target.value);
                save({ enabled, frequency: e.target.value, dayOfWeek, time });
              }}
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            >
              {FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {f === 'daily' && K.reminders_frequency_daily}
                  {f === 'weekly' && K.reminders_frequency_weekly}
                  {f === 'monthly' && K.reminders_frequency_monthly}
                </option>
              ))}
            </select>
          </div>

          {frequency === 'weekly' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {K.reminders_day_of_week}
              </label>
              <select
                value={dayOfWeek}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setDayOfWeek(v);
                  save({ enabled, frequency, dayOfWeek: v, time });
                }}
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              >
                {days.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {K.reminders_time}
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => {
                setTime(e.target.value);
                save({ enabled, frequency, dayOfWeek, time: e.target.value });
              }}
              className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
        </div>
      )}

      {/* A way to see what a reminder looks like. */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={sendATest}
          disabled={permission !== 'granted'}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          {K.reminders_test}
        </button>
        {status && <span className="text-sm text-gray-600 dark:text-gray-300">{status}</span>}
        {saving && <span className="text-xs text-gray-400">{saving ? '…' : ''}</span>}
      </div>
    </div>
  );
}
