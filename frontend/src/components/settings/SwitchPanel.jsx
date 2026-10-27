// The display options.
//
// Every switch that a reader can turn on lives here, in one place, so
// none of them is a thing that exists but cannot be reached.
//
// The switches are stored in the browser, not on the server, so they
// belong to this device. Turning one on changes what the reader sees;
// none of them changes any data.

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '../../i18n';
import { batch6 } from '../../i18n/keys_batch6';
import {
  readerFlag,
  setReaderFlag,
  clearReaderFlags,
} from '../../utils/featureFlags';

const SWITCHES = [
  { flag: 'NAV_V2', label: 'switches_nav_v2', desc: 'switches_nav_v2_desc' },
  { flag: 'SINGLE_ADD', label: 'switches_single_add', desc: 'switches_single_add_desc' },
  { flag: 'ADVANCED_FEATURES', label: 'switches_advanced', desc: 'switches_advanced_desc' },
  { flag: 'REMINDERS', label: 'switches_reminders', desc: 'switches_reminders_desc' },
];

/**
 * The panel.
 *
 * The state is read once on mount and then kept in step by hand, so
 * that turning a switch on redraws the panel straight away rather
 * than waiting for a reload.
 */
export default function SwitchPanel() {
  const { language } = useTranslation();
  const K = batch6[language]?.a5 || batch6.id.a5;
  const [state, setState] = useState(() => ({
    NAV_V2: readerFlag('NAV_V2'),
    SINGLE_ADD: readerFlag('SINGLE_ADD'),
    ADVANCED_FEATURES: readerFlag('ADVANCED_FEATURES'),
    REMINDERS: readerFlag('REMINDERS'),
  }));
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(() => setMessage(''), 3000);
    return () => clearTimeout(timer);
  }, [message]);

  const toggle = useCallback((flag, value) => {
    setReaderFlag(flag, value);
    setState((prev) => ({ ...prev, [flag]: value }));
  }, []);

  const reset = useCallback(() => {
    clearReaderFlags();
    setState({
      NAV_V2: false,
      SINGLE_ADD: false,
      ADVANCED_FEATURES: false,
      REMINDERS: false,
    });
    setMessage(K.switches_reset_done);
  }, [K]);

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <h2 className="font-bold text-lg mb-1">{K.switches_title}</h2>
      <p className="text-sm text-gray-500 mb-4">{K.switches_intro}</p>

      {message && (
        <div className="p-3 bg-green-100 text-green-700 rounded-lg mb-4 text-sm">
          {message}
        </div>
      )}

      <div className="space-y-4">
        {SWITCHES.map(({ flag, label, desc }) => (
          <div
            key={flag}
            className="flex items-start justify-between gap-4 py-2 border-b border-gray-100 last:border-b-0"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800">{K[label]}</p>
              <p className="text-xs text-gray-500 mt-0.5">{K[desc]}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={state[flag]}
              aria-label={K[label]}
              onClick={() => toggle(flag, !state[flag])}
              className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200 ${
                state[flag] ? 'bg-primary-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200 ${
                  state[flag] ? 'left-[22px]' : 'left-0.5'
                }`}
              />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={reset}
        className="mt-4 text-sm text-gray-500 underline hover:text-gray-700"
      >
        {K.switches_reset}
      </button>
    </div>
  );
}
