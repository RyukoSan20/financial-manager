// Gmail Integration Page - Beautiful UI
import { useState, useEffect } from "react";
import { useTranslation } from '../i18n';
import { gmailView } from '../utils/gmailState';
import PixelArtBusinessIcon from '../components/ui/PixelArtBusinessIcon';
import DraggableSparkleMascot from '../components/mascot/DraggableSparkleMascot';
import { SAMPLE_EMAILS, parseSampleEmail } from '../utils/sampleEmailParser';
import { api } from '../services/api';
import { toast } from '../contexts/ToastContext';
import { ask } from '../contexts/ConfirmContext';

const GmailIntegration = () => {
  const { t, language } = useTranslation();
  // The guest-friendly simulation of an email import.
  const [simOpen, setSimOpen] = useState(false);
  const [simIndex, setSimIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  // The state comes from the server as a code, so it can be shown in
  // the language of the reader. The message is only the fallback.
  const [status, setStatus] = useState({
    connected: false,
    state: 'checking',
    configured: true,
    message: '',
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    checkStatus();
  }, []);

  // What the page shows. The state is worked out in one place, so the
  // title and the message under it can never disagree with each other.
  const view = gmailView({
    checking,
    connected: status.connected,
    state: status.state,
    configured: status.configured,
  });

  // The message for a state, in the reader's language.
  const stateMessage = (code) => {
    const key = `gmail_integration.state_${code}`;
    const translated = t(key, '');
    if (translated) return translated;
    return status.message || t('gmail_integration.not_connected_status');
  };

  const checkStatus = async () => {
    try {
      const data = await api.request('/integrations/gmail/status');
      setStatus({
        connected: Boolean(data.connected),
        state: data.state || (data.connected ? 'connected' : 'not_connected'),
        configured: data.configured !== false,
        connected_at: data.connected_at || null,
        message: data.message || '',
      });
    } catch (e) {
      setStatus({
        connected: false,
        state: 'not_connected',
        configured: true,
        message: '',
      });
    } finally {
      setChecking(false);
    }
  };

  const connectGmail = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.request('/integrations/gmail/connect');
      if (data.auth_url) window.location.href = data.auth_url;
      else setError(t('gmail_integration.oauth_unavailable'));
    } catch (e) {
      // The server says what went wrong with a code, so the message
      // can be in the reader's language.
      const code = e?.code || 'connect_failed';
      const key = `gmail_integration.error_${code}`;
      const translated = t(key, '');
      setError(translated || t('gmail_integration.connect_failed'));
    } finally {
      setLoading(false);
    }
  };

  const disconnectGmail = async () => {
    if (!(await ask({ message: t('gmail_integration.disconnect_confirm'), tone: 'danger' }))) return;

    setError(null);
    try {
      await api.request('/integrations/gmail/disconnect', { method: 'POST' });
      setStatus({
        connected: false,
        state: 'not_connected',
        configured: status.configured,
        message: '',
      });
    } catch (e) {
      setError(t('gmail_integration.disconnect_failed'));
    }
  };

  const en = language === 'en';
  const strip = (text) => String(text || '').replace(/^[^\p{L}\p{N}]+/u, '').trim();

  const BANKS = [
    { name: 'BCA', tint: '#E3F2FD', icon: 'ledger_blue' },
    { name: 'Mandiri', tint: '#FFF8E1', icon: 'ledger_blue' },
    { name: 'BNI', tint: '#E0F2F1', icon: 'ledger_green' },
    { name: 'BRI', tint: '#E8EAF6', icon: 'ledger_blue' },
    { name: 'GoPay', tint: '#E0F7FA', icon: 'ewallet' },
    { name: 'OVO', tint: '#F3E5F5', icon: 'ewallet' },
    { name: 'DANA', tint: '#E1F5FE', icon: 'ewallet' },
    { name: 'ShopeePay', tint: '#FBE9E7', icon: 'ewallet' },
  ];
  const STEPS = [
    { n: '01', key: 'step1', tint: '#FDE8E4', icon: 'smartphone' },
    { n: '02', key: 'step2', tint: '#FFF6D6', icon: 'receipt' },
    { n: '03', key: 'step3', tint: '#E3F2EA', icon: 'ledger_green' },
    { n: '04', key: 'step4', tint: '#EFE8FA', icon: 'chat_info' },
  ];

  return (
    <div className="kakeibo-dot-canvas -m-4 min-h-full p-4 pb-20 sm:-m-6 sm:p-6" data-testid="gmail-post-office">
     <div className="mx-auto max-w-3xl">
      {/* The Kakeibo Post Office: Kaneru reads the receipts. */}
      <section
        className="relative mb-5 rounded-[24px] border-2 border-[#4A3540] bg-[#FFFDF9] p-6 shadow-[0_8px_0_#E2D6C3] dark:bg-[#2A2420]"
        data-testid="gmail-studio-header"
      >
        <span aria-hidden="true" className="absolute -top-2.5 left-6 h-4 w-20 -rotate-2 rounded-sm bg-[#8EC9E0]/80" />
        <span aria-hidden="true" className="absolute right-5 top-4 text-[#E07A5F]">✦</span>
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <DraggableSparkleMascot persona="kaneru" size={110} mood={view.state === 'connected' ? 'celebrate' : 'thinking'} hint={en ? '✨ Drag me!' : '✋ Geser aku!'} label="Kaneru" />
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#B5654A]">
              {en ? 'Kakeibo Post Office & Auto-Receipt Studio' : 'Kantor Pos Kakeibo & Studio Struk Otomatis'}
            </p>
            <h1 className="mt-1 flex items-center justify-center gap-2 text-2xl font-extrabold text-[#2C221E] dark:text-[#FAF5EE] sm:justify-start">
              <PixelArtBusinessIcon name="receipt" size={42} />
              {t('gmail_integration.title')}
            </h1>
            <p className="mt-2 rounded-2xl border-2 border-[#4A3540] bg-[#FFF6D6] px-3 py-2 text-[12.5px] font-semibold leading-snug text-[#2C221E] shadow-[0_3px_0_#4A3540]">
              {en
                ? 'Kaneru here! I read the receipt emails your bank and e-wallet send you, and write each one into your ledger - you never have to type them.'
                : 'Halo, aku Kaneru! Aku membaca email struk dari bank dan e-wallet-mu, lalu mencatat tiap transaksinya ke buku kas - kamu tidak perlu mengetik lagi.'}
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3 rounded-2xl border-2 border-dashed border-[#4A3540]/40 bg-[#FFFDF9] p-3 dark:bg-transparent" data-testid="gmail-status">
          <PixelArtBusinessIcon name={view.state === 'connected' ? 'income' : 'chat_question'} size={30} />
          <div className="min-w-0">
            <h2 className="font-extrabold text-[#2C221E] dark:text-[#FAF5EE]">{strip(t(view.titleKey))}</h2>
            <p className="text-sm text-[#6B5E57] dark:text-[#CBB8A6]">{stateMessage(view.state)}</p>
          </div>
        </div>

        {view.state === 'connected' ? (
          <div className="mt-4 space-y-3">
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {['feature_auto_scan', 'feature_bank_import', 'feature_ewallet_import', 'feature_hourly_sync'].map((k) => (
                <li key={k} className="flex items-center gap-2 rounded-2xl border-2 border-[#4A3540] bg-[#E3F2EA] px-3 py-2 text-sm font-bold text-[#2C221E]">
                  <span aria-hidden="true">✓</span>{strip(t(`gmail_integration.${k}`))}
                </li>
              ))}
            </ul>
            <button
              onClick={disconnectGmail}
              className="w-full rounded-full border-2 border-[#4A3540] bg-[#FFFDF9] py-3 font-bold text-[#2C221E] shadow-[0_3px_0_#4A3540] active:translate-y-0.5"
            >
              {t('gmail_integration.disconnect_button')}
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-5">
            {view.showNotConfiguredNote && (
              <p className="rounded-2xl border-2 border-[#4A3540] bg-[#FFF6D6] p-3 text-sm text-[#2C221E]">
                {t('gmail_integration.not_configured_note')}
              </p>
            )}

            {/* How it works: a four-card numbered bento. */}
            <div>
              <h3 className="mb-2 flex items-center gap-2 font-extrabold text-[#2C221E] dark:text-[#FAF5EE]">
                <PixelArtBusinessIcon name="lightbulb" size={24} />
                {strip(t('gmail_integration.how_it_works'))}
              </h3>
              <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="gmail-steps">
                {STEPS.map((step) => (
                  <li key={step.n} className="rounded-2xl border-2 border-[#4A3540] p-4 shadow-[0_3px_0_#4A3540]" style={{ background: step.tint }}>
                    <div className="flex items-center justify-between">
                      <span className="rounded-full border-2 border-[#4A3540] bg-[#FFFDF9] px-2.5 py-0.5 text-sm font-black tabular-nums text-[#2C221E]">
                        {step.n}
                      </span>
                      <PixelArtBusinessIcon name={step.icon} size={26} badge={false} />
                    </div>
                    <p className="mt-2 text-[13px] font-bold leading-snug text-[#2C221E]">
                      {String(t(`gmail_integration.${step.key}`)).replace(/^\d+\.\s*/, '')}
                    </p>
                  </li>
                ))}
              </ol>
            </div>

            {/* The banks and e-wallets, as tinted sticker pills. */}
            <div>
              <h3 className="mb-2 font-extrabold text-[#2C221E] dark:text-[#FAF5EE]">{t('gmail_integration.supports')}</h3>
              <div className="flex flex-wrap gap-2" data-testid="gmail-bank-pills">
                {BANKS.map((bank) => (
                  <span
                    key={bank.name}
                    className="inline-flex -rotate-1 items-center gap-1.5 rounded-full border-2 border-[#4A3540] px-3 py-1.5 text-sm font-extrabold text-[#2C221E] shadow-[0_3px_0_#4A3540] odd:rotate-1"
                    style={{ background: bank.tint }}
                  >
                    <PixelArtBusinessIcon name={bank.icon} size={18} badge={false} />
                    {bank.name}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={connectGmail}
                disabled={loading || !view.showConnect}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border-2 border-[#4A3540] bg-[#2F4842] px-6 py-3.5 font-extrabold text-[#FFFDF9] shadow-[0_5px_0_#1B2E28] transition-colors hover:bg-[#233833] active:translate-y-0.5 disabled:opacity-50"
                data-testid="gmail-connect"
              >
                {loading ? (
                  <>
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    {t('gmail_integration.connecting')}
                  </>
                ) : (
                  <>{en ? 'Connect Gmail securely' : 'Hubungkan Gmail dengan Aman'} →</>
                )}
              </button>
              <button
                type="button"
                onClick={() => { setSimIndex((i) => (i + 1) % SAMPLE_EMAILS.length); setSimOpen(true); }}
                className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[#4A3540] bg-[#FFF6D6] px-5 py-3.5 font-extrabold text-[#2C221E] shadow-[0_5px_0_#4A3540] active:translate-y-0.5"
                data-testid="gmail-simulate"
              >
                🧪 {en ? 'Simulate a sample email import' : 'Simulasi Test Import Email Contoh'}
              </button>
            </div>
          </div>
        )}

        {simOpen ? <SampleImportPreview index={simIndex} en={en} onNext={() => setSimIndex((i) => (i + 1) % SAMPLE_EMAILS.length)} onClose={() => setSimOpen(false)} /> : null}
      </section>

      {/* Security */}
      <section className="relative rounded-[24px] border-2 border-[#4A3540] bg-[#FFFDF9] p-5 shadow-[0_6px_0_#E2D6C3] dark:bg-[#2A2420]">
        <span aria-hidden="true" className="absolute -top-2.5 left-6 h-4 w-16 -rotate-2 rounded-sm bg-[#A8E6CF]/80" />
        <h3 className="mb-2 flex items-center gap-2 font-extrabold text-[#2C221E] dark:text-[#FAF5EE]">
          <PixelArtBusinessIcon name="briefcase" size={24} />
          {strip(t('gmail_integration.security'))}
        </h3>
        <ul className="space-y-1 text-sm text-[#5C6460] dark:text-[#CBB8A6]">
          <li>{t('gmail_integration.security_scope')}</li>
          <li>{t('gmail_integration.security_no_email')}</li>
          <li>{t('gmail_integration.security_token')}</li>
          <li>{t('gmail_integration.security_disconnect')}</li>
        </ul>
      </section>

      {error && (
        <div className="mt-4 rounded-2xl border-2 border-[#B5654A] bg-[#FDE8E4] p-3 text-[#7A2E1E]" role="alert">
          {error}
        </div>
      )}
     </div>
    </div>
  );
};

/** The sample import, worked out on the page: nothing is saved. */
function SampleImportPreview({ index, en, onNext, onClose }) {
  const sample = SAMPLE_EMAILS[index];
  const parsed = parseSampleEmail(sample);
  const money = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);
  return (
    <div className="mt-5 grid grid-cols-1 gap-3 rounded-2xl border-2 border-[#4A3540] bg-[#F7F2E7] p-4 sm:grid-cols-2" data-testid="gmail-sim-preview">
      <div className="rounded-xl border-2 border-dashed border-[#4A3540]/50 bg-white p-3 font-mono text-[11.5px] leading-relaxed text-[#3D3530]">
        <p className="font-sans text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#8A7F72]">{en ? 'Sample email' : 'Email contoh'}</p>
        <p><b>From:</b> {sample.from}</p>
        <p><b>Subject:</b> {sample.subject}</p>
        <pre className="mt-1 whitespace-pre-wrap font-mono">{sample.body}</pre>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#8A7F72]">{en ? 'What Kaneru reads' : 'Yang dibaca Kaneru'}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-xl border-2 border-[#4A3540] bg-[#FFFDF9] p-3 text-sm" data-testid="gmail-sim-result">
          <dt className="font-bold text-[#6B5E57]">{en ? 'Source' : 'Sumber'}</dt><dd className="font-extrabold">{parsed.source}</dd>
          <dt className="font-bold text-[#6B5E57]">{en ? 'Type' : 'Jenis'}</dt><dd className="font-extrabold">{parsed.type === 'income' ? (en ? 'Income' : 'Pemasukan') : (en ? 'Expense' : 'Pengeluaran')}</dd>
          <dt className="font-bold text-[#6B5E57]">{en ? 'Amount' : 'Jumlah'}</dt><dd className="font-extrabold tabular-nums" data-testid="gmail-sim-amount">{money(parsed.amount)}</dd>
          <dt className="font-bold text-[#6B5E57]">{en ? 'Merchant' : 'Merchant'}</dt><dd className="font-extrabold">{parsed.merchant || '-'}</dd>
          <dt className="font-bold text-[#6B5E57]">{en ? 'Date' : 'Tanggal'}</dt><dd className="font-extrabold">{parsed.date || '-'}</dd>
        </dl>
        <p className="text-[11px] text-[#6B5E57]">{en ? 'Simulation only - nothing is saved to your ledger.' : 'Hanya simulasi - tidak ada yang disimpan ke buku kas.'}</p>
        <div className="mt-auto flex gap-2">
          <button type="button" onClick={onNext} className="flex-1 rounded-full border-2 border-[#4A3540] bg-[#FFF6D6] px-3 py-2 text-sm font-extrabold shadow-[0_3px_0_#4A3540]">{en ? 'Another sample' : 'Contoh lain'}</button>
          <button type="button" onClick={onClose} className="rounded-full border-2 border-[#4A3540] bg-[#FFFDF9] px-3 py-2 text-sm font-bold shadow-[0_3px_0_#4A3540]">{en ? 'Close' : 'Tutup'}</button>
        </div>
      </div>
    </div>
  );
}

export default GmailIntegration;
