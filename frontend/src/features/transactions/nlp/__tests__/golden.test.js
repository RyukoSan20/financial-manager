/**
 * Golden tests for NLP functions
 * Run with: node --experimental-vm-modules src/features/transactions/nlp/__tests__/golden.test.js
 */

import { normalize, tokenize } from '../normalize.js';
import { parseAmount } from '../parseAmount.js';
import { suggestCategory } from '../suggestCategory.js';
import { parseQuickEntry } from '../parseQuickEntry.js';

// Test cases from the spec
const TEST_CASES = [
  // Amount parsing
  { input: '45rb', expected: 45000, fn: 'parseAmount' },
  { input: '1,5jt', expected: 1500000, fn: 'parseAmount' },
  { input: '500rb', expected: 500000, fn: 'parseAmount' },
  { input: '25.000', expected: 25000, fn: 'parseAmount' },
  { input: '1.500.000', expected: 1500000, fn: 'parseAmount' },
  { input: 'kopi 2', expected: null, fn: 'parseAmount' }, // "2" is too small
  
  // Transfer detection
  { input: 'transfer ke bca 500rb', expectedType: 'transfer', fn: 'parseQuickEntry' },
  
  // Shopping detection  
  { input: 'shopee baju 150rb', expectedType: 'expense', expectedCategory: 'Fashion', fn: 'parseQuickEntry' },
  
  // Food detection
  { input: 'kopi 2 orang 50k', expectedAmount: 50000, fn: 'parseQuickEntry' },
  
  // Income detection
  { input: '1,5jt gaji', expectedType: 'income', fn: 'parseQuickEntry' },
];

function runTests() {
  console.log('🧪 Running Golden Tests\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const tc of TEST_CASES) {
    let result;
    let success = false;
    
    try {
      switch (tc.fn) {
        case 'parseAmount':
          result = parseAmount(tc.input);
          success = tc.expected === null 
            ? result === null 
            : result?.value === tc.expected;
          break;
          
        case 'parseQuickEntry':
          result = parseQuickEntry(tc.input, {
            categories: [
              { id: 1, name: 'Fashion', system_key: 'fashion' },
              { id: 2, name: 'Makanan & Minuman', system_key: 'food' },
              { id: 3, name: 'Pendapatan', system_key: 'income' },
            ]
          });

          // A case that says what it expects is checked on that
          // alone. A case that says nothing about the type is not
          // failed for having the wrong type.
          success = true;
          if (tc.expectedType) {
            success = success && result.type === tc.expectedType;
          }
          if (tc.expectedAmount) {
            success = success && result.amount === tc.expectedAmount;
          }
          if (tc.expectedCategory) {
            success = success && result.categorySuggestion?.includes(tc.expectedCategory);
          }
          break;
      }
      
      if (success) {
        console.log(`✅ ${tc.input}`);
        passed++;
      } else {
        console.log(`❌ ${tc.input}`);
        console.log(`   Expected: ${JSON.stringify(tc.expected)}`);
        console.log(`   Got: ${JSON.stringify(result)}`);
        failed++;
      }
    } catch (e) {
      console.log(`❌ ${tc.input} - Error: ${e.message}`);
      failed++;
    }
  }
  
  // The results are printed above, so that a person can see what the
  // parser made of each phrase. The checks below are the ones that
  // decide whether the run passed.
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

// The run is started here, so that the file checks the parser when it
// is run and not only when a person reads it. A failure ends the run
// with a non-zero code, so a script that calls this file cannot
// mistake a broken parser for a working one.
if (!runTests()) {
  process.exit(1);
}

// Quick validation tests
console.log('=== parseAmount ===');
console.log('45rb:', parseAmount('45rb'));
console.log('1,5jt:', parseAmount('1,5jt'));
console.log('500000:', parseAmount('500000'));
console.log('kopi 2:', parseAmount('kopi 2'));

console.log('\n=== tokenize ===');
console.log(tokenize('makan siang 45rb gopay'));

console.log('\n=== suggestCategory ===');
const hints = {};
const cats = [
  { id: 1, name: 'Fashion', system_key: 'fashion' },
  { id: 2, name: 'Makanan & Minuman', system_key: 'food' },
];
console.log(suggestCategory(['kopi', 'malam'], hints, { food: 2, fashion: 1 }));

console.log('\n=== parseQuickEntry ===');
const parsed = parseQuickEntry('kopi 2 orang 50k', { categories: cats });
console.log(JSON.stringify(parsed, null, 2));
