/**
 * Suggest category using layered fuzzy matching
 * 
 * Layer 1: Exact match (seed + user history) → full score
 * Layer 2: Normalize doubles/typos → "makaaan" → "makan"
 * Layer 3: Skeleton match → "indomrt" = "indomaret"
 * Layer 4: Edit distance → "alfmart", "gofod", "kopii"
 * Layer 5: Learn from user → user choice becomes new data
 * Layer 6: LLM fallback (for future)
 */

import { SEED_CATEGORIES, buildLookupMap } from './data/seed-categories.js';
import { 
  normalizeDoubles, 
  buildSkeleton, 
  fuzzyMatch, 
  matchWithPriority 
} from './fuzzyMatch.js';

// Build seed lookup map
const SEED_LOOKUP = buildLookupMap(SEED_CATEGORIES);

// Stopwords
const STOPWORDS = new Set([
  'yang', 'dan', 'di', 'ke', 'dari', 'dengan', 'untuk', 'pada',
  'ini', 'itu', 'oleh', 'adalah', 'sebagai',
  'tanggal', 'pukul', 'jam', 'via',
  'dini', 'pagi', 'siang', 'sore', 'malam', 'tengah',
  'ke', 'dari', 'dengan', 'untuk', 'pada', 'ini', 'itu'
]);

/**
 * Layer 1: Exact match in seed + user hints
 */
function exactMatch(token, userHints, categoryMap) {
  // Check user hints first (higher priority)
  if (userHints[token]) {
    const hints = userHints[token];
    for (const [systemKey, data] of Object.entries(hints)) {
      if (categoryMap[systemKey]) {
        return {
          systemKey,
          categoryId: categoryMap[systemKey],
          score: calcUserScore(data.hits || 1),
          layer: 1,
          type: 'user-exact'
        };
      }
    }
  }
  
  // Check seed dictionary
  const seedMatch = SEED_LOOKUP.get(token.toLowerCase());
  if (seedMatch) {
    return {
      systemKey: seedMatch.system_key,
      categoryId: categoryMap[seedMatch.system_key],
      score: seedMatch.weight,
      layer: 1,
      type: 'seed-exact'
    };
  }
  
  return null;
}

/**
 * Layer 2: Normalize doubles and typos
 */
function normalizeMatch(token, userHints, categoryMap) {
  const normalized = normalizeDoubles(token.toLowerCase());
  if (normalized === token.toLowerCase()) return null;
  
  // Try exact match with normalized form
  return exactMatch(normalized, userHints, categoryMap);
}

/**
 * Layer 3: Skeleton match
 */
function skeletonMatch(token, categoryMap) {
  const tokenSkeleton = buildSkeleton(token);
  
  if (tokenSkeleton.length < 3) return null;
  
  // Build skeleton dictionary
  const skeletonLookup = new Map();
  
  for (const [key, cat] of Object.entries(SEED_CATEGORIES)) {
    for (const term of [...(cat.brand || []), ...(cat.generic || [])]) {
      const skel = buildSkeleton(term);
      if (!skeletonLookup.has(skel) || skeletonLookup.get(skel).weight < 0.6) {
        skeletonLookup.set(skel, { systemKey: key, weight: 0.6 });
      }
    }
  }
  
  const match = skeletonLookup.get(tokenSkeleton);
  if (match && categoryMap[match.systemKey]) {
    return {
      systemKey: match.systemKey,
      categoryId: categoryMap[match.systemKey],
      score: match.weight,
      layer: 3,
      type: 'skeleton'
    };
  }
  
  return null;
}

/**
 * Layer 4: Edit distance fuzzy match
 */
function fuzzyMatchTokens(token, categoryMap) {
  // Build flat dictionary of all terms
  const allTerms = [];
  
  for (const [key, cat] of Object.entries(SEED_CATEGORIES)) {
    const weight = 0.5; // Lower weight for fuzzy matches
    for (const term of [...(cat.brand || []), ...(cat.generic || [])]) {
      allTerms.push({ key, term, weight });
    }
  }
  
  const result = fuzzyMatch(token, allTerms, { minScore: 0.75 });
  
  if (result && categoryMap[result.systemKey]) {
    return {
      systemKey: result.systemKey,
      categoryId: categoryMap[result.systemKey],
      score: result.score * 0.7, // Reduced weight for fuzzy
      layer: 4,
      type: 'fuzzy'
    };
  }
  
  return null;
}

/**
 * Calculate user hint score
 * 1 hit = 0.5, 5 hits = 0.83, 10 hits = 0.91
 */
