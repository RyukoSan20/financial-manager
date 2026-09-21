// Centralized API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const endpoints = {
  // Health
  health: () => `${API_BASE_URL}/health`,
  info: () => `${API_BASE_URL}/info`,

  // Accounts
  accounts: () => `${API_BASE_URL}/accounts/`,
  account: (id) => `${API_BASE_URL}/accounts/${id}`,
  accountBalance: () => `${API_BASE_URL}/accounts/summary/total-balance`,

  // Categories
  categories: (type) => type ? `${API_BASE_URL}/categories/${type}` : `${API_BASE_URL}/categories/`,
  category: (id) => `${API_BASE_URL}/categories/${id}`,
  categorySeed: () => `${API_BASE_URL}/categories/seed-defaults`,

  // Transactions
  transactions: (params = '') => `${API_BASE_URL}/transactions/${params}`,
  transaction: (id) => `${API_BASE_URL}/transactions/${id}`,
  transactionSummary: (startDate, endDate) => 
    `${API_BASE_URL}/transactions/summary/by-period?start_date=${startDate}&end_date=${endDate}`,

  // Transfers
  transfers: (params = '') => `${API_BASE_URL}/transfers/${params}`,
  transfer: (id) => `${API_BASE_URL}/transfers/${id}`,

  // Budgets
  budgets: () => `${API_BASE_URL}/budgets/`,
  budget: (id) => `${API_BASE_URL}/budgets/${id}`,
  budgetProgress: (id) => `${API_BASE_URL}/budgets/${id}/progress`,

  // Recurring
  recurring: () => `${API_BASE_URL}/recurring/`,
  recurringItem: (id) => `${API_BASE_URL}/recurring/${id}`,
  recurringGenerate: (id) => `${API_BASE_URL}/recurring/${id}/generate`,
  recurringUpcoming: (days) => `${API_BASE_URL}/recurring/upcoming?days=${days}`,

  // Goals
  goals: () => `${API_BASE_URL}/goals/`,
  goal: (id) => `${API_BASE_URL}/goals/${id}`,
  goalContribute: (id) => `${API_BASE_URL}/goals/${id}/contribute`,
  goalsSummary: () => `${API_BASE_URL}/goals/summary`,

  // Debts
  debts: () => `${API_BASE_URL}/debts/`,
  debt: (id) => `${API_BASE_URL}/debts/${id}`,
  debtPayment: (id) => `${API_BASE_URL}/debts/${id}/payment`,
  debtSchedule: (id) => `${API_BASE_URL}/debts/${id}/schedule`,
  debtsSummary: () => `${API_BASE_URL}/debts/summary/all`,

  // Dashboard
  dashboardSummary: (startDate, endDate) => {
    let url = `${API_BASE_URL}/dashboard/summary`;
    const params = [];
    if (startDate) params.push(`start_date=${startDate}`);
    if (endDate) params.push(`end_date=${endDate}`);
    if (params.length) url += `?${params.join('&')}`;
    return url;
  },
  dashboardCashFlow: (months) => `${API_BASE_URL}/dashboard/cash-flow?months=${months}`,
  dashboardCategoryBreakdown: (type) => `${API_BASE_URL}/dashboard/category-breakdown?type=${type}`,

  // Analytics
  analyticsCashFlowTrend: (months) => `${API_BASE_URL}/analytics/cash-flow-trend?months=${months}`,
  analyticsExpenseBreakdown: (params) => `${API_BASE_URL}/analytics/expense-breakdown${params}`,
  analyticsTopExpenses: (limit) => `${API_BASE_URL}/analytics/top-expenses?limit=${limit}`,
  analyticsRecurringExpenses: () => `${API_BASE_URL}/analytics/recurring-expenses`,
  analyticsIncomeBreakdown: (params) => `${API_BASE_URL}/analytics/income-breakdown${params}`,
  analyticsBudgetVsActual: () => `${API_BASE_URL}/analytics/budget-vs-actual`,
  analyticsSpendingPatterns: () => `${API_BASE_URL}/analytics/spending-patterns`,
  analyticsNetWorthHistory: (months) => `${API_BASE_URL}/analytics/net-worth-history?months=${months}`,
  analyticsNetWorthSnapshot: () => `${API_BASE_URL}/analytics/net-worth-snapshot`,
  analyticsMonthlyComparison: (months) => `${API_BASE_URL}/analytics/monthly-comparison?months=${months}`,
  analyticsFinancialHealth: () => `${API_BASE_URL}/analytics/financial-health`,

  // Calculators
  calculatorDiscount: () => `${API_BASE_URL}/calculators/discount`,
  calculatorTax: () => `${API_BASE_URL}/calculators/tax`,
  calculatorTip: () => `${API_BASE_URL}/calculators/tip`,
  calculatorSplitBill: () => `${API_BASE_URL}/calculators/split-bill`,
  calculatorLoanPayment: () => `${API_BASE_URL}/calculators/loan-payment`,
  calculatorCompoundInterest: () => `${API_BASE_URL}/calculators/compound-interest`,
  calculatorBudgetAllocation: () => `${API_BASE_URL}/calculators/budget-allocation`,
  calculatorAffordability: () => `${API_BASE_URL}/calculators/affordability`,
};

export { API_BASE_URL };
export default API_BASE_URL;
