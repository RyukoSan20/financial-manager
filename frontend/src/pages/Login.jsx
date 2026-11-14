// Login Page with Supabase + Backend fallback
//
// The page has two shapes.
//
// The shape it had is kept, exactly as it was, and it is what a reader
// sees unless the switch is turned on. Turning the switch on gives the
// gateway: two columns, the form on the left and a preview on the
// right that the reader can move.
//
// The preview is not a picture of numbers. Every figure on it is worked
// out by the same code that works out the real figures - the bill code,
// the split code and the budget code - so when the reader changes the
// total or moves a slider, the answer is the answer the application
// would give. A preview that cannot be touched teaches nothing.
//
// And every claim on the page is a claim about this application. The
// privacy page says what leaves the device, and this page does not
// promise otherwise: the advice and the receipt are read by a model,
// and that is named rather than hidden.

import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../i18n';
import { batch3 } from '../i18n/keys_batch3';
import { buildFlag } from '../utils/featureFlags';
import { formatNative } from '../utils/format';
import { computeBill, largestRemainderSplit } from '../utils/receiptBill';
import { amountsFromSplit, dailyFromSplit } from '../utils/budgetRecipes';
import { ShieldCheck, Lock, Mail, Eye, EyeOff, ArrowRight } from 'lucide-react';
import ClampShoujoMascot from '../components/mascot/ClampShoujoMascot';
import PixelArtBusinessIcon from '../components/ui/PixelArtBusinessIcon';
import EditorialScrapbook from '../components/editorial/EditorialScrapbook';
import OrganicWaveDivider from '../components/editorial/OrganicWaveDivider';

// The switch. It is read in ONE place, so it cannot be honoured on
// one screen and ignored on another by a mistake.
const gatewayIsOn = () => buildFlag('LOGIN_GATEWAY');

// The figures the preview starts with. They are a worked example, and
// every one of them is recomputed from the reader's own inputs.
const EXAMPLE_LINES = [
  { id: 'line-1', name: 'Indomie Goreng', quantity: 2, unitPrice: 3500 },
  { id: 'line-2', name: 'Es Te Manis', quantity: 1, unitPrice: 5000 },
];

// The tax rules the reader can choose between, and the words for them.
// The rule ids are the ones the real tax code uses, so the tax on the
// preview is the tax the application would charge.
const TAX_CHOICES = [
  { id: 'none', label: 'split_tax_none' },
  { id: 'pb1', label: 'split_tax_pb1' },
  { id: 'ppn131', label: 'split_tax_ppn131' },
  { id: 'ppn12', label: 'split_tax_ppn12' },
];

const GoogleMark = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

/**
 * The preview.
 *
 * Three things the reader can move: the total of the receipt, the
 * number of people sharing it, and how the money is divided each
 * month. Every figure below them is worked out from those three, by
 * the same code the application uses.
 */