function calcUserScore(hits) {
  return 1 - 1 / (1 + hits);
}

/**
 * Suggest category with layered matching
 */
export function suggestCategory(tokens, userHints = {}, categoryMap = {}) {
  // Track all matches
  const categoryScores = new Map();
  
  for (const token of tokens) {
    if (STOPWORDS.has(token.toLowerCase())) continue;
    if (/^\d+$/.test(token)) continue;
    if (token.length < 2) continue;
    
    let found = false;
    
    // Layer 1: Exact match
    const exact = exactMatch(token, userHints, categoryMap);
    if (exact && exact.categoryId) {
      addScore(categoryScores, exact);
      found = true;
    }
    
    // Layer 2: Normalized match (only if no exact found)
    if (!found) {
      const norm = normalizeMatch(token, userHints, categoryMap);
      if (norm && norm.categoryId) {
        addScore(categoryScores, { ...norm, score: norm.score * 0.95 }); // Slight penalty
      }
    }
    
    // Layer 3: Skeleton match
    if (!found) {
      const skel = skeletonMatch(token, categoryMap);
      if (skel && skel.categoryId) {
        addScore(categoryScores, skel);
      }
    }
    
    // Layer 4: Fuzzy match
    if (!found) {
      const fuzzy = fuzzyMatchTokens(token, categoryMap);
      if (fuzzy && fuzzy.categoryId) {
        addScore(categoryScores, fuzzy);
      }
    }
  }
  
  // Rank categories
  const ranked = [...categoryScores.entries()]
    .map(([systemKey, data]) => ({
      systemKey,
      categoryId: data.categoryId,
      score: data.score,
      matches: data.matches,
      avgLayer: data.matches.reduce((s, m) => s + m.layer, 0) / data.matches.length
    }))
    .filter(r => r.categoryId)
    .sort((a, b) => b.score - a.score);
  
  if (ranked.length === 0) {
    return { confidence: 'low', matches: [] };
  }
  
  const [top, second] = ranked;
  
  // Calculate confidence
  let confidence = 'low';
  if (top.score >= 0.85) confidence = 'high';
  else if (top.score >= 0.5) confidence = 'medium';
  
  // Check margin
  if (second) {
    const margin = top.score - second.score;
    if (margin < 0.1 && confidence === 'high') {
      confidence = 'medium';
    }
  }
  
  return {
    cat: top.systemKey,
    categoryId: top.categoryId,
    score: top.score,
    confidence,
    runnerUp: second?.systemKey,
    matches: top.matches,
    matchTypes: top.matches.map(m => m.type)
  };
}

/**
 * Add score to category using noisy-OR
 */
function addScore(scores, match) {
  const existing = scores.get(match.systemKey) || {
    categoryId: match.categoryId,
    score: 0,
    matches: []
  };
  
  // Noisy-OR: P(A or B) = 1 - (1-P(A))*(1-P(B))
  const newScore = 1 - (1 - existing.score) * (1 - match.score);
  
  scores.set(match.systemKey, {
    categoryId: match.categoryId,
    score: newScore,
    matches: [...existing.matches, match]
  });
}

/**
 * Build user hints from transaction history
 */
export function buildUserHints(transactions = []) {
  const hints = {};
  
  for (const tx of transactions) {
    if (!tx.description || !tx.category?.system_key) continue;
    
    const words = tx.description
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length >= 2 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
    
    const systemKey = tx.category.system_key;
    
    for (const word of words) {
      if (!hints[word]) hints[word] = {};
      if (!hints[word][systemKey]) hints[word][systemKey] = { hits: 0 };
      hints[word][systemKey].hits++;
    }
  }
  
  return hints;
}

/**
 * Build category map from categories
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

/**
 * Learn from user correction
 * Returns updated hints
 */
export function learnFromCorrection(hints, token, correctSystemKey, wrongSystemKey = null) {
  const updated = { ...hints };
  
  if (!updated[token]) updated[token] = {};
  if (!updated[token][correctSystemKey]) updated[token][correctSystemKey] = { hits: 0 };
  
  // Add 2 for correction (more valuable than confirmation)
  updated[token][correctSystemKey].hits += 2;
  
  // Penalize wrong suggestion if provided
  if (wrongSystemKey && updated[token][wrongSystemKey]) {
    updated[token][wrongSystemKey].hits = Math.max(0, updated[token][wrongSystemKey].hits - 1);
  }
  
  return updated;
}

export default { suggestCategory, buildUserHints, buildCategoryMap, learnFromCorrection };
