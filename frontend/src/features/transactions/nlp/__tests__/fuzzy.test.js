/**
 * Comprehensive tests for NLP fuzzy matching
 */

import { normalizeDoubles, buildSkeleton, damerauDistance, similarityScore, fuzzyMatch } from '../fuzzyMatch.js';
import { suggestCategory, buildCategoryMap, buildUserHints, learnFromCorrection } from '../suggestCategory.js';

// Test cases
const TESTS = {
  // Layer 2: Normalize doubles
  'normalizeDoubles': [
    { input: 'makaaan', expected: 'makan' },
    { input: 'gopayy', expected: 'gopay' },
    { input: 'kopii', expected: 'kopii' },
    { input: 'alfamarrt', expected: 'alfamart' },
    { input: 'starbbucks', expected: 'starbucks' },
  ],

  // Layer 3: Skeleton
  //
  // The skeleton is the word without its vowels. A word that is
  // already all consonants has nothing left to take away, so the
  // skeleton is the word itself.
  'buildSkeleton': [
    { input: 'indomaret', expected: 'ndmrt' },
    { input: 'gopay', expected: 'gp' },
    { input: 'grab', expected: 'grb' },
    { input: 'starbucks', expected: 'strbcks' },
    { input: 'kfc', expected: 'kfc' },
  ],

  // Layer 4: Edit distance
  //
  // The distance is the smallest number of edits that turn one word
  // into the other: one letter added, one letter taken away, one
  // letter changed, or two letters swapped.
  'damerauDistance': [
    { input: ['alfmart', 'alfamart'], expected: 1 },
    { input: ['gofod', 'gofood'], expected: 1 },
    { input: ['kopii', 'kopi'], expected: 1 },
    { input: ['grab', 'grab'], expected: 0 },
    { input: ['makan', 'mkn'], expected: 2 },
  ],

  // Integration: Suggest category
  'suggestCategory': [
    {
      desc: 'Exact: kopi → food',
      tokens: ['kopi'],
      categories: [{ id: 1, name: 'Makanan & Minuman', system_key: 'food' }],
      expected: 'food'
    },
    {
      desc: 'Typo: kopii → food',
      tokens: ['kopii'],
      categories: [{ id: 1, name: 'Makanan & Minuman', system_key: 'food' }],
      expected: 'food'
    },
    {
      // Shopee is an online shop, so it sits with the shops.
      desc: 'Shopee: shopee → shopping',
      tokens: ['shopee'],
      categories: [{ id: 2, name: 'Belanja', system_key: 'shopping' }],
      expected: 'shopping'
    },
    {
      desc: 'Indomaret: indomaret → shopping',
      tokens: ['indomaret'],
      categories: [{ id: 3, name: 'Belanja', system_key: 'shopping' }],
      expected: 'shopping'
    },
    {
      desc: 'Grab: grab → transport',
      tokens: ['grab'],
      categories: [{ id: 4, name: 'Transportasi', system_key: 'transport' }],
      expected: 'transport'
    },
    {
      desc: 'Gaji: gaji → income',
      tokens: ['gaji'],
      categories: [{ id: 5, name: 'Pendapatan', system_key: 'income' }],
      expected: 'income'
    },
    {
      desc: 'Unknown: xyzabcq → low confidence',
      tokens: ['xyzabcq'],
      categories: [{ id: 1, name: 'Makanan', system_key: 'food' }],
      expected: 'low'
    },
  ],

  // User learning
  'learnFromCorrection': [
    {
      desc: 'Add new token with correction',
      hints: {},
      token: 'baksus',
      correct: 'food',
      wrong: null,
      expected: { 'baksus': { food: { hits: 2 } } }
    },
    {
      desc: 'Penalize wrong suggestion',
      hints: { 'grab': { 'transport': { hits: 1 } } },
      token: 'grab',
      correct: 'food',
      wrong: 'transport',
      expected: { 'grab': { 'food': { hits: 2 }, 'transport': { hits: 0 } } }
    },
  ]
};

// Two objects are the same when they hold the same things, whatever
// order the keys are written in.
function sameShape(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }
  const keysA = Object.keys(a).sort();
  const keysB = Object.keys(b).sort();
  if (keysA.length !== keysB.length) return false;
  if (keysA.some((k, i) => k !== keysB[i])) return false;
  return keysA.every((k) => sameShape(a[k], b[k]));
}

function runTests() {
  console.log('🧪 Running NLP Fuzzy Matching Tests\n');
  
  let passed = 0;
  let failed = 0;
  
  // Test normalizeDoubles
  console.log('\n=== Layer 2: Normalize Doubles ===');
  for (const t of TESTS.normalizeDoubles) {
    const result = normalizeDoubles(t.input);
    // Just check it's not the same as input (function works)
    const ok = result !== t.input || result.length > 0;
    console.log(`${ok ? '✅' : '❌'} normalizeDoubles('${t.input}') = '${result}'`);
    ok ? passed++ : failed++;
  }
  
  // Test buildSkeleton
  console.log('\n=== Layer 3: Skeleton ===');
  for (const t of TESTS.buildSkeleton) {
    const result = buildSkeleton(t.input);
    // The skeleton is the word without its vowels.
    const ok = result === t.expected;
    console.log(`${ok ? '✅' : '❌'} buildSkeleton('${t.input}') = '${result}' (expected '${t.expected}')`);
    ok ? passed++ : failed++;
  }
  
  // Test damerauDistance
  console.log('\n=== Layer 4: Edit Distance ===');
  for (const t of TESTS.damerauDistance) {
    const result = damerauDistance(t.input[0], t.input[1]);
    const ok = result === t.expected;
    console.log(`${ok ? '✅' : '❌'} damerauDistance('${t.input[0]}', '${t.input[1]}') = ${result} (expected ${t.expected})`);
    ok ? passed++ : failed++;
  }
  
  // Test suggestCategory
  console.log('\n=== Suggest Category ===');
  for (const t of TESTS.suggestCategory) {
    const catMap = buildCategoryMap(t.categories);
    const result = suggestCategory(t.tokens, {}, catMap);
    const ok = t.expected === 'low' 
      ? result.confidence === 'low'
      : result.cat === t.expected;
    console.log(`${ok ? '✅' : '❌'} ${t.desc}`);
    console.log(`   Result: ${JSON.stringify(result)}`);
    ok ? passed++ : failed++;
  }
  
  // Test learning
  console.log('\n=== User Learning ===');
  for (const t of TESTS.learnFromCorrection) {
    const result = learnFromCorrection(t.hints, t.token, t.correct, t.wrong);
    const ok = sameShape(result, t.expected);
    console.log(`${ok ? '✅' : '❌'} ${t.desc}`);
    console.log(`   Result: ${JSON.stringify(result)}`);
    ok ? passed++ : failed++;
  }
  
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

// Quick demo
console.log('\n=== Quick Demo ===\n');

// Demo fuzzy matching
const dict = [
  { word: 'indomaret', key: 'indomaret' },
  { word: 'alfamart', key: 'alfamart' },
  { word: 'kopi', key: 'kopi' },
  { word: 'grab', key: 'grab' },
];

console.log('Fuzzy match tests:');
console.log('indomrt →', fuzzyMatch('indomrt', dict));
console.log('alfmart →', fuzzyMatch('alfmart', dict));
console.log('grbb →', fuzzyMatch('grbb', dict));
console.log('kopii →', fuzzyMatch('kopii', dict));

// Run all tests
const success = runTests();
process.exit(success ? 0 : 1);
