import { useState, useEffect } from 'react';
import { Card, Button, Input, Select, Badge, EmptyState, Spinner } from '../components/ui';
import { 
  Calculator, Percent, DollarSign, TrendingUp, Clock, 
  Target, PiggyBank, CreditCard, ArrowRightLeft, RefreshCw
} from 'lucide-react';
import { formatCurrency } from '../utils/format';

export const Calculators = () => {
  const [activeTab, setActiveTab] = useState('discount');
  
  const tabs = [
    { id: 'discount', label: 'Discount', icon: Percent },
    { id: 'tax', label: 'Tax & Tip', icon: DollarSign },
    { id: 'loan', label: 'Loan', icon: CreditCard },
    { id: 'compound', label: 'Interest', icon: TrendingUp },
    { id: 'savings', label: 'Savings Goal', icon: Target },
    { id: 'income', label: 'Income Converter', icon: ArrowRightLeft },
    { id: 'budget', label: 'Budget', icon: PiggyBank },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Financial Calculators</h1>
        <p className="text-gray-500 mt-1">Quick calculations for everyday finances</p>
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
        <h3 className="font-semibold text-gray-900 mb-4">Calculate Discount</h3>
        <div className="space-y-4">
          <Input
            label="Original Price"
            type="number"
            placeholder="100000"
            value={form.price}
            onChange={(e) => setForm(f => ({ ...f, price: e.target.value }))}
          />
          <Input
            label="Discount (%)"
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
              <p className="text-sm text-gray-500">You Save</p>
              <p className="text-3xl font-bold text-success-600">{formatCurrency(result.savings)}</p>
            </div>
            <div className="text-center p-6 bg-primary-50 rounded-xl">
              <p className="text-sm text-gray-500">Final Price</p>
              <p className="text-4xl font-bold text-primary-600">{formatCurrency(result.final)}</p>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-12">
            Enter values to calculate
          </div>
        )}
      </Card>
    </div>
  );
};

// Tax & Tip Calculator
const TaxCalculator = () => {
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
        <h3 className="font-semibold text-gray-900 mb-4">Calculate Tax & Tip</h3>
        <div className="space-y-4">
          <Input
            label="Subtotal"
            type="number"
            placeholder="100000"
            value={form.subtotal}
            onChange={(e) => setForm(f => ({ ...f, subtotal: e.target.value }))}
          />
          <Input
            label={`Tax Rate (%)`}
            type="number"
            placeholder="11"
            value={form.taxRate}
            onChange={(e) => setForm(f => ({ ...f, taxRate: e.target.value }))}
          />
          <Input
            label="Tip (%)"
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
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium">{formatCurrency(result.subtotal)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">Tax ({form.taxRate}%)</span>
              <span className="font-medium">{formatCurrency(result.tax)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">Tip ({form.tipPercent}%)</span>
              <span className="font-medium">{formatCurrency(result.tip)}</span>
            </div>
            <div className="flex justify-between py-3 bg-primary-50 -mx-4 px-4 rounded-lg">
              <span className="font-semibold text-primary-700">Total</span>
              <span className="font-bold text-xl text-primary-700">{formatCurrency(result.total)}</span>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-12">
            Enter values to calculate
          </div>
        )}
      </Card>
    </div>
  );
};

// Loan Calculator
const LoanCalculator = () => {
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
        <h3 className="font-semibold text-gray-900 mb-4">Loan Calculator</h3>
        <div className="space-y-4">
          <Input
            label="Loan Amount"
            type="number"
            placeholder="10000000"
            value={form.principal}
            onChange={(e) => setForm(f => ({ ...f, principal: e.target.value }))}
          />
          <Input
            label="Interest Rate (% per year)"
            type="number"
            step="0.1"
            placeholder="12"
            value={form.rate}
            onChange={(e) => setForm(f => ({ ...f, rate: e.target.value }))}
          />
          <Input
            label="Loan Term (years)"
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
              <p className="text-sm text-gray-500">Monthly Payment</p>
              <p className="text-4xl font-bold text-primary-600">{formatCurrency(result.monthlyPayment)}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg text-center">
                <p className="text-sm text-gray-500">Total Payment</p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(result.totalPayment)}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg text-center">
                <p className="text-sm text-gray-500">Total Interest</p>
                <p className="text-lg font-bold text-warning-600">{formatCurrency(result.totalInterest)}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-12">
            Enter values to calculate
          </div>
        )}
      </Card>
    </div>
  );
};

