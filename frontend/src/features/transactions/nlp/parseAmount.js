/**
 * Parse Indonesian currency amounts from text
 * Handles: "45rb", "1,5jt", "25.000", "100000", "1jt"
 */

const MULTIPLIERS = {
  'k': 1000,
  'rb': 1000,
  'ribu': 1000,
  'jt': 1000000,
  'juta': 1000000,
  'rban': 100000,
  'c': 100,
};

// Indonesian number words
const NUMBER_WORDS = {
  'satu': 1, 'dua': 2, 'tiga': 3, 'empat': 4, 'lima': 5,
  'enam': 6, 'tujuh': 7, 'delapan': 8, 'sembilan': 9,
  'sepuluh': 10, 'sebelas': 11,
  'puluh': 'puluh', 'belas': 'belas',
  'ratus': 100, 'seratus': 100,
  'seribu': 1000,
};

/**
 * Parse amount from text
 * @param {string} text - Input text
 * @returns {{ value: number, span: [number, number] } | null}
 */
export function parseAmount(text) {
  if (!text) return null;
  
  // Pattern: number with optional unit (rb,jt,k) or Indonesian number words
  // Match: 45rb, 1.5jt, 25000, 1,5jt, seratus ribu
  const RE = /(\d{1,3}(?:[.,]\d+)?)\s*(k|rb|ribu|jt|juta|rban|c)?(?!\w)/gi;
  
  let match;
  while ((match = RE.exec(text)) !== null) {
    const [raw, numStr, unit] = match;
    let value;
    
    if (unit) {
      // Has unit like "rb", "jt", "k"
      const cleanNum = numStr.replace(',', '.');
      const num = parseFloat(cleanNum);
      value = Math.round(num * MULTIPLIERS[unit.toLowerCase()]);
    } else {
      // No unit - treat as thousands with dots
      const cleanNum = numStr.replace(/\./g, '');
      value = parseInt(cleanNum, 10);
      
      // Ignore values < 1000 without unit (likely not money)
      if (value < 1000) continue;
    }
    
    if (value > 0 && value <= 1000000000) { // Max 1 billion
      return {
        value,
        span: [match.index, match.index + raw.length],
        raw
      };
    }
  }
  
  // Try parsing plain number (minimum 4 digits = 1000 in thousands)
  const plainMatch = text.match(/^(\d{4,10})$/);
  if (plainMatch) {
    const val = parseInt(plainMatch[1], 10);
    if (val >= 1000 && val <= 1000000000) {
      return {
        value: val,
        span: [0, plainMatch[1].length],
        raw: plainMatch[1]
      };
    }
  }
  
  return null;
}

/**
 * Parse Indonesian number words (seratus ribu, dua puluh lima ribu)
 * @param {string} text
 * @returns {number | null}
 */
export function parseNumberWords(text) {
  const lower = text.toLowerCase();
  
  // Simple patterns
  if (lower.includes('seratus ribu') || lower.includes('seribu')) {
    return 1000;
  }
  if (lower.includes('ratus ribu') || lower.includes('ratusan ribu')) {
    // Extract the number before "ratus"
    const match = lower.match(/(\w+)\s*ratus/);
    if (match) {
      const num = NUMBER_WORDS[match[1]];
      if (num) return num * 100 * 1000;
    }
  }
  
  return null;
}

/**
 * Evaluate simple math expressions like "25000+15000" or "50000*2"
 * @param {string} text
 * @returns {number | null}
 */
export function evalMath(text) {
  // Match patterns like "25000+15000", "50000 * 2", "100000/2"
  const mathMatch = text.match(/(\d[\d.,]*)\s*([+\-*/])\s*(\d[\d.,]*)/);
  
  if (mathMatch) {
    const [, a, op, b] = mathMatch;
    const numA = parseAmount(a)?.value || parseInt(a.replace(/\./g, ''), 10);
    const numB = parseAmount(b)?.value || parseInt(b.replace(/\./g, ''), 10);
    
    switch (op) {
      case '+': return numA + numB;
      case '-': return numA - numB;
      case '*': return numA * numB;
      case '/': return numA / numB;
    }
  }
  
  return null;
}

export default { parseAmount, parseNumberWords, evalMath };
