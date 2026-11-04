/**
 * Quick Entry Parser - Orchestrates NLP parsing for transaction input
 * 
 * Takes raw text like "makan siang 45rb gopay" and returns structured data
 */

import { normalize, tokenize } from './normalize.js';
import { parseAmount, evalMath } from './parseAmount.js';
import { findMath } from './amountScan.js';
import { suggestCategory } from './suggestCategory.js';
import { parseQuantity } from './parseQuantity.js';


/**
 * The old keyword list, kept for the case where the device cannot reach
 * the backend. It is deliberately the same wording the backend uses, so
 * the two do not disagree in a way the user would notice.
 */
function detectTypeLocally(normalized) {
  const lowerText = normalized.toLowerCase();

  const transferWords = ['transfer', 'mutasi', 'pindah', 'topup', 'top up', 'kirim'];
  for (const word of transferWords) {
    if (lowerText.includes(word)) return 'transfer';
  }

  const incomeWords = [
    'gaji', 'salary', 'bonus', 'dividen', 'refund', 'cashback', 'komisi',
    'income', 'pemasukan', 'pendapatan', 'penghasilan', 'terima', 'masuk',
    'dapat', 'dibayarkan ke saya'
  ];
  for (const word of incomeWords) {
    if (lowerText.includes(word)) return 'income';
  }

  return null;
}

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
    // The sum carries its own span, so the text around it can be
    // taken away the same way. A sum that cannot be read has no
    // span and no amount, and the reader's own words stay.
    const found = findMath(normalized);
    if (found) {
      amountResult = { value: Math.round(found.value), raw: 'math expression', span: found.span };
    }
  }

  // A count of things at a price of each.
  //
  // "2 indomie 3500" is two at three thousand five hundred, which is
  // seven thousand. The reader wrote what they bought, not the total,
  // so the multiplication is done here rather than in their head.
  //
  // This is only used when the sentence plainly says the price is the
  // price of one. Otherwise the sentence is left as it was.
  const quantity = parseQuantity(normalized);
  if (quantity && (!amountResult || quantity.total > amountResult.value)) {
    amountResult = {
      value: quantity.total,
      raw: `${quantity.quantity} x ${quantity.unitPrice}`,
      span: [0, normalized.length],
    };
  }
  
  // Tokenize remaining text
  let textForTokens = normalized;
  if (amountResult) {
    textForTokens = normalized.slice(0, amountResult.span[0]) + normalized.slice(amountResult.span[1]);
  }
  
  const tokens = tokenize(textForTokens);
  
  // Which way does the money go?
  //
  // The decision belongs to the backend. It weighs the wording,
  // remembers what the user taught it before, and asks the language
  // model for the cases the wording cannot separate. The keyword list
  // that used to live here is kept as a fallback for the moment when
  // the device is offline, but it is no longer the answer.
  let type = 'expense';
  let directionSource = 'local';
  const localType = detectTypeLocally(normalized);
  if (localType) type = localType;
  
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
    // The count and the price of one, when the sentence had them.
    // The form uses these to show the reader the multiplication.
    quantity: quantity ? quantity.quantity : null,
    unitPrice: quantity ? quantity.unitPrice : null,
    description: text, // Original text as description
    categoryId: null,
    categorySuggestion: null,
    categoryConfidence: null,
    accountId: null,
    toAccountId: null,
    date: wibDate,
    directionSource,
    directionConfidence: null,
    directionReasons: [],
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
    // The count and the price of one are carried across, so the form
    // can show what was multiplied and let the reader change it.
    quantity: parsed.quantity !== null ? parsed.quantity : formData.quantity,
    unitPrice: parsed.unitPrice !== null ? parsed.unitPrice : formData.unitPrice,
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


/**
 * Ask the backend which way the money goes.
 *
 * The backend is the single place that answers this, so the quick entry
 * box, the voice parser, the receipt scanner and the AI agent all give
 * the same answer for the same sentence. It also remembers what the
 * user taught it before, so a phrase the user has used before is
 * answered the same way every time.
 *
 * When the device is offline this returns null, and the caller keeps
 * the local answer.
 */
export async function fetchDirection(text, merchant = null) {
  try {
    const { api } = await import('../../../services/api.js');
    const result = await api.direction.classify(text, merchant);
    return {
      direction: result.direction,
      confidence: result.confidence,
      band: result.band,
      source: result.source,
      reasons: result.reasons || [],
    };
  } catch (err) {
    // Being offline is not an error here. The local answer stands.
    return null;
  }
}

export default { parseQuickEntry, fetchDirection, applyToForm, getTouchedFields };
