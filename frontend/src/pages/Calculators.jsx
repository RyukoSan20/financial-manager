import { useState, useEffect } from 'react';
import { Card, Button, Input, Select, Badge, EmptyState, Spinner } from '../components/ui';
import { 
  Calculator, Percent, DollarSign, TrendingUp, Clock, 
  Target, PiggyBank, CreditCard, ArrowRightLeft, RefreshCw
} from 'lucide-react';
import { formatCurrency } from '../utils/format';
import { useTranslation } from '../i18n';

export const Calculators = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('discount');
  
  const tabs = [
    { id: 'discount', label: t('calculators.tab_discount'), icon: Percent },
    { id: 'tax', label: t('calculators.tab_tax'), icon: DollarSign },
    { id: 'loan', label: t('calculators.tab_loan'), icon: CreditCard },
    { id: 'compound', label: t('calculators.tab_interest'), icon: TrendingUp },
    { id: 'savings', label: t('calculators.tab_savings'), icon: Target },
    { id: 'income', label: t('calculators.tab_income'), icon: ArrowRightLeft },
    { id: 'budget', label: t('calculators.tab_budget'), icon: PiggyBank },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('calculators.title')}</h1>
        <p className="text-gray-500 mt-1">{t('calculators.subtitle')}</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 p-1 bg-gray-100 rounded-xl">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Calculator Content */}
      {activeTab === 'discount' && <DiscountCalculator />}
      {activeTab === 'tax' && <TaxCalculator />}
      {activeTab === 'loan' && <LoanCalculator />}
      {activeTab === 'compound' && <CompoundCalculator />}
      {activeTab === 'savings' && <SavingsGoalCalculator />}
      {activeTab === 'income' && <IncomeConverter />}
      {activeTab === 'budget' && <BudgetCalculator />}
    </div>
  );
};

// Discount Calculator
const DiscountCalculator = () => {
  const { t } = useTranslation();
  const [form, setForm] = useState({ price: '', discount: '' });
  const [result, setResult] = useState(null);

  const calculate = () => {
    const price = parseFloat(form.price) || 0;
    const discount = parseFloat(form.discount) || 0;
    const savings = price * (discount / 100);
    const final = price - savings;
    setResult({ original: price, discount, savings, final });
  };

  useEffect(() => {
    if (form.price && form.discount) calculate();
    else setResult(null);
  }, [form]);

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card>
        <h3 className="font-semibold text-gray-900 mb-4">{t('calculators.discount_title')}</h3>
        <div className="space-y-4">
          <Input
            label={t('calculators.discount_original_price')}
            type="number"
            placeholder="100000"
            value={form.price}
            onChange={(e) => setForm(f => ({ ...f, price: e.target.value }))}
          />
          <Input
            label={t('calculators.discount_percent')}
            type="number"
            placeholder="20"
            value={form.discount}
            onChange={(e) => setForm(f => ({ ...f, discount: e.target.value }))}
          />
        </div>
      </Card>
      
      <Card className="flex flex-col justify-center">
        {result ? (
          <div className="space-y-4">
            <div className="text-center p-6 bg-gray-50 rounded-xl">
              <p className="text-sm text-gray-500">{t('calculators.discount_you_save')}</p>
              <p className="text-3xl font-bold text-success-600">{formatCurrency(result.savings)}</p>
            </div>
            <div className="text-center p-6 bg-primary-50 rounded-xl">
              <p className="text-sm text-gray-500">{t('calculators.discount_final_price')}</p>
              <p className="text-4xl font-bold text-primary-600">{formatCurrency(result.final)}</p>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-12">
            {t('calculators.enter_values')}
          </div>
        )}
      </Card>
    </div>
  );
};