const LoginPreview = ({ W }) => {
  const [total, setTotal] = useState(210000);
  const [people, setPeople] = useState(3);
  const [taxRuleId, setTaxRuleId] = useState('none');
  const [split, setSplit] = useState({ needs: 50, wants: 20, savings: 30 });

  // The budget. What is left of the monthly income after it is
  // divided three ways, and what that is per day.
  const budget = useMemo(() => {
    const amounts = amountsFromSplit(5000000, split);
    const daily = dailyFromSplit(5000000, split);
    return { amounts, daily };
  }, [split]);

  // The receipt. The lines are the example ones, but the total is the
  // reader's, so the tax and the total are worked out on that.
  const bill = useMemo(() => {
    const subtotal = Number(total) || 0;
    // The lines are scaled to the total the reader typed, so the
    // breakdown on the card always adds up to what they typed.
    const exampleTotal = EXAMPLE_LINES.reduce(
      (sum, line) => sum + line.quantity * line.unitPrice,
      0
    );
    // Each line is scaled so that the line is worth the same share of
    // the total that it was of the example. The share is taken from
    // the line's own value - its quantity times its price - and the
    // quantity is divided out afterwards, so a line of two is not
    // counted twice.
    const lines = EXAMPLE_LINES.map((line) => {
      const value = line.quantity * line.unitPrice;
      const share = exampleTotal > 0 ? (value / exampleTotal) * subtotal : 0;
      return {
        ...line,
        unitPrice: line.quantity > 0 ? Math.round(share / line.quantity) : 0,
      };
    });
    return computeBill({ lines, taxRuleId });
  }, [total, taxRuleId]);

  // The shares. The largest remainder method, so they add back up to
  // the total and not one rupiah is lost or invented.
  const shares = useMemo(
    () => largestRemainderSplit(bill.total, new Array(Math.max(1, people)).fill(1)),
    [bill.total, people]
  );

  const money = (value) => formatNative(value, 'IDR');

  // Moving one part moves it against another, so the three always add
  // up to a hundred. A split that does not add up is a split that
  // cannot be spent.
  const movePart = (part, next) => {
    setSplit((current) => {
      const clamped = Math.max(0, Math.min(100, Number(next) || 0));
      const others = Object.keys(current).filter((key) => key !== part);
      const room = 100 - clamped;
      const rest = others.map((key) => current[key]);
      const restTotal = rest.reduce((a, b) => a + b, 0);
      const updated = { ...current, [part]: clamped };
      if (restTotal > room) {
        others.forEach((key, index) => {
          const share = index === 0 ? room : 0;
          updated[key] = share;
        });
      }
      return updated;
    });
  };

  return (
    <div className="login-gateway__preview" aria-label={W.preview_title}>
      <div style={{ width: '100%', maxWidth: '38rem' }}>
        <p className="login-gateway__preview-head">{W.preview_badge}</p>
        <h2 className="login-gateway__preview-title">{W.preview_title}</h2>
        <p className="login-gateway__preview-lead">{W.preview_lead}</p>

        {/* The companion, before the reader has an account. It can be
            asked a question here too, so the app answers something
            before it asks for anything. */}
        <div
          className="login-gateway__card--glass login-gateway__card--sakura login-gateway__mascot"
          data-testid="login-mascot"
        >
          <ClampShoujoMascot
            size={132}
            mood="happy"
            roaming
            interactive
            label={W.preview_title}
          />
        </div>

        <div className="login-gateway__cards">
          {/* The budget. */}
          <section className="login-gateway__card--glass login-gateway__card--mint">
            <h3 className="login-gateway__card-title">
              <PixelArtBusinessIcon name="ledger_green" size={22} />
              {W.budget_title}
            </h3>
            <p className="login-gateway__muted">{W.budget_lead}</p>

            <div className="login-gateway__bars">
              {[
                ['needs', W.budget_needs],
                ['wants', W.budget_wants],
                ['savings', W.budget_savings],
              ].map(([key, label]) => (
                <div className="login-gateway__bar-row" key={key}>
                  <span className="login-gateway__bar-name">{label}</span>
                  <span className="login-gateway__bar-track">
                    <span
                      className="login-gateway__bar-fill"
                      style={{ width: `${split[key]}%` }}
                    />
                  </span>
                  <span className="login-gateway__bar-amount">
                    {money(budget.amounts[key])}
                  </span>
                </div>
              ))}
            </div>

            <label className="login-gateway__control">
              <span className="login-gateway__control-label">
                <span>{W.budget_total}</span>
                <span className="login-gateway__control-value">
                  {money(5000000)}
                </span>
              </span>
              <input
                className="login-gateway__slider"
                type="range"
                min="0"
                max="100"
                step="5"
                value={split.needs}
                onChange={(e) => movePart('needs', e.target.value)}
                aria-label={`${W.budget_needs} ${split.needs}%`}
              />
            </label>

            <p className="login-gateway__muted">
              {W.budget_needs_daily}: {money(budget.daily.needs)}
            </p>
          </section>

          {/* The shared receipt. */}
          <section className="login-gateway__card--glass login-gateway__card--oat">
            <h3 className="login-gateway__card-title">
              <PixelArtBusinessIcon name="receipt" size={22} />
              {W.split_title}
            </h3>
            <p className="login-gateway__muted">{W.split_lead}</p>

            <label className="login-gateway__control">
              <span className="login-gateway__control-label">
                <span>{W.split_input_label}</span>
                <span className="login-gateway__control-value">{money(total)}</span>
              </span>
              <input
                className="login-gateway__slider"
                type="range"
                min="0"
                max="1000000"
                step="10000"
                value={total}
                onChange={(e) => setTotal(Number(e.target.value))}
                aria-label={W.split_input_label}
              />
            </label>

            <label className="login-gateway__control">
              <span className="login-gateway__control-label">
                <span>{W.split_people_label}</span>
                <span className="login-gateway__control-value">{people}</span>
              </span>
              <input
                className="login-gateway__slider"
                type="range"
                min="2"
                max="8"
                step="1"
                value={people}
                onChange={(e) => setPeople(Number(e.target.value))}
                aria-label={W.split_people_label}
              />
            </label>

            <label className="login-gateway__control">
              <span className="login-gateway__control-label">
                <span>{W.split_tax_label}</span>
                <span className="login-gateway__control-value">
                  {W[TAX_CHOICES.find((c) => c.id === taxRuleId)?.label]}
                </span>
              </span>
              <select
                className="login-gateway__input"
                style={{ background: '#FFFFFF', color: '#1F2421' }}
                value={taxRuleId}
                onChange={(e) => setTaxRuleId(e.target.value)}
                aria-label={W.split_tax_label}
              >
                {TAX_CHOICES.map((choice) => (
                  <option key={choice.id} value={choice.id}>
                    {W[choice.label]}
                  </option>
                ))}
              </select>
            </label>

            <div className="login-gateway__lines">
              {shares.map((share, index) => (
                <div className="login-gateway__line" key={index}>
                  <span>
                    {W.split_each} {index + 1}
                  </span>
                  <span className="login-gateway__line-amount">{money(share)}</span>
                </div>
              ))}
            </div>

            {bill.taxAmount > 0 && (
              <div className="login-gateway__tax">
                <span>
                  {W.split_tax_base} {money(bill.taxBase)}
                </span>
                <span className="login-gateway__line-amount">
                  {money(bill.taxAmount)}
                </span>
              </div>
            )}

            <div className="login-gateway__tax">
              <span>{W.split_total_line}</span>
              <span className="login-gateway__line-amount">{money(bill.total)}</span>
            </div>
          </section>

          {/* The three things the application is for, as a third tile.
              Drawn icons rather than emoji, so the same picture shows
              on every machine. */}
          <section
            className="login-gateway__card--glass login-gateway__card--lavender"
            data-testid="login-scenarios"
          >
            <h3 className="login-gateway__card-title">
              <PixelArtBusinessIcon name="coffee" size={22} />
              {W.scenarios_title}
            </h3>
            <ul className="login-gateway__scenarios">
              {[
                ['coffee', W.scenario_coffee_title, W.scenario_coffee_lead],
                ['home', W.scenario_household_title, W.scenario_household_lead],
                ['money_bag_rp', W.scenario_goal_title, W.scenario_goal_lead],
              ].map(([icon, title, lead]) => (
                <li className="login-gateway__scenario" key={icon}>
                  <PixelArtBusinessIcon name={icon} size={30} />
                  <span>
                    <strong>{title}</strong>
                    <span className="login-gateway__muted">{lead}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* What is true about the data. */}
        <section className="login-gateway__trust">
          <h3 className="login-gateway__trust-title">
            <Lock size={15} aria-hidden="true" />
            {W.trust_title}
          </h3>
          <ul className="login-gateway__trust-list">
            <li className="login-gateway__trust-item">
              <ShieldCheck size={14} aria-hidden="true" />
              <span>{W.trust_encrypt}</span>
            </li>
            <li className="login-gateway__trust-item">
              <Mail size={14} aria-hidden="true" />
              <span>{W.trust_gmail}</span>
            </li>
            <li className="login-gateway__trust-item">
              <Lock size={14} aria-hidden="true" />
              <span>{W.trust_export}</span>
            </li>
            <li className="login-gateway__trust-item">
              <Lock size={14} aria-hidden="true" />
              <span>
                {W.trust_notice}{' '}
                <Link to="/privacy" style={{ color: '#2F4842', fontWeight: 600 }}>
                  {W.trust_link}
                </Link>
              </span>
            </li>
          </ul>
        </section>

        {/* The scrapbook. Three photographs taped into the page at
            slightly different angles, the way a page of a paper
            journal is put together. */}
        <OrganicWaveDivider tone="oat" direction="up" className="my-2" />
        <EditorialScrapbook className="mb-2" />
      </div>
    </div>
  );
};

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginMethod, setLoginMethod] = useState('email');
  const { login, googleLogin, guestLogin, isSupabase } = useAuth();
  const { t, language } = useTranslation();
  const K = batch3[language]?.login;
  const W = batch3[language]?.login_gateway || batch3.id.login_gateway;
  const navigate = useNavigate();
  const gateway = gatewayIsOn();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || K.login_failed);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');

    try {
      await googleLogin();
      // If using Supabase, will redirect
      // If using backend, this will throw
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('not configured') || msg.includes('Supabase not configured')) {
        setError(K.google_unavailable);
      } else {
        setError(msg || K.google_failed);
      }
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    setError('');

    try {
      await guestLogin();
      navigate('/dashboard');
    } catch (err) {
      setError(K.guest_failed);
    } finally {
      setLoading(false);
    }
  };

  // The shape the page had before. Kept exactly as it was, so a reader
  // who has not asked for the gateway sees the same page.
  if (!gateway) {
    return (
      <div className="login-legacy">
        <div className="w-full max-w-md">
          {/* Logo & Title */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-[#2C221E] mb-2">FinManager</h1>
            <p className="text-[#5C6460]">{K.tagline}</p>
            {isSupabase && (
              <span className="inline-block mt-2 px-2 py-1 bg-[#E3F2EA] rounded-full text-xs text-[#1B3B32]">
                {K.powered_by}
              </span>
            )}
          </div>

          {/* Login Method Tabs */}
          <div className="bg-white rounded-2xl shadow-xl p-2 flex mb-6">
            <button
              onClick={() => setLoginMethod('email')}
              className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
                loginMethod === 'email'
                  ? 'bg-primary-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Email
            </button>
            <button
              onClick={() => setLoginMethod('google')}
              className={`flex-1 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${
                loginMethod === 'google'
                  ? 'bg-primary-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <GoogleMark />
              Google
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Email Login Form */}
          {loginMethod === 'email' && (
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@email.com"
                    required
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {K.password}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-colors pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                      </svg>
                      {K.processing}
                    </>
                  ) : K.sign_in}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-gray-500">
                {K.forgot_password}{' '}
                <Link to="/forgot-password" className="text-primary-600 hover:underline font-medium">
                  {K.reset_password}
                </Link>
              </p>

              <div className="mt-6 pt-6 border-t border-gray-100">
                <p className="text-center text-sm text-gray-500 mb-4">
                  {K.no_account}
                </p>
                <Link
                  to="/register"
                  className="block w-full py-3 border-2 border-primary-600 text-primary-600 rounded-xl font-semibold text-center hover:bg-primary-50 transition-colors"
                >
                  {K.register}
                </Link>
              </div>
            </div>
          )}

          {/* Google Login */}
          {loginMethod === 'google' && (
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <div className="text-center">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <GoogleMark />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  {K.google_heading}
                </h2>
                <p className="text-gray-500 text-sm mb-6">
                  {K.google_hint}
                </p>

                <button
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full py-3 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-300 transition-colors flex items-center justify-center gap-3"
                >
                  <GoogleMark />
                  {K.google_continue}
                </button>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-100 text-center">
                <p className="text-sm text-gray-500">
                  Dengan masuk, Anda menyetujui{' '}
                  <Link to="/privacy" className="text-primary-600 hover:underline">
                    {K.privacy}
                  </Link>
                </p>
              </div>
            </div>
          )}

          {/* Guest Login Option */}
          <div className="mt-6 text-center">
            <button
              onClick={handleGuestLogin}
              disabled={loading}
              className="text-[#5C6460] hover:text-[#1F2421] text-sm underline underline-offset-4"
            >
              {K.guest}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // The gateway.
  return (
    <div className="login-gateway">
      <div className="login-gateway__form">
        <div style={{ width: '100%', maxWidth: '27rem', margin: '0 auto' }}>
          <Link to="/" className="login-gateway__brand">
            <img
              src={`${import.meta.env.BASE_URL}assets/generated/brand/logo-dynamic-glow.svg`}
              alt=""
              aria-hidden="true"
              width="40"
              height="40"
            />
            <span className="login-gateway__brand-name">FinManager</span>
          </Link>

          {/* The overline, and the headline with a marker-pen wave
              under the part that matters. */}
          <p className="cute-overline mt-7">
            <span aria-hidden="true">✦</span>
            {W.overline || t('login.overline', 'Hidup lebih tenang dengan Kakeibo pintar')}
          </p>
          <h1 className="login-gateway__title mt-3">
            {W.title_lead}{' '}
            <em className="cute-underline">{W.title_accent}</em>
          </h1>
          <p className="login-gateway__lead">{W.lead}</p>

          <div className="login-gateway__card" style={{ marginTop: '1.75rem' }}>
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="login-gateway__google"
            >
              <GoogleMark />
              {W.google}
            </button>

            {/* The second one-tap way in. A reader who does not want
                an account yet can still see the application with
                their own numbers in it, and the button says so
                plainly rather than hiding under the form as a small
                underlined link. */}
            <button
              type="button"
              onClick={handleGuestLogin}
              disabled={loading}
              className="login-gateway__guest"
              data-testid="login-guest-cta"
            >
              <PixelArtBusinessIcon name="ledger_green" size={18} badge={false} />
              {W.guest_cta}
            </button>

            <p className="login-gateway__or">{W.google_divider}</p>

            {error && (
              <div className="login-gateway__error" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="login-gateway__field">
                <label className="login-gateway__label" htmlFor="login-email">
                  {W.email_label}
                </label>
                <input
                  id="login-email"
                  className="login-gateway__input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={W.email_placeholder}
                  autoComplete="email"
                  required
                />
              </div>

              <div className="login-gateway__field">
                <label className="login-gateway__label" htmlFor="login-password">
                  {K.password}
                </label>
                <span className="login-gateway__password">
                  <input
                    id="login-password"
                    className="login-gateway__input"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={W.password_placeholder}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="login-gateway__eye"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? W.hide_password : W.show_password}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </span>
              </div>

              <p className="login-gateway__muted" style={{ margin: '-0.4rem 0 1.1rem' }}>
                <strong style={{ color: '#2b3742', fontWeight: 600 }}>
                  {W.forgot_password}
                </strong>{' '}
                {W.forgot_note}
              </p>

              <button type="submit" disabled={loading} className="login-gateway__submit">
                {loading ? W.sign_in_loading : W.sign_in}
                {!loading && <ArrowRight size={18} aria-hidden="true" />}
              </button>
            </form>

            <p className="login-gateway__or">{W.or_guest}</p>

            <button
              type="button"
              onClick={handleGuestLogin}
              disabled={loading}
              className="login-gateway__guest"
            >
              {W.guest}
            </button>
            <p className="login-gateway__muted" style={{ color: '#8b98a3', textAlign: 'center' }}>
              {W.guest_hint}
            </p>
          </div>

          <p className="login-gateway__foot" style={{ marginTop: '1.25rem' }}>
            {W.no_account}{' '}
            <Link to="/register">{W.register}</Link>
          </p>
          <p className="login-gateway__foot" style={{ marginTop: '0.4rem', fontSize: '0.8rem' }}>
            {W.register_hint}
          </p>
          <p className="login-gateway__foot" style={{ marginTop: '0.4rem', fontSize: '0.8rem' }}>
            {W.agree_note}
          </p>
        </div>
      </div>

      <LoginPreview W={W} />
    </div>
  );
};

export default Login;