// Compound Interest Calculator
const CompoundCalculator = () => {
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
        <h3 className="font-semibold text-gray-900 mb-4">Compound Interest</h3>
        <div className="space-y-4">
          <Input
            label="Initial Investment"
            type="number"
            placeholder="10000000"
            value={form.principal}
            onChange={(e) => setForm(f => ({ ...f, principal: e.target.value }))}
          />
          <Input
            label="Annual Interest Rate (%)"
            type="number"
            step="0.1"
            placeholder="8"
            value={form.rate}
            onChange={(e) => setForm(f => ({ ...f, rate: e.target.value }))}
          />
          <Input
            label="Time Period (years)"
            type="number"
            placeholder="5"
            value={form.years}
            onChange={(e) => setForm(f => ({ ...f, years: e.target.value }))}
          />
          <Select
            label="Compounding Frequency"
            options={[
              { value: '1', label: 'Annually' },
              { value: '4', label: 'Quarterly' },
              { value: '12', label: 'Monthly' },
              { value: '365', label: 'Daily' },
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
              <p className="text-sm text-gray-500">Initial Investment</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(result.P)}</p>
            </div>
            <div className="text-center p-6 bg-success-50 rounded-xl">
              <p className="text-sm text-gray-500">Future Value</p>
              <p className="text-4xl font-bold text-success-600">{formatCurrency(result.A)}</p>
            </div>
            <div className="text-center p-4 bg-primary-50 rounded-lg">
              <p className="text-sm text-gray-500">Interest Earned</p>
              <p className="text-xl font-bold text-primary-600">{formatCurrency(result.interest)}</p>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-12">
            Enter values to calculate
          </div>
        )}
      </Card>
    </div>
  );
};

// Savings Goal Calculator
const SavingsGoalCalculator = () => {
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
        <h3 className="font-semibold text-gray-900 mb-4">Savings Goal</h3>
        <div className="space-y-4">
          <Input
            label="Savings Goal"
            type="number"
            placeholder="15000000"
            value={form.goal}
            onChange={(e) => setForm(f => ({ ...f, goal: e.target.value }))}
          />
          <Input
            label="Current Savings"
            type="number"
            placeholder="5000000"
            value={form.current}
            onChange={(e) => setForm(f => ({ ...f, current: e.target.value }))}
          />
          <Input
            label="Monthly Savings"
            type="number"
            placeholder="1000000"
            value={form.monthly}
            onChange={(e) => setForm(f => ({ ...f, monthly: e.target.value }))}
          />
          <Input
            label="Expected Return (% per year)"
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
              <p className="text-sm text-gray-500">Remaining Amount</p>
              <p className="text-2xl font-bold text-danger-600">{formatCurrency(result.remaining)}</p>
            </div>
            <div className="text-center p-6 bg-primary-50 rounded-xl">
              <p className="text-sm text-gray-500">Time to Reach Goal</p>
              <p className="text-3xl font-bold text-primary-600">
                {result.years > 0 && `${result.years} years `}
                {result.leftoverMonths > 0 && `${result.leftoverMonths} months`}
              </p>
            </div>
            <div className="text-center p-4 bg-success-50 rounded-lg">
              <p className="text-sm text-gray-500">Target Date</p>
              <p className="text-lg font-bold text-success-600">{result.targetDate}</p>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-12">
            Enter values to calculate
          </div>
        )}
      </Card>
    </div>
  );
};

// Income Converter
const IncomeConverter = () => {
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
      <h3 className="font-semibold text-gray-900 mb-4">Income Converter</h3>
      <div className="space-y-6">
        <Input
          label="Annual Income"
          type="number"
          placeholder="120000000"
          value={annual}
          onChange={(e) => setAnnual(e.target.value)}
        />
        
        {result && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Yearly', value: result.yearly },
              { label: 'Monthly', value: result.monthly },
              { label: 'Weekly', value: result.weekly },
              { label: 'Daily', value: result.daily },
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
      <h3 className="font-semibold text-gray-900 mb-4">Budget Calculator</h3>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Input
            label="Monthly Income"
            type="number"
            placeholder="15000000"
            value={form.income}
            onChange={(e) => setForm(f => ({ ...f, income: e.target.value }))}
          />
          <Input
            label="Savings Rate (%)"
            type="number"
            placeholder="20"
            value={form.savingsRate}
            onChange={(e) => setForm(f => ({ ...f, savingsRate: e.target.value }))}
          />
          <Input
            label="Bills & Fixed Expenses"
            type="number"
            placeholder="3000000"
            value={form.bills}
            onChange={(e) => setForm(f => ({ ...f, bills: e.target.value }))}
          />
        </div>
        
        {result && (
          <div className="space-y-3">
            <div className="p-4 bg-success-50 rounded-lg flex justify-between items-center">
              <span className="text-gray-700">Savings (50-60 rule)</span>
              <span className="text-xl font-bold text-success-600">{formatCurrency(result.savings)}</span>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg flex justify-between items-center">
              <span className="text-gray-700">Bills & Fixed</span>
              <span className="text-xl font-bold text-gray-900">{formatCurrency(result.bills)}</span>
            </div>
            <div className="p-4 bg-primary-50 rounded-lg flex justify-between items-center">
              <span className="text-gray-700">Discretionary Spending</span>
              <span className="text-xl font-bold text-primary-600">{formatCurrency(result.discretionary)}</span>
            </div>
            <p className="text-sm text-gray-500 text-center mt-2">
              Based on 50/30/20 budget rule: 50% needs, 30% wants, 20% savings
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};

export default Calculators;