// Tax & Tip Calculator
const TaxCalculator = () => {
  const { t } = useTranslation();
  const [form, setForm] = useState({ subtotal: '', taxRate: '11', tipPercent: '10' });
  const [result, setResult] = useState(null);

  useEffect(() => {
    const subtotal = parseFloat(form.subtotal) || 0;
    const taxRate = parseFloat(form.taxRate) || 0;
    const tipPercent = parseFloat(form.tipPercent) || 0;
    
    if (subtotal > 0) {
      const tax = subtotal * (taxRate / 100);
      const tip = subtotal * (tipPercent / 100);
      const total = subtotal + tax + tip;
      setResult({ subtotal, tax, tip, total });
    } else {
      setResult(null);
    }
  }, [form]);

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card>
        <h3 className="font-semibold text-gray-900 mb-4">{t('calculators.tax_title')}</h3>
        <div className="space-y-4">
          <Input
            label={t('calculators.tax_subtotal')}
            type="number"
            placeholder="100000"
            value={form.subtotal}
            onChange={(e) => setForm(f => ({ ...f, subtotal: e.target.value }))}
          />
          <Input
            label={t('calculators.tax_rate')}
            type="number"
            placeholder="11"
            value={form.taxRate}
            onChange={(e) => setForm(f => ({ ...f, taxRate: e.target.value }))}
          />
          <Input
            label={t('calculators.tax_tip')}
            type="number"
            placeholder="10"
            value={form.tipPercent}
            onChange={(e) => setForm(f => ({ ...f, tipPercent: e.target.value }))}
          />
        </div>
      </Card>
      
      <Card className="flex flex-col justify-center">
        {result ? (
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">{t('calculators.tax_subtotal')}</span>
              <span className="font-medium">{formatCurrency(result.subtotal)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">{t('calculators.tax_line').replace('%s', form.taxRate)}</span>
              <span className="font-medium">{formatCurrency(result.tax)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">{t('calculators.tip_line').replace('%s', form.tipPercent)}</span>
              <span className="font-medium">{formatCurrency(result.tip)}</span>
            </div>
            <div className="flex justify-between py-3 bg-primary-50 -mx-4 px-4 rounded-lg">
              <span className="font-semibold text-primary-700">{t('calculators.total')}</span>
              <span className="font-bold text-xl text-primary-700">{formatCurrency(result.total)}</span>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-12">
            {t('calculators.enter_values')}
          </div>
        )}
      </Card>
    </div>
  );
};

// Loan Calculator
const LoanCalculator = () => {
  const { t } = useTranslation();
  const [form, setForm] = useState({ principal: '10000000', rate: '12', years: '2' });
  const [result, setResult] = useState(null);

  useEffect(() => {
    const P = parseFloat(form.principal) || 0;
    const annualRate = parseFloat(form.rate) || 0;
    const years = parseFloat(form.years) || 0;
    
    if (P > 0 && years > 0) {
      const r = annualRate / 100 / 12;
      const n = years * 12;
      const monthlyPayment = r === 0 ? P / n : (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
      const totalPayment = monthlyPayment * n;
      const totalInterest = totalPayment - P;
      setResult({ monthlyPayment, totalPayment, totalInterest, P, r, n });
    } else {
      setResult(null);
    }
  }, [form]);

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card>
        <h3 className="font-semibold text-gray-900 mb-4">{t('calculators.loan_title')}</h3>
        <div className="space-y-4">
          <Input
            label={t('calculators.loan_amount')}
            type="number"
            placeholder="10000000"
            value={form.principal}
            onChange={(e) => setForm(f => ({ ...f, principal: e.target.value }))}
          />
          <Input
            label={t('calculators.loan_rate')}
            type="number"
            step="0.1"
            placeholder="12"
            value={form.rate}
            onChange={(e) => setForm(f => ({ ...f, rate: e.target.value }))}
          />
          <Input
            label={t('calculators.loan_term')}
            type="number"
            placeholder="2"
            value={form.years}
            onChange={(e) => setForm(f => ({ ...f, years: e.target.value }))}
          />
        </div>
      </Card>
      
      <Card className="flex flex-col justify-center">
        {result ? (
          <div className="space-y-4">
            <div className="text-center p-6 bg-primary-50 rounded-xl">
              <p className="text-sm text-gray-500">{t('calculators.loan_monthly_payment')}</p>
              <p className="text-4xl font-bold text-primary-600">{formatCurrency(result.monthlyPayment)}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg text-center">
                <p className="text-sm text-gray-500">{t('calculators.loan_total_payment')}</p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(result.totalPayment)}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg text-center">
                <p className="text-sm text-gray-500">{t('calculators.loan_total_interest')}</p>
                <p className="text-lg font-bold text-warning-600">{formatCurrency(result.totalInterest)}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-12">
            {t('calculators.enter_values')}
          </div>
        )}
      </Card>
    </div>
  );
};

