/**
 * Category Hints API - User learning integration
 */

import { api } from '../../../services/api';

// Fetch bootstrap data (categories + hints + recent combos)
export async function fetchBootstrap() {
  return api.get('/category-hints/bootstrap');
}

// Record tokens when user saves a transaction
export async function recordTokens(tokens, categoryId) {
  return api.request('/category-hints/record-batch', {
    method: 'POST',
    body: JSON.stringify({ tokens, category_id: categoryId }),
  });
}

// Record user correction (more valuable)
export async function recordCorrection(token, correctCategoryId, wrongCategoryId = null) {
  return api.request('/category-hints/correct', {
    method: 'POST',
    body: JSON.stringify({
      token,
      correct_category_id: correctCategoryId,
      wrong_category_id: wrongCategoryId
    }),
  });
}

// Reset learning data
export async function resetHints() {
  return api.request('/category-hints/reset', { method: 'DELETE' });
}

// Extract tokens from description
export function extractTokens(description) {
  if (!description) return [];
  
  const STOPWORDS = {
    'yang': 1, 'dan': 1, 'di': 1, 'ke': 1, 'dari': 1,
    'dengan': 1, 'untuk': 1, 'pada': 1, 'ini': 1, 'itu': 1,
    'oleh': 1, 'adalah': 1, 'sebagai': 1, 'tanggal': 1, 'pukul': 1,
    'dini': 1, 'pagi': 1, 'siang': 1, 'sore': 1, 'malam': 1, 'tengah': 1,
    'di': 1, 'ke': 1, 'dari': 1, 'dengan': 1, 'untuk': 1, 'pada': 1,
  };
  
  const words = description.toLowerCase().split(/\s+/);
  return words.filter(w => 
    w.length >= 2 && 
    !STOPWORDS[w] && 
    !/^\d+$/.test(w) &&
    !/^[.,;:!?]+$/.test(w)
  );
}
