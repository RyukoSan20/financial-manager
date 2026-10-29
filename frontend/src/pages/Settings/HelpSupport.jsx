// Help & Support Page - FAQs + contact form backed by POST/GET /api/settings/support
import { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { useTranslation } from '../../i18n';
import { batch2 } from '../../i18n/keys_batch2';
// The version is read from the package, so the number on the screen
// cannot drift away from the number that was actually built.
import packageInfo from '../../../package.json';

const HelpSupport = () => {
  const { t, language } = useTranslation();
  const K = batch2[language]?.help || batch2.id.help;
  const APP_VERSION = packageInfo.version;
  const [expanded, setExpanded] = useState(null);
  const [contactForm, setContactForm] = useState({
    subject: '',
    message: ''
  });
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const faqs = [
    {
      id: 1,
      questionKey: 'help_support.faq_1_question',
      answerKey: 'help_support.faq_1_answer',
    },
    {
      id: 2,
      questionKey: 'help_support.faq_2_question',
      answerKey: 'help_support.faq_2_answer',
    },
    {
      id: 3,
      questionKey: 'help_support.faq_3_question',
      answerKey: 'help_support.faq_3_answer',
    },
    {
      id: 4,
      questionKey: 'help_support.faq_4_question',
      answerKey: 'help_support.faq_4_answer',
    },
    {
      id: 5,
      questionKey: 'help_support.faq_5_question',
      answerKey: 'help_support.faq_5_answer',
    },
    {
      id: 6,
      questionKey: 'help_support.faq_6_question',
      answerKey: 'help_support.faq_6_answer',
    },
    {
      id: 7,
      questionKey: 'help_support.faq_7_question',
      answerKey: 'help_support.faq_7_answer',
    },
    {
      id: 8,
      questionKey: 'help_support.faq_8_question',
      answerKey: 'help_support.faq_8_answer',
    },
  ];

  const loadRequests = useCallback(async () => {
    try {
      const data = await api.request('/settings/support');
      setRequests(Array.isArray(data) ? data : []);
    } catch (e) {
      // Not critical - the contact form still works.
      console.error('Load support requests error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      await api.request('/settings/support', {
        method: 'POST',
        body: JSON.stringify({
          subject: contactForm.subject,
          message: contactForm.message
        })
      });
      setMessage(t('help_support.sent'));
      setContactForm({ subject: '', message: '' });
      await loadRequests();
      setTimeout(() => setMessage(''), 5000);
    } catch (err) {
      setError(err.message || K.send_error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-primary-600 text-white p-4 sticky top-0 z-10">
        <h1 className="text-xl font-bold">{t('help_support.title')}</h1>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-4">
        {/* Quick Links */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="font-bold text-lg mb-4">{t('help_support.contact')}</h2>

          <div className="grid grid-cols-2 gap-3">
            <a
              href="mailto:support@my-financial-manager.online"
              className="flex flex-col items-center p-4 bg-primary-50 rounded-lg hover:bg-primary-100"
            >
              <span className="text-2xl mb-2">📧</span>
              <span className="text-sm font-medium">{t('help_support.email_label')}</span>
            </a>
            <a
              href="tel:+628000000000"
              className="flex flex-col items-center p-4 bg-green-50 rounded-lg hover:bg-green-100"
            >
              <span className="text-2xl mb-2">📱</span>
              <span className="text-sm font-medium">{t('help_support.whatsapp')}</span>
            </a>
          </div>
        </div>

        {/* FAQs */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="font-bold text-lg mb-4">{t('help_support.faq')}</h2>

          <div className="space-y-2">
            {faqs.map(faq => (
              <div key={faq.id} className="border-b last:border-b-0">
                <button
                  onClick={() => setExpanded(expanded === faq.id ? null : faq.id)}
                  className="w-full py-3 flex items-center justify-between text-left"
                >
                  <span className="font-medium pr-4">{t(faq.questionKey)}</span>
                  <span
                    className={`transform transition-transform ${
                      expanded === faq.id ? 'rotate-180' : ''
                    }`}
                  >
                    ▼
                  </span>
                </button>
                {expanded === faq.id && (
                  <div className="pb-3 text-gray-600 text-sm">{t(faq.answerKey)}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Contact Form */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="font-bold text-lg mb-4">{t('help_support.send')}</h2>

          {message && (
            <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-lg">{message}</div>
          )}
          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('help_support.subject')}</label>
              <input
                type="text"
                value={contactForm.subject}
                onChange={e => setContactForm({ ...contactForm, subject: e.target.value })}
                className="w-full p-3 border rounded-lg"
                placeholder={t('help_support.subject_placeholder')}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('help_support.message')}</label>
              <textarea
                value={contactForm.message}
                onChange={e => setContactForm({ ...contactForm, message: e.target.value })}
                className="w-full p-3 border rounded-lg h-32"
                placeholder={t('help_support.message_placeholder')}
                required
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold disabled:opacity-50"
            >
              {submitting ? t('help_support.sending') : '📤 ' + t('help_support.send')}
            </button>
          </form>
        </div>

        {/* My Requests */}
        {!loading && requests.length > 0 && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h2 className="font-bold text-lg mb-4">{t('help_support.history')}</h2>
            <div className="space-y-3">
              {requests.map(req => (
                <div key={req.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-sm">{req.subject}</p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        req.status === 'open'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {req.status === 'open'
                        ? K.status_open
                        : req.status === 'closed'
                        ? K.status_closed
                        : req.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{req.message}</p>
                  {req.response && (
                    <div className="mt-2 p-2 bg-primary-50 rounded text-sm text-primary-800">
                      <strong>{t('help_support.reply')}</strong> {req.response}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* App Info */}
        <div className="bg-gray-100 rounded-xl p-4 text-center text-sm text-gray-500">
          <p>Financial Manager {APP_VERSION}</p>
          <p>{t('help_support.rights')}</p>
        </div>
      </div>
    </div>
  );
};

export default HelpSupport;