// Compound Interest Calculator
const CompoundCalculator = () => {
  const { t } = useTranslation();
  const [form, setForm] = useState({ principal: '10000000', rate: '8', years: '5', compounds: '12' });
  const [result, setResult] = useState(null);

  useEffect(() => {
    const P = parseFloat(form.principal) || 0;
    const r = parseFloat(form.rate) || 0;
    const t = parseFloat(form.years) || 0;
    const n = parseFloat(form.compounds) || 12;
    
    if (P > 0 && t > 0) {
      const A = P * Math.pow(1 + (r / 100) / n, n * t);
      const interest = A - P;
      setResult({ P, A, interest });
    } else {
      setResult(null);
    }
  }, [form]);

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card>
        <h3 className="font-semibold text-gray-900 mb-4">{t('calculators.compound_title')}</h3>
        <div className="space-y-4">
          <Input
            label={t('calculators.compound_initial')}
            type="number"
            placeholder="10000000"
            value={form.principal}
            onChange={(e) => setForm(f => ({ ...f, principal: e.target.value }))}
          />
          <Input
            label={t('calculators.compound_rate')}
            type="number"
            step="0.1"
            placeholder="8"
            value={form.rate}
            onChange={(e) => setForm(f => ({ ...f, rate: e.target.value }))}
          />
          <Input
            label={t('calculators.compound_period')}
            type="number"
            placeholder="5"
            value={form.years}
            onChange={(e) => setForm(f => ({ ...f, years: e.target.value }))}
          />
          <Select
            label={t('calculators.compound_frequency')}
            options={[
              { value: '1', label: t('calculators.compound_annually') },
              { value: '4', label: t('calculators.compound_quarterly') },
              { value: '12', label: t('calculators.compound_monthly') },
              { value: '365', label: t('calculators.compound_daily') },
            ]}
            value={form.compounds}
            onChange={(e) => setForm(f => ({ ...f, compounds: e.target.value }))}
          />
        </div>
      </Card>
      
      <Card className="flex flex-col justify-center">
        {result ? (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">{t('calculators.compound_initial')}</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(result.P)}</p>
            </div>
            <div className="text-center p-6 bg-success-50 rounded-xl">
              <p className="text-sm text-gray-500">{t('calculators.compound_future_value')}</p>
              <p className="text-4xl font-bold text-success-600">{formatCurrency(result.A)}</p>
            </div>
            <div className="text-center p-4 bg-primary-50 rounded-lg">
              <p className="text-sm text-gray-500">{t('calculators.compound_interest_earned')}</p>
              <p className="text-xl font-bold text-primary-600">{formatCurrency(result.interest)}</p>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-12">
            {t('calculators.enter_values')}
          </div>
        )}
      </Card>
    </div>
  );
};

// Savings Goal Calculator
const SavingsGoalCalculator = () => {
  const { t } = useTranslation();
  const [form, setForm] = useState({ goal: '15000000', current: '5000000', monthly: '1000000', rate: '6' });
  const [result, setResult] = useState(null);

  useEffect(() => {
    const goal = parseFloat(form.goal) || 0;
    const current = parseFloat(form.current) || 0;
    const monthly = parseFloat(form.monthly) || 0;
    const annualRate = parseFloat(form.rate) || 0;
    
    if (goal > 0 && monthly > 0) {
      const remaining = goal - current;
      const monthlyRate = annualRate / 100 / 12;
      
      let months;
      if (monthlyRate === 0) {
        months = Math.ceil(remaining / monthly);
      } else {
        months = Math.ceil(Math.log((monthly + remaining * monthlyRate) / monthly) / Math.log(1 + monthlyRate));
      }
      
      const years = Math.floor(months / 12);
      const leftoverMonths = months % 12;
      const date = new Date();
      date.setMonth(date.getMonth() + months);
      
      setResult({ remaining, months, years, leftoverMonths, targetDate: date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) });
    } else {
      setResult(null);
    }
  }, [form]);

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card>
        <h3 className="font-semibold text-gray-900 mb-4">{t('calculators.savings_title')}</h3>
        <div className="space-y-4">
          <Input
            label={t('calculators.savings_goal')}
            type="number"
            placeholder="15000000"
            value={form.goal}
            onChange={(e) => setForm(f => ({ ...f, goal: e.target.value }))}
          />
          <Input
            label={t('calculators.savings_current')}
            type="number"
            placeholder="5000000"
            value={form.current}
            onChange={(e) => setForm(f => ({ ...f, current: e.target.value }))}
          />
          <Input
            label={t('calculators.savings_monthly')}
            type="number"
            placeholder="1000000"
            value={form.monthly}
            onChange={(e) => setForm(f => ({ ...f, monthly: e.target.value }))}
          />
          <Input
            label={t('calculators.savings_expected_return')}
            type="number"
            step="0.1"
            placeholder="6"
            value={form.rate}
            onChange={(e) => setForm(f => ({ ...f, rate: e.target.value }))}
          />
        </div>
      </Card>
      
      <Card className="flex flex-col justify-center">
        {result ? (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">{t('calculators.savings_remaining')}</p>
              <p className="text-2xl font-bold text-danger-600">{formatCurrency(result.remaining)}</p>
            </div>
            <div className="text-center p-6 bg-primary-50 rounded-xl">
              <p className="text-sm text-gray-500">{t('calculators.savings_time_to_goal')}</p>
              <p className="text-3xl font-bold text-primary-600">
                {t('calculators.savings_duration')
                  .replace('%s', result.years)
                  .replace('%s', result.leftoverMonths)}
              </p>
            </div>
            <div className="text-center p-4 bg-success-50 rounded-lg">
              <p className="text-sm text-gray-500">{t('calculators.savings_target_date')}</p>
              <p className="text-lg font-bold text-success-600">{result.targetDate}</p>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-12">
            {t('calculators.enter_values')}
          </div>
        )}
      </Card>
    </div>
  );
};

