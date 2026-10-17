// Calculators API - Financial calculators
import { corsHeaders, jsonResponse, errorResponse, verifySimpleToken } from '../_shared/database.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.pathname.split('/').pop();

    switch (action) {
      case 'compound-interest':
        return await compoundInterest(url);
      case 'loan-calculator':
        return await loanCalculator(url);
      case 'savings-goal':
        return await savingsGoal(url);
      case 'currency-convert':
        return await currencyConvert(url);
      default:
        return errorResponse('Not found', 404);
    }
  } catch (err) {
    console.error('Calculators error:', err);
    return errorResponse(err.message || 'Internal error', 500);
  }
});

async function compoundInterest(url: URL) {
  const principal = parseFloat(url.searchParams.get('principal') || '0');
  const rate = parseFloat(url.searchParams.get('rate') || '0') / 100;
  const time = parseFloat(url.searchParams.get('time') || '0');
  const frequency = url.searchParams.get('frequency') || 'monthly';

  let n = 12; // monthly by default
  if (frequency === 'daily') n = 365;
  if (frequency === 'yearly') n = 1;

  const futureValue = principal * Math.pow(1 + rate / n, n * time);
  const totalInterest = futureValue - principal;

  // Generate amortization schedule
  const schedule = [];
  let balance = principal;

  for (let year = 1; year <= time; year++) {
    const yearEnd = principal * Math.pow(1 + rate / n, n * year);
    schedule.push({
      year,
      balance: Math.round(yearEnd * 100) / 100,
      interest: Math.round((yearEnd - balance) * 100) / 100,
    });
    balance = yearEnd;
  }

  return jsonResponse({
    principal,
    rate: rate * 100,
    time,
    frequency,
    future_value: Math.round(futureValue * 100) / 100,
    total_interest: Math.round(totalInterest * 100) / 100,
    schedule: time <= 10 ? schedule : undefined, // Limit schedule for long periods
  });
}

async function loanCalculator(url: URL) {
  const principal = parseFloat(url.searchParams.get('principal') || '0');
  const rate = parseFloat(url.searchParams.get('rate') || '0') / 100 / 12; // monthly
  const months = parseInt(url.searchParams.get('months') || '0');

  if (principal <= 0 || rate <= 0 || months <= 0) {
    return errorResponse('Invalid loan parameters');
  }

  // Monthly payment formula: M = P * [r(1+r)^n] / [(1+r)^n - 1]
  const monthlyPayment = principal * (rate * Math.pow(1 + rate, months)) / (Math.pow(1 + rate, months) - 1);
  const totalPayment = monthlyPayment * months;
  const totalInterest = totalPayment - principal;

  // Generate amortization schedule
  const schedule = [];
  let balance = principal;

  for (let month = 1; month <= months; month++) {
    const interest = balance * rate;
    const principalPayment = monthlyPayment - interest;
    balance = Math.max(0, balance - principalPayment);

    schedule.push({
      month,
      payment: Math.round(monthlyPayment * 100) / 100,
      principal: Math.round(principalPayment * 100) / 100,
      interest: Math.round(interest * 100) / 100,
      balance: Math.round(balance * 100) / 100,
    });
  }

  return jsonResponse({
    principal,
    annual_rate: rate * 12 * 100,
    months,
    monthly_payment: Math.round(monthlyPayment * 100) / 100,
    total_payment: Math.round(totalPayment * 100) / 100,
    total_interest: Math.round(totalInterest * 100) / 100,
    schedule: months <= 60 ? schedule : undefined,
  });
}

async function savingsGoal(url: URL) {
  const target = parseFloat(url.searchParams.get('target') || '0');
  const current = parseFloat(url.searchParams.get('current') || '0');
  const monthly = parseFloat(url.searchParams.get('monthly') || '0');
  const rate = parseFloat(url.searchParams.get('rate') || '0') / 100 / 12;

  if (target <= 0 || monthly <= 0) {
    return errorResponse('Invalid savings parameters');
  }

  const remaining = Math.max(0, target - current);
  
  // Calculate months needed with compound interest
  let months = 0;
  let balance = current;
  
  if (rate > 0) {
    while (balance < target && months < 600) {
      balance = balance * (1 + rate) + monthly;
      months++;
    }
  } else {
    months = Math.ceil(remaining / monthly);
    balance = current + monthly * months;
  }

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;

  return jsonResponse({
    target,
    current,
    monthly,
    rate: rate * 12 * 100,
    months_needed: months,
    time_estimate: `${years > 0 ? years + ' tahun ' : ''}${remainingMonths} bulan`.trim(),
    final_balance: Math.round(balance * 100) / 100,
    total_contributions: current + (monthly * months),
  });
}

async function currencyConvert(url: URL) {
  const amount = parseFloat(url.searchParams.get('amount') || '0');
  const from = url.searchParams.get('from') || 'IDR';
  const to = url.searchParams.get('to') || 'USD';

  // Static exchange rates (for demo - in production use real API)
  const rates: Record<string, number> = {
    'IDR': 1,
    'USD': 0.000063,
    'EUR': 0.000058,
    'GBP': 0.000050,
    'JPY': 0.0092,
    'SGD': 0.000085,
    'MYR': 0.00028,
    'THB': 0.0022,
  };

  const fromRate = rates[from.toUpperCase()] || 1;
  const toRate = rates[to.toUpperCase()] || 1;
  
  const result = (amount * fromRate) / toRate;

  return jsonResponse({
    amount,
    from,
    to,
    result: Math.round(result * 100) / 100,
    rate: toRate / fromRate,
    timestamp: new Date().toISOString(),
  });
}
