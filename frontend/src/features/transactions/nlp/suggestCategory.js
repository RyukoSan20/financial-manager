/**
 * Suggest category using noisy-OR Bayesian inference
 * Score = P(category | tokens) = 1 - Π(1 - P(category | token_i))
 * 
 * User hints override seed dictionary over time
 */

import { SEED_CATEGORIES, buildLookupMap } from './data/seed-categories.js';

// Build seed lookup map once
const SEED_LOOKUP = buildLookupMap(SEED_CATEGORIES);

// Stopwords that don't indicate category
const STOPWORDS = new Set([
  'yang', 'dan', 'di', 'ke', 'dari', 'dengan', 'untuk', 'pada',
  'ini', 'itu', 'oleh', 'adalah', 'sebagai',
  'tanggal', 'pukul', 'jam', 'via', 'senin', 'selasa', 'rabu',
  'kamis', 'jumat', 'sabtu', 'minggu', 'bulan', 'tahun',
  'dini', 'pagi', 'siang', 'sore', 'malam', 'tengah'
]);

/**
 * Score category using noisy-OR
 * @param {string[]} tokens - Tokenized words
 * @param {Object} userHints - { categoryId: { hits: number } } from user history
 * @param {Object} categoryMap - { system_key: categoryId } for current user
 * @returns {{ cat: string, score: number, confidence: 'high'|'medium'|'low', runnerUp?: string }}
 */
export function suggestCategory(tokens, userHints = {}, categoryMap = {}) {
  // Probability mass for each category (noisy-OR)
  const categoryProbs = new Map();
  
  for (const token of tokens) {
    if (STOPWORDS.has(token.toLowerCase())) continue;
    if (/^\d+$/.test(token)) continue; // Skip pure numbers
    
    // Check user hints first (higher priority)
    if (userHints[token]) {
      const hints = userHints[token];
      for (const [systemKey, data] of Object.entries(hints)) {
        const hits = data.hits || 1;
        // Weight formula: 1 - 1/(1+hits) means 1 hit = 0.5, 5 hits = 0.83, 10 hits = 0.91
        const weight = 1 - 1 / (1 + hits);
        const existingProb = categoryProbs.get(systemKey) || 0;
        // Noisy-OR: P(A or B) = 1 - (1-P(A))*(1-P(B))
        categoryProbs.set(systemKey, 1 - (1 - existingProb) * (1 - weight));
      }
    }
    
    // Check seed dictionary
    const seedMatch = SEED_LOOKUP.get(token.toLowerCase());
    if (seedMatch) {
      const { system_key, weight } = seedMatch;
      const existingProb = categoryProbs.get(system_key) || 0;
      categoryProbs.set(system_key, 1 - (1 - existingProb) * (1 - weight));
    }
  }
  
  // Rank categories
  const ranked = [...categoryProbs.entries()]
    .map(([system_key, score]) => ({
      system_key,
      score,
      categoryId: categoryMap[system_key]
    }))
    .filter(r => r.categoryId) // Only if category exists for user
    .sort((a, b) => b.score - a.score);
  
  if (ranked.length === 0) return null;
  
  const [top, second] = ranked;
  
  // Calculate confidence based on margin to runner-up
  let confidence = 'low';
  if (top.score >= 0.85) confidence = 'high';
  else if (top.score >= 0.5) confidence = 'medium';
  
  // Adjust for margin
  if (second) {
    const margin = top.score - second.score;
    if (margin < 0.1 && confidence === 'high') {
      confidence = 'medium'; // Too close to auto-fill
    }
  }
  
  return {
    cat: top.system_key,
    categoryId: top.categoryId,
    score: top.score,
    confidence,
    runnerUp: second?.system_key
  };
}

/**
 * Build user hint map from transaction history
 * @param {Array} transactions - Array of transactions with description and category
 * @returns {Object} - { token: { system_key: { hits: number } } }
 */
export function buildUserHints(transactions = []) {
  const hints = {};
  
  for (const tx of transactions) {
    if (!tx.description || !tx.category?.system_key) continue;
    
    const words = tx.description.toLowerCase().split(/\s+/);
    const systemKey = tx.category.system_key;
    
    for (const word of words) {
      if (word.length < 3) continue;
      if (STOPWORDS.has(word)) continue;
      if (/^\d+$/.test(word)) continue;
      
      if (!hints[word]) hints[word] = {};
      if (!hints[word][systemKey]) hints[word][systemKey] = { hits: 0 };
      hints[word][systemKey].hits++;
    }
  }
  
  return hints;
}

/**
 * Get category ID by system_key for current user
 * @param {Array} categories - User's categories
 * @returns {Object} - { system_key: categoryId }
 */
export function buildCategoryMap(categories = []) {
  const map = {};
  for (const cat of categories) {
    if (cat.system_key) {
      map[cat.system_key] = cat.id;
    }
  }
  return map;
}

export default { suggestCategory, buildUserHints, buildCategoryMap };
