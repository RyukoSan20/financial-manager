/**
 * Quick Entry Parser - Orchestrates NLP parsing for transaction input
 * 
 * Takes raw text like "makan siang 45rb gopay" and returns structured data
 */

import { normalize, tokenize } from './normalize.js';
import { parseAmount, evalMath } from './parseAmount.js';
import { suggestCategory } from './suggestCategory.js';

/**
 * Parse quick entry text
 * @param {string} text - Raw input text
 * @param {Object} options
 * @param {Array} options.categories - User's categories
 * @param {Object} options.userHints - User's category hints
 * @param {Object} options.accounts - User's accounts
 * @param {Date} options.now - Current date (for WIB)
 * @returns {Object} Parsed transaction data
 */
export function parseQuickEntry(text, options = {}) {
  const {
    categories = [],
    userHints = {},
    accounts = [],
    now = new Date()
  } = options;
  
  // Normalize input
  const normalized = normalize(text);
  
  // Build category map (system_key -> category_id)
  const categoryMap = {};
  for (const cat of categories) {
    if (cat.system_key) {
      categoryMap[cat.system_key] = cat.id;
    }
  }
  
  // Extract amount (before removing from text)
  let amountResult = parseAmount(normalized);
  
  // Try math expression
  const mathResult = evalMath(normalized);
  if (mathResult && (!amountResult || mathResult > amountResult.value)) {
    amountResult = { value: Math.round(mathResult), raw: 'math expression' };
  }
  
  // Tokenize remaining text
  let textForTokens = normalized;
  if (amountResult) {
    textForTokens = normalized.slice(0, amountResult.span[0]) + normalized.slice(amountResult.span[1]);
  }
  
  const tokens = tokenize(textForTokens);
  
  // Detect type from keywords
  let type = 'expense';
  const typeKeywords = {
    income: ['gaji', 'terima', 'masuk', 'dapat', 'bonus', 'komisi', 'fee', 'pendapatan'],
    transfer: ['transfer', 'tf', 'mutasi', 'pindah', 'topup', 'top up', 'kirim']
  };
  
  const lowerText = normalized.toLowerCase();
  for (const kw of typeKeywords.transfer) {
    if (lowerText.includes(kw)) {
      type = 'transfer';
      break;
    }
  }
  for (const kw of typeKeywords.income) {
    if (lowerText.includes(kw) && type !== 'transfer') {
      type = 'income';
      break;
    }
  }
  
  // Suggest category
  const categorySuggestion = suggestCategory(tokens, userHints, categoryMap);
  
  // Extract date (simple: just use today for now)
  // TODO: Add date parsing from text
  const wibDate = getWIBDate(now);
  
  // Build result
  const result = {
    type,
    amount: amountResult?.value || null,
    amountRaw: amountResult?.raw || null,
    description: text, // Original text as description
    categoryId: null,
    categorySuggestion: null,
    categoryConfidence: null,
    accountId: null,
    toAccountId: null,
    date: wibDate,
    suggestions: []
  };
  
  // Add category suggestion if confidence is high/medium
  if (categorySuggestion && categorySuggestion.confidence !== 'low') {
    result.categoryId = categorySuggestion.categoryId;
    result.categorySuggestion = categorySuggestion.cat;
    result.categoryConfidence = categorySuggestion.confidence;
    
    // Find category name
    const cat = categories.find(c => c.id === categorySuggestion.categoryId);
    if (cat) {
      result.categorySuggestion = cat.name;
    }
  }
  
  // Build preview suggestions
  if (amountResult) {
    result.suggestions.push({
      type: 'amount',
      value: amountResult.value,
      label: formatCurrency(amountResult.value)
    });
  }
  
  if (categorySuggestion) {
    result.suggestions.push({
      type: 'category',
      value: categorySuggestion.categoryId,
      label: result.categorySuggestion,
      confidence: categorySuggestion.confidence
    });
  }
  
  if (type !== 'expense') {
    result.suggestions.push({
      type: 'type',
      value: type,
      label: type === 'income' ? '💰 Pemasukan' : '🔄 Transfer'
    });
  }
  
  return result;
}

/**
 * Get date in WIB timezone
 */
function getWIBDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta'
  }).format(date);
}

/**
 * Format currency for display
 */
function formatCurrency(value) {
  return `Rp ${value.toLocaleString('id-ID')}`;
}

/**
 * Apply parsed result to form (for auto-fill)
 */
export function applyToForm(parsed, formData = {}) {
  return {
    ...formData,
    type: parsed.type || formData.type,
    amount: parsed.amount !== null ? String(parsed.amount) : formData.amount,
    description: parsed.description || formData.description,
    categoryId: parsed.categoryId || formData.categoryId,
    date: parsed.date || formData.date
  };
}

/**
 * Get touched fields (fields user has modified)
 * Parser should not override touched fields
 */
export function getTouchedFields(formData, parsed) {
  const touched = {};
  
  if (formData.amount && formData.amount !== String(parsed.amount)) {
    touched.amount = true;
  }
  if (formData.categoryId && formData.categoryId !== parsed.categoryId) {
    touched.categoryId = true;
  }
  if (formData.description && formData.description !== parsed.description) {
    touched.description = true;
  }
  
  return touched;
}

export default { parseQuickEntry, applyToForm, getTouchedFields };
