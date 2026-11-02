// The page an invited person opens.
//
// The link carries a token, and the token is the pass. The person who
// opens it puts a name in and becomes a member of the group.
//
// There is no sign-in here, and that is deliberate. An invitation may
// be sent to somebody who has never used this application, and making
// them make an account first would mean making an account out of an
// address that nobody has proved. So this page makes a member of the
// group and nothing else.
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Users, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import { useTranslation } from '../../i18n';
import { batch11, fill } from '../../i18n/keys_batch11';

const SplitInvitePage = () => {
  const { language } = useTranslation();
  const K = batch11[language]?.invite || batch11.id.invite;
  const { token } = useParams();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  const join = async (event) => {
    event.preventDefault();
    if (!displayName.trim()) {
      setError(K.join_failed);
      return;
    }
    if (!token) {
      setError(K.token_missing);
      return;
    }

    setJoining(true);
    setError('');
    try {
      const answer = await api.request('/split-invitations/join', {
        method: 'POST',
        body: JSON.stringify({
          token,
          display_name: displayName.trim(),
        }),
      });
      // The person is in. They are sent to the group, and the group
      // is where the bill is.
      if (answer.group_id) {
        navigate(`/split/${answer.group_id}`);
      }
    } catch (err) {
      console.error('Joining failed:', err);
      const status = err.status || err.statusCode;
      if (status === 410) setError(K.expired);
      else if (status === 409) setError(K.used);
      else if (status === 404) setError(K.expired);
      else setError(err.message || K.join_failed);
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-xl shadow p-6">
        <div className="text-center mb-5">
          <Users className="w-10 h-10 mx-auto text-primary-600 dark:text-primary-400 mb-3" aria-hidden="true" />
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">
            {K.join_title}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {K.join_subtitle}
          </p>
        </div>

        <form onSubmit={join} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {K.your_name}
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoFocus
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
            />
          </div>

          {error && (
            <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-xs">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={joining}
            className="w-full py-3 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {joining ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : null}
            {joining ? K.joining : K.join}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SplitInvitePage;
export { SplitInvitePage };
