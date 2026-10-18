/**
 * Fuzzy matching utilities for Indonesian text
 * Layered approach: exact → normalize → skeleton → edit distance → learn
 */

/**
 * Normalize double letters and common typos
 * "makaaan" → "makan", "gopayy" → "gopay"
 */
export function normalizeDoubles(text) {
  let result = text.toLowerCase();
  
  // Reduce 3+ consecutive same letters to 2
  result = result.replace(/(.)\1{2,}/g, '$1$1');
  
  // Common Indonesian typos
  result = result.replace(/q/g, 'k');  // Q often used for K
  result = result.replace(/z/g, 's');  // Z often used for S
  result = result.replace(/v/g, 'f');  // V often used for F
  result = result.replace(/x/g, 'ks'); // X is short for KS
  
  // Common SMS abbreviations
  result = result.replace(/\br\b/g, 'ribu');  // r → ribu
  result = result.replace(/\bk\b/g, 'ribu');   // k → ribu
  
  return result;
}

/**
 * Build consonant skeleton (vowel-less version)
 * "indomaret" → "ndmrt"
 * "gopay" → "gpy" (keep y as it can be a vowel or consonant)
 * "alfamart" → "lfmrt"
 */
export function buildSkeleton(text) {
  return text
    .toLowerCase()
    .replace(/[aeiou]+/g, '')
    .replace(/y/g, ''); // Remove y too
}

/**
 * Calculate Damerau-Levenshtein distance
 * Counts: substitution, insertion, deletion, transposition
 */
export function damerauDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  
  if (m === 0) return n;
  if (n === 0) return m;
  
  // Create distance matrix
  const d = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  // Initialize
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  
  // Fill matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      
      d[i][j] = Math.min(
        d[i - 1][j] + 1,      // deletion
        d[i][j - 1] + 1,      // insertion
        d[i - 1][j - 1] + cost // substitution
      );
      
      // Transposition (adjacent swap)
      if (i > 1 && j > 1 && 
          str1[i - 1] === str2[j - 2] && 
          str1[i - 2] === str2[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost);
      }
    }
  }
  
  return d[m][n];
}

/**
 * Calculate similarity score (0-1)
 * Based on Damerau distance
 */
export function similarityScore(str1, str2) {
  if (str1 === str2) return 1;
  if (str1.length === 0 || str2.length === 0) return 0;
  
  const maxLen = Math.max(str1.length, str2.length);
  const dist = damerauDistance(str1, str2);
  
  return 1 - (dist / maxLen);
}

/**
 * Fuzzy match a token against a dictionary
 * Returns match with score and match type
 */
export function fuzzyMatch(token, dictionary, options = {}) {
  const {
    minScore = 0.7,      // Minimum score to consider a match
    maxEdits = 2,         // Max edit distance for short words
    checkSkeleton = true,  // Also check skeleton matching
  } = options;
  
  let bestMatch = null;
  
  for (const entry of dictionary) {
    const dictWord = entry.word || entry;
    const dictKey = entry.key || dictWord;
    
    // 1. Exact match
    if (token === dictKey) {
      return { word: dictWord, key: dictKey, score: 1.0, type: 'exact' };
    }
    
    // 2. Case-insensitive exact
    if (token.toLowerCase() === dictKey.toLowerCase()) {
      return { word: dictWord, key: dictKey, score: 0.95, type: 'exact-case' };
    }
    
    // 3. Contains (token contains dict or vice versa)
    if (token.includes(dictKey) || dictKey.includes(token)) {
      const overlap = Math.min(token.length, dictKey.length) / Math.max(token.length, dictKey.length);
      if (overlap > 0.8) {
        return { word: dictWord, key: dictKey, score: 0.85, type: 'contains' };
      }
    }
    
    // 4. Skeleton match
    if (checkSkeleton) {
      const tokenSkeleton = buildSkeleton(token);
      const dictSkeleton = buildSkeleton(dictKey);
      
      if (tokenSkeleton === dictSkeleton && tokenSkeleton.length >= 3) {
        return { word: dictWord, key: dictKey, score: 0.8, type: 'skeleton' };
      }
    }
    
    // 5. Edit distance (for short words)
    const editDist = damerauDistance(token, dictKey);
    const maxAllowedEdits = Math.max(maxEdits, Math.floor(dictKey.length * 0.3)); // 30% tolerance
    
    if (editDist <= maxAllowedEdits) {
      const score = 1 - (editDist / Math.max(token.length, dictKey.length));
      if (score >= minScore) {
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { word: dictWord, key: dictKey, score, type: 'fuzzy', edits: editDist };
        }
      }
    }
  }
  
  return bestMatch;
}

/**
 * Match a token against a dictionary with priority
 * Returns best match with score
 */
export function matchWithPriority(token, dictionary) {
  // Try exact match first
  const exact = dictionary.find(d => {
    const key = d.key || d.word || d;
    return token.toLowerCase() === key.toLowerCase();
  });
  
  if (exact) {
    return {
      match: exact,
      score: 1.0,
      type: 'exact'
    };
  }
  
  // Try fuzzy match
  const fuzzy = fuzzyMatch(token, dictionary, { minScore: 0.75 });
  
  if (fuzzy) {
    return {
      match: fuzzy.word,
      score: fuzzy.score,
      type: fuzzy.type
    };
  }
  
  return null;
}

export default {
  normalizeDoubles,
  buildSkeleton,
  damerauDistance,
  similarityScore,
  fuzzyMatch,
  matchWithPriority
};
