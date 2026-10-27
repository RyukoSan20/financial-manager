// The first-time setup.
//
// A new account has nothing in it, so the first screen a reader sees
// is empty charts. The setup walks them through the four things that
// make the app useful: an account to hold the money, a budget to
// spend inside, the recurring bills, and the first transaction.
//
// It reads the readiness report from the server, so it cannot say a
// step is unfinished when the checklist says it is done, or the other
// way round. The steps that are already done are skipped.
//
// It is a guide, not a gate: it can be closed at any point and the
// reader can come back to it.

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import { batch6 } from '../../i18n/keys_batch6';
import { api } from '../../services/api';
import {
  Wallet, Target, Repeat, Receipt, Check, X, ChevronRight,
} from 'lucide-react';

const STORAGE_KEY = 'onboardingSeen';

/**
 * The steps, in order.
 *
 * Each one names the readiness item that completes it, so the step is
 * finished when the server says the thing is done.
 */
const STEPS = [
  {
    key: 'accounts',
    readyWhen: 'account',
    icon: Wallet,
    title: 'onboarding_step_accounts',
    body: 'onboarding_step_accounts_body',
    href: '/accounts',
  },
  {
    key: 'budget',
    readyWhen: 'budget',
    icon: Target,
    title: 'onboarding_step_budget',
    body: 'onboarding_step_budget_body',
    href: '/budgets',
  },
  {
    key: 'recurring',
    readyWhen: 'recurring',
    icon: Repeat,
    title: 'onboarding_step_recurring',
    body: 'onboarding_step_recurring_body',
    href: '/recurring',
  },
  {
    key: 'first',
    readyWhen: 'transactions',
    icon: Receipt,
    title: 'onboarding_step_first',
    body: 'onboarding_step_first_body',
    href: '/transactions',
  },
];

/**
 * Has the reader been through this before?
 *
 * Kept in the browser, because it is about this device. It is only a
 * reason to offer the setup, never a reason to hide anything.
 */
export function hasSeenOnboarding() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'done';
  } catch {
    return false;
  }
}

export function markOnboardingSeen() {
  try {
    window.localStorage.setItem(STORAGE_KEY, 'done');
  } catch {
    /* storage unavailable */
  }
}

export default function Onboarding() {
  const { language } = useTranslation();
  const K = batch6[language]?.a5 || batch6.id.a5;
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [open, setOpen] = useState(() => !hasSeenOnboarding());
  const [stepIndex, setStepIndex] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await api.request('/settings/readiness');
      setReport(res);
    } catch {
      /* the guide is an offer, not a requirement */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // The first step that is not done yet. A step that is already done
  // is not shown, because there is nothing for the reader to do.
  const steps = STEPS.map((step) => {
    const item = (report?.items || []).find((i) => i.key === step.readyWhen);
    return { ...step, done: Boolean(item?.done) };
  });
  const pending = steps.filter((s) => !s.done);
  const total = pending.length || 1;
  const current = Math.min(stepIndex, pending.length - 1);
  const step = pending[current];

  const close = () => {
    markOnboardingSeen();
    setOpen(false);
  };

  if (!open) return null;
  if (!report) return null;
  // Nothing left to do: the setup is finished.
  if (pending.length === 0) {
    return (
      <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center">
            <Check className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-emerald-900 dark:text-emerald-100">
              {K.onboarding_done_title}
            </h3>
            <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
              {K.onboarding_done_body}
            </p>
            <button
              type="button"
              onClick={close}
              className="mt-3 px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700"
            >
              {K.onboarding_go_dashboard}
            </button>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label={K.onboarding_dismiss}
            className="flex-shrink-0 text-emerald-400 hover:text-emerald-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  const Icon = step.icon;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm relative">
      <button
        type="button"
        onClick={close}
        aria-label={K.onboarding_dismiss}
        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
      >
        <X className="w-4 h-4" />
      </button>

      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
        {K.onboarding_step_of
          .replace('{current}', String(current + 1))
          .replace('{total}', String(total))}
      </p>

      <div className="flex items-start gap-3 mt-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center">
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0 pr-6">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {K[step.title]}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {K[step.body]}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4">
        <button
          type="button"
          onClick={() => navigate(step.href)}
          className="px-3 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 flex items-center gap-1"
        >
          {K.onboarding_next}
          <ChevronRight className="w-4 h-4" />
        </button>
        {current > 0 && (
          <button
            type="button"
            onClick={() => setStepIndex(current - 1)}
            className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800"
          >
            {K.onboarding_back}
          </button>
        )}
        <button
          type="button"
          onClick={close}
          className="ml-auto text-sm text-gray-500 hover:text-gray-700 underline"
        >
          {K.onboarding_skip}
        </button>
      </div>
    </div>
  );
}
