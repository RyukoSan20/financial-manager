// The screen for a feature that is turned off.
//
// Some features are out of the way until a reader asks for them. If
// they reach one anyway — an old link, a bookmark, the back button —
// this says what is going on and where to turn it on, rather than
// showing an empty page or a blank error.

import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import { batch6 } from '../../i18n/keys_batch6';
import { setReaderFlag } from '../../utils/featureFlags';
import { Lock } from 'lucide-react';

export default function AdvancedLocked({ onTurnedOn }) {
  const { language } = useTranslation();
  const K = batch6[language]?.a5 || batch6.id.a5;
  const navigate = useNavigate();

  const turnOn = () => {
    setReaderFlag('ADVANCED_FEATURES', true);
    if (onTurnedOn) onTurnedOn();
    else navigate(-1);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <Lock className="w-6 h-6 text-gray-400" />
        </div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
          {K.advanced_locked_title}
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          {K.advanced_locked_body}
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button
            type="button"
            onClick={turnOn}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700"
          >
            {K.advanced_locked_go}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium"
          >
            {K.advanced_locked_back}
          </button>
        </div>
      </div>
    </div>
  );
}