// Income Converter
const IncomeConverter = () => {
  const { t } = useTranslation();
  const [annual, setAnnual] = useState('120000000');
  const [result, setResult] = useState(null);

  useEffect(() => {
    const yearly = parseFloat(annual) || 0;
    if (yearly > 0) {
      setResult({
        yearly,
        monthly: yearly / 12,
        weekly: yearly / 52,
        daily: yearly / 365,
        hourly: yearly / (52 * 40),
      });
    } else {
      setResult(null);
    }
  }, [annual]);

  return (
    <Card>
      <h3 className="font-semibold text-gray-900 mb-4">{t('calculators.income_title')}</h3>
      <div className="space-y-6">
        <Input
          label={t('calculators.income_annual')}
          type="number"
          placeholder="120000000"
          value={annual}
          onChange={(e) => setAnnual(e.target.value)}
        />
        
        {result && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: t('calculators.income_yearly'), value: result.yearly },
              { label: t('calculators.income_monthly'), value: result.monthly },
              { label: t('calculators.income_weekly'), value: result.weekly },
              { label: t('calculators.income_daily'), value: result.daily },
            ].map(item => (
              <div key={item.label} className="p-4 bg-gray-50 rounded-lg text-center">
                <p className="text-sm text-gray-500 mb-1">{item.label}</p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(Math.round(item.value))}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};

// Budget Calculator
const BudgetCalculator = () => {
  const { t } = useTranslation();
  const [form, setForm] = useState({ income: '15000000', savingsRate: '20', bills: '3000000' });
  const [result, setResult] = useState(null);

  useEffect(() => {
    const income = parseFloat(form.income) || 0;
    const savingsRate = parseFloat(form.savingsRate) || 0;
    const bills = parseFloat(form.bills) || 0;
    
    if (income > 0) {
      const savings = income * (savingsRate / 100);
      const discretionary = income - bills - savings;
      setResult({ income, savings, bills, discretionary });
    } else {
      setResult(null);
    }
  }, [form]);

  return (
    <Card>
      <h3 className="font-semibold text-gray-900 mb-4">{t('calculators.budget_title')}</h3>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Input
            label={t('calculators.budget_monthly_income')}
            type="number"
            placeholder="15000000"
            value={form.income}
            onChange={(e) => setForm(f => ({ ...f, income: e.target.value }))}
          />
          <Input
            label={t('calculators.budget_savings_rate')}
            type="number"
            placeholder="20"
            value={form.savingsRate}
            onChange={(e) => setForm(f => ({ ...f, savingsRate: e.target.value }))}
          />
          <Input
            label={t('calculators.budget_bills')}
            type="number"
            placeholder="3000000"
            value={form.bills}
            onChange={(e) => setForm(f => ({ ...f, bills: e.target.value }))}
          />
        </div>
        
        {result && (
          <div className="space-y-3">
            <div className="p-4 bg-success-50 rounded-lg flex justify-between items-center">
              <span className="text-gray-700">{t('calculators.budget_savings_rule')}</span>
              <span className="text-xl font-bold text-success-600">{formatCurrency(result.savings)}</span>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg flex justify-between items-center">
              <span className="text-gray-700">{t('calculators.budget_bills_fixed')}</span>
              <span className="text-xl font-bold text-gray-900">{formatCurrency(result.bills)}</span>
            </div>
            <div className="p-4 bg-primary-50 rounded-lg flex justify-between items-center">
              <span className="text-gray-700">{t('calculators.budget_discretionary')}</span>
              <span className="text-xl font-bold text-primary-600">{formatCurrency(result.discretionary)}</span>
            </div>
            <p className="text-sm text-gray-500 text-center mt-2">
              {t('calculators.budget_rule_note')}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};

export default Calculators;
