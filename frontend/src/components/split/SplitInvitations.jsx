// Inviting somebody to a shared bill.
//
// The host writes down an address, and the answer is a link. Nothing
// is sent from the server, because a server that sends mail on its own
// is a server that can be made to send mail to anybody. The link is
// the host's to click, and the host can read the message before it
// goes.
//
// The invitation is a row with a token. The token is used once. The
// person who opens the link becomes a member of the group and nothing
// else: no account is made from an address that nobody has proved.
import { useState, useEffect, useCallback } from 'react';
import { Mail, Copy, Check, Users, ExternalLink, X } from 'lucide-react';
import { api } from '../../services/api';
import { useTranslation } from '../../i18n';
import { batch11, fill } from '../../i18n/keys_batch11';
import { toast } from '../../contexts/ToastContext';
import { ask } from '../../contexts/ConfirmContext';

/**
 * Is this an address that could be an address?
 *
 * The server checks this too. This is here so that the host is told
 * straight away rather than after a round trip.
 */
const looksLikeAnAddress = (text) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(text || '').trim());

const STATUS_STYLE = {
  INVITED: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  JOINED: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  EXPIRED: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300',
};

const SplitInvitations = ({ groupId }) => {
  const { language } = useTranslation();
  const K = batch11[language]?.invite || batch11.id.invite;

  const [email, setEmail] = useState('');
  const [role, setRole] = useState('MEMBER');
  const [sending, setSending] = useState(false);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastLink, setLastLink] = useState(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const found = await api.request(`/split-invitations/groups/${groupId}/invitations`);
      setInvitations(found || []);
    } catch (err) {
      console.error('The invitations could not be loaded:', err);
      setInvitations([]);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  const invite = async (event) => {
    event.preventDefault();
    if (!looksLikeAnAddress(email)) {
      toast.warning(K.email_invalid);
      return;
    }

    setSending(true);
    try {
      const answer = await api.request(`/split-invitations/groups/${groupId}/invitations`, {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), role }),
      });
      setLastLink(answer);
      setEmail('');
      toast.success(K.sent);
      load();
    } catch (err) {
      console.error('The invitation could not be made:', err);
      toast.error(K.send_failed);
    } finally {
      setSending(false);
    }
  };

  const copyLink = async (link) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success(K.copied);
    } catch (err) {
      console.error('The link could not be copied:', err);
      toast.error(K.copy_failed);
    }
  };

  const revoke = async (invitation) => {
    const confirmed = await ask({
      message: `${K.revoke}: ${invitation.email}?`,
      tone: 'danger',
    });
    if (!confirmed) return;

    try {
      await api.request(`/split-invitations/invitations/${invitation.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'EXPIRED' }),
      });
      toast.success(K.revoked);
      load();
    } catch (err) {
      console.error('The invitation could not be called off:', err);
      toast.error(K.revoke_failed);
    }
  };

  const statusLabel = (status) => {
    if (status === 'JOINED') return K.status_joined;
    if (status === 'EXPIRED') return K.status_expired;
    return K.status_invited;
  };

  return (
    <div className="space-y-4">
      {/* Writing an address down */}
      <form onSubmit={invite} className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={K.email_placeholder}
              aria-label={K.email}
              className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
            />
          </div>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            aria-label={K.role}
            className="px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
          >
            <option value="MEMBER">{K.role_member}</option>
            <option value="ADMIN">{K.role_admin}</option>
          </select>
          <button
            type="submit"
            disabled={sending}
            className="px-4 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium disabled:opacity-50"
          >
            {sending ? '...' : K.send}
          </button>
        </div>
      </form>

      {/* The link that was just made */}
      {lastLink && (
        <div className="p-3 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 space-y-2">
          <div className="text-xs text-green-800 dark:text-green-200">
            {lastLink.draft_created ? K.draft_ready : K.no_draft}
          </div>

          <div className="flex flex-wrap gap-2">
            {lastLink.mailto_link && (
              <a
                href={lastLink.mailto_link}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 text-green-700 dark:text-green-300 text-xs font-medium border border-green-200 dark:border-green-800"
              >
                <Mail className="w-3.5 h-3.5" aria-hidden="true" />
                {K.open_mail}
              </a>
            )}
            {lastLink.gmail_draft_url && (
              <a
                href={lastLink.gmail_draft_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 text-green-700 dark:text-green-300 text-xs font-medium border border-green-200 dark:border-green-800"
              >
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                {K.open_gmail}
              </a>
            )}
            <button
              onClick={() => copyLink(lastLink.invite_url)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 text-green-700 dark:text-green-300 text-xs font-medium border border-green-200 dark:border-green-800"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <Copy className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              {K.copy_link}
            </button>
          </div>

          <div className="text-[11px] text-green-800 dark:text-green-200 break-all">
            {lastLink.invite_url}
          </div>
        </div>
      )}

      {/* The invitations that have been made */}
      <div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">
          <Users className="w-3.5 h-3.5" aria-hidden="true" />
          {K.list}
        </div>

        {loading ? (
          <div className="text-xs text-gray-400 py-3">{K.list}...</div>
        ) : invitations.length === 0 ? (
          <div className="text-xs text-gray-500 dark:text-gray-400 py-3 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-3">
            {K.no_invitations}
          </div>
        ) : (
          <div className="space-y-1.5">
            {invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-gray-900 dark:text-gray-100 truncate">
                    {invitation.email}
                  </div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400">
                    {invitation.role}
                    {invitation.expires_at
                      ? ` · ${K.expires}: ${new Date(invitation.expires_at).toLocaleDateString()}`
                      : ''}
                  </div>
                </div>

                <span
                  className={`text-[10px] px-2 py-0.5 rounded ${STATUS_STYLE[invitation.status] || STATUS_STYLE.EXPIRED}`}
                >
                  {statusLabel(invitation.status)}
                </span>

                {invitation.status === 'INVITED' && (
                  <button
                    onClick={() => revoke(invitation)}
                    aria-label={K.revoke}
                    title={K.revoke}
                    className="p-1 text-gray-400 hover:text-red-500"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SplitInvitations;
export { SplitInvitations, looksLikeAnAddress };
