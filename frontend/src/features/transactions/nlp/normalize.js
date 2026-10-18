/**
 * Normalize Indonesian text for parsing
 * - Lowercase
 * - Expand slang
 * - Clean formatting
 */

const SLANG_MAP = {
  // Transfer keywords
  'tf': 'transfer',
  'trf': 'transfer',
  'pindah': 'transfer',
  'muter': 'transfer',
  
  // Food
  'mkn': 'makan',
  'mnm': 'minum',
  'mnm': 'minum',
  'kopi': 'kopi',
  
  // Money slang
  'ceban': '50000',
  'goceng': '10000',
  'cepek': '10000',
  'sepulu': '10000',
  'duapulu': '20000',
  'limapulu': '50000',
  'sepulu': '10000',
  
  // Common typos
  'gopay': 'gopay',
  'go-pay': 'gopay',
  'gopet': 'gopay',
  'ovo': 'ovo',
  'dana': 'dana',
  
  // Transport
  'ojk': 'ojek',
  'bbm': 'bensin',
  
  // Internet
  'puls': 'pulsa',
  'dta': 'data',
};

export function normalize(text) {
  if (!text) return '';
  
  let result = text.toLowerCase().trim();
  
  // Replace slang
  for (const [slang, replacement] of Object.entries(SLANG_MAP)) {
    const regex = new RegExp(`\\b${slang}\\b`, 'gi');
    result = result.replace(regex, replacement);
  }
  
  // Clean extra spaces
  result = result.replace(/\s+/g, ' ').trim();
  
  return result;
}

/**
 * Extract tokens (unigram + bigram)
 */
export function tokenize(text) {
  const words = text.split(/\s+/);
  const tokens = [];
  
  // Unigrams
  for (const word of words) {
    if (word.length >= 2) {
      tokens.push(word);
    }
  }
  
  // Bigrams
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]} ${words[i + 1]}`;
    if (bigram.length >= 4) {
      tokens.push(bigram);
    }
  }
  
  return tokens;
}

export default { normalize, tokenize };
