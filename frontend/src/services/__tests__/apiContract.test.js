/**
 * The API client, and the split service that talks to it.
 *
 * The whole split feature was invisible in production because of a
 * small misunderstanding about what the API client gives back.
 *
 * The client here is not axios. It reads the body of the answer and
 * gives it back as it is. So an answer of `{"groups": []}` arrives
 * as the object `{"groups": []}`, and `answer.data` is undefined.
 *
 * The split service was written as if it were axios, so every one of
 * its calls answered `undefined`. The page then tried to read the
 * length of a group list that was not there, and the screen went
 * white instead of showing the groups.
 *
 * These checks keep the two things in step:
 *   - the client answers the body, and
 *   - the split service asks for the body, not for body.data.
 *
 * Run with: node src/services/__tests__/apiContract.test.js
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, actual, expected) {
  if (actual === expected) {
    passed += 1;
  } else {
    failed += 1;
    failures.push(
      `${name}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`,
    );
  }
}

function checkTrue(name, value) {
  check(name, Boolean(value), true);
}

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, '..');

const apiSource = readFileSync(join(srcDir, 'api.js'), 'utf8');
const splitSource = readFileSync(join(srcDir, 'splitApi.js'), 'utf8');

// --- The client gives the body back, not an envelope ---------------

check(
  'the client answers with the parsed body',
  apiSource.includes('return response.json()') ||
    apiSource.includes('await response.json()'),
  true,
);

check(
  'the client does not hand back an axios-style envelope',
  /\.data\b/.test(apiSource.replace(/\.data\.\w+/g, '')),
  false,
);

// --- The client has the verbs the split service needs --------------

checkTrue('the client can GET', /get:\s*\(path/.test(apiSource));
checkTrue('the client can POST', /post:\s*\(path/.test(apiSource));
checkTrue('the client can PUT', /put:\s*\(path/.test(apiSource));
checkTrue('the client can DELETE', /delete:\s*\(path/.test(apiSource));

// --- The split service asks for the body --------------------------

const splitCalls = splitSource.match(/api\.(get|post|put|delete)\(/g) || [];
checkTrue('the split service calls the client', splitCalls.length > 0);

check(
  'the split service does not reach into a .data that is not there',
  splitSource.includes('.data'),
  false,
);

check(
  'the split service does not read response.data',
  /response\.data|\bdata\s*=\s*response\.data/.test(splitSource),
  false,
);

// --- Every call in the split service has a verb that exists --------

const verbsUsed = [...new Set(splitCalls.map((c) => c.slice(4, -1)))];
for (const verb of verbsUsed) {
  checkTrue(`the client has a ${verb.toUpperCase()} the split service uses`,
    new RegExp(`${verb}:\\s*\\(path`).test(apiSource));
}

// --- The client turns an object into JSON for the server ----------

checkTrue(
  'the client sends JSON when the caller gives it an object',
  apiSource.includes('JSON.stringify(body)'),
);

if (failed > 0) {
  console.error(`\n${failed} check(s) failed:\n`);
  for (const f of failures) console.error(`  - ${f}\n`);
  process.exit(1);
}

console.log(`API contract: ${passed} checks passed`);
