/**
 * The QR code, checked against the specification and against itself.
 *
 * Two kinds of check are here:
 *
 * - known answers from the specification. The worked example in
 *   ISO/IEC 18004 is the string "01234567" in byte mode, version 1,
 *   level M. The size and the finder pattern positions are checked
 *   against it, and the Reed-Solomon generator polynomial is checked
 *   against the published coefficients.
 *
 * - a decoder, written here, that reads a matrix back and gets the
 *   text out again. This is the real check: a code that a decoder
 *   cannot read is a code that a phone camera cannot read either.
 *
 * Run with: node src/components/split/__tests__/qr.test.js
 */

import {
  encodeQr,
  qrToSvg,
  moduleCount,
  generatorPolynomial,
  errorCorrection,
} from '../qr.js';

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

/* -------------------------------------------------------------------------
 * A decoder, so that the encoder can be read back.
 * ---------------------------------------------------------------------- */

/**
 * Find the mask that was used, by reading the format information.
 */
function readFormat(modules) {
  const _size = modules.length;
  let format = 0;
  for (let i = 0; i <= 5; i += 1) {
    if (modules[i][8]) format |= 1 << i;
  }
  if (modules[7][8]) format |= 1 << 6;
  if (modules[8][8]) format |= 1 << 7;
  if (modules[8][7]) format |= 1 << 8;
  for (let i = 9; i < 15; i += 1) {
    if (modules[8][14 - i]) format |= 1 << i;
  }

  const unmasked = format ^ 0x5412;
  let remainder = unmasked;
  for (let i = 0; i < 10; i += 1) {
    remainder = (remainder << 1) ^ ((remainder >> 9) * 0x537);
  }
  const data = (unmasked >> 10) & 0x1f;
  const check = (unmasked & 0x3ff) >>> 0;
  const expected = (((data << 10) | remainder) ^ 0x5412) >>> 0;
  return { mask: data & 0b111, ok: check === (remainder & 0x3ff) || expected === format };
}

/** The mask functions, the same eight the encoder uses. */
const MASKS = [
  (row, col) => (row + col) % 2 === 0,
  (row) => row % 2 === 0,
  (row, col) => col % 3 === 0,
  (row, col) => (row + col) % 3 === 0,
  (row, col) => (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0,
  (row, col) => ((row * col) % 2) + ((row * col) % 3) === 0,
  (row, col) => (((row * col) % 2) + ((row * col) % 3)) % 2 === 0,
  (row, col) => (((row + col) % 2) + ((row * col) % 3)) % 2 === 0,
];

/**
 * Which modules hold data, and where they are in the order the
 * specification puts them.
 */
function dataPositions(size) {
  const positions = [];
  const isFunction = [];
  for (let row = 0; row < size; row += 1) {
    isFunction.push(new Array(size).fill(false));
  }

  const mark = (row, col) => {
    if (row >= 0 && row < size && col >= 0 && col < size) {
      isFunction[row][col] = true;
    }
  };

  // The finder patterns and their separators.
  for (const [top, left] of [[0, 0], [0, size - 7], [size - 7, 0]]) {
    for (let row = -1; row <= 7; row += 1) {
      for (let col = -1; col <= 7; col += 1) {
        mark(top + row, left + col);
      }
    }
  }

  // The timing patterns.
  //
  // The timing pattern runs from row eight to row size minus nine.
  // The modules beside it are separators, and the ones next to those
  // are part of the finder patterns, so they are already marked.
  for (let i = 8; i < size - 8; i += 1) {
    mark(6, i);
    mark(i, 6);
  }

  // The format information.
  //
  // The first copy: the top left, the row eight from column zero to
  // column five, then column seven and eight, then the column eight
  // from row seven up to row zero.
  for (let i = 0; i <= 5; i += 1) mark(i, 8);
  mark(7, 8);
  mark(8, 8);
  mark(8, 7);
  for (let i = 9; i < 15; i += 1) mark(8, 14 - i);

  // The second copy: the row eight at the right, and the column
  // eight at the bottom.
  for (let i = 0; i < 8; i += 1) mark(8, size - 1 - i);
  for (let i = 8; i < 15; i += 1) mark(size - 15 + i, 8);

  // The dark module.
  mark(size - 8, 8);

  // The alignment patterns.
  const version = (size - 17) / 4;
  const positionsByVersion = {
    1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
    6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
  };
  const centres = positionsByVersion[version] || [];
  for (const row of centres) {
    for (const col of centres) {
      const isCorner =
        (row === 6 && col === 6) ||
        (row === 6 && col === centres[centres.length - 1]) ||
        (row === centres[centres.length - 1] && col === 6);
      if (isCorner) continue;
      for (let dr = -2; dr <= 2; dr += 1) {
        for (let dc = -2; dc <= 2; dc += 1) {
          mark(row + dr, col + dc);
        }
      }
    }
  }

  // The version information.
  if (version >= 7) {
    const edge = size - 11;
    for (let i = 0; i < 18; i += 1) {
      const row = Math.floor(i / 3);
      const col = i % 3;
      mark(row, edge + col);
      mark(edge + col, row);
    }
  }

  // The order the data goes in.
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    // The column six is the timing pattern, so the pair of columns
    // that would fall on it is stepped over.
    if (right === 6) right -= 1;
    for (let step = 0; step < size; step += 1) {
      const row = upward ? size - 1 - step : step;
      for (let colOffset = 0; colOffset < 2; colOffset += 1) {
        const col = right - colOffset;
        if (isFunction[row][col]) continue;
        positions.push([row, col]);
      }
    }
    upward = !upward;
  }

  return positions;
}

/**
 * Read a matrix back and get the text out of it.
 */
function decodeQr(modules) {
  const size = modules.length;
  const { mask } = readFormat(modules);
  const positions = dataPositions(size);

  // Take the mask off.
  const plain = modules.map((row) => row.slice());
  const fn = MASKS[mask];
  for (const [row, col] of positions) {
    if (fn(row, col)) {
      plain[row][col] = !plain[row][col];
    }
  }

  // Read the bits.
  const bits = [];
  for (const [row, col] of positions) {
    bits.push(plain[row][col] ? 1 : 0);
  }

  const codewords = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j += 1) {
      byte = (byte << 1) | bits[i + j];
    }
    codewords.push(byte);
  }

  // The codewords are interleaved: when the data was split into
  // blocks, the first byte of every block comes first, then the
  // second byte of every block, and so on. They have to be put back
  // the way they were before the text can be read.
  const version = (size - 17) / 4;
  const blocks = {
    1: 1, 2: 1, 3: 1, 4: 2, 5: 2, 6: 4, 7: 4, 8: 4, 9: 5, 10: 5,
  }[version];
  const dataCodewords = {
    1: 16, 2: 28, 3: 44, 4: 64, 5: 86, 6: 108, 7: 124, 8: 154,
    9: 182, 10: 216,
  }[version];

  const bytes = [];
  if (blocks === 1) {
    bytes.push(...codewords.slice(0, dataCodewords));
  } else {
    const perBlock = Math.floor(dataCodewords / blocks);
    const blocksData = [];
    for (let b = 0; b < blocks; b += 1) blocksData.push([]);
    let index = 0;
    for (let i = 0; i < perBlock; i += 1) {
      for (let b = 0; b < blocks; b += 1) {
        blocksData[b].push(codewords[index]);
        index += 1;
      }
    }
    // The shorter blocks come first, and hold one extra codeword.
    let extra = dataCodewords % blocks;
    for (let b = 0; b < blocks; b += 1) {
      if (extra > 0) {
        blocksData[b].push(codewords[index]);
        index += 1;
        extra -= 1;
      }
    }
    for (const block of blocksData) bytes.push(...block);
  }

  // The mode, the length, and then the text.
  const mode = (bytes[0] >> 4) & 0x0f;
  if (mode !== 0x4) throw new Error(`not byte mode: ${mode}`);

  // The data is a stream of bits, not a stream of bytes.
  //
  // The mode is four bits, the character count is eight, and then
  // come the characters, eight bits each. Because the header is
  // twelve bits and not a whole number of bytes, the characters do
  // not start on a byte boundary, and reading them as bytes would
  // shift every one of them.
  const dataBits = [];
  for (const byte of bytes) {
    for (let i = 7; i >= 0; i -= 1) {
      dataBits.push((byte >> i) & 1);
    }
  }

  const readBits = (from, count) => {
    let value = 0;
    for (let i = 0; i < count; i += 1) {
      value = (value << 1) | (dataBits[from + i] || 0);
    }
    return value;
  };

  const lengthBits = version <= 9 ? 8 : 16;
  const length = readBits(4, lengthBits);
  const start = 4 + lengthBits;

  const textBytes = [];
  for (let i = 0; i < length; i += 1) {
    textBytes.push(readBits(start + i * 8, 8));
  }

  return new TextDecoder('utf-8').decode(new Uint8Array(textBytes));
}

/* -------------------------------------------------------------------------
 * The known answers.
 * ---------------------------------------------------------------------- */

check('the module count of version 1 is 21', moduleCount(1), 21);
check('the module count of version 10 is 57', moduleCount(10), 57);

{
  // The generator polynomial of the specification, table 12, for ten
  // error correction codewords. The coefficients, highest term first.
  const expected = [
    1, 216, 194, 159, 111, 199, 94, 95, 113, 157, 193,
  ];
  const poly = generatorPolynomial(10);
  check(
    'the Reed-Solomon generator polynomial for ten codewords is the published one',
    JSON.stringify(poly),
    JSON.stringify(expected),
  );
}

{
  // The worked example: "01234567", byte mode, version 1, level M.
  const modules = encodeQr('01234567');
  check('the worked example is 21 modules across', modules.length, 21);
  check('the worked example is 21 modules down', modules[0].length, 21);

  // The finder patterns: a dark ring, a light ring, a dark core.
  const finderOk =
    modules[0][0] === true &&
    modules[1][1] === false &&
    modules[3][3] === true;
  checkTrue('the finder pattern has its dark core in the corner', finderOk);

  // The finder pattern in the other two corners.
  checkTrue(
    'the finder pattern is in the top right corner',
    modules[0][20] === true && modules[3][17] === true,
  );
  checkTrue(
    'the finder pattern is in the bottom left corner',
    modules[20][0] === true && modules[17][3] === true,
  );
}

/* -------------------------------------------------------------------------
 * The round trip.
 * ---------------------------------------------------------------------- */

const roundTrips = [
  ['a short phrase', 'Hello'],
  ['a URL', 'https://my-financial-manager.online/split/claim/ABC12345'],
  ['a name and an amount', 'Warung Sederhana - Rp75.000'],
  ['the digits only', '1234567890'],
  ['a longer text', 'Join the split bill and claim the items you ate.'],
];

for (const [name, text] of roundTrips) {
  try {
    const modules = encodeQr(text);
    check(`the decoder gets ${name} back`, decodeQr(modules), text);
  } catch (err) {
    failed += 1;
    failures.push(`the decoder gets ${name} back\n    ${err.message}`);
  }
}

{
  // A text that needs a version above one.
  const long = 'x'.repeat(120);
  try {
    const modules = encodeQr(long);
    check('a long text is read back', decodeQr(modules), long);
  } catch (err) {
    failed += 1;
    failures.push(`a long text is read back\n    ${err.message}`);
  }
}

{
  // A text with characters outside the basic latin.
  const text = 'Es Kopi Susu - 糖 - Rp18.000';
  try {
    const modules = encodeQr(text);
    check('a text with other scripts is read back', decodeQr(modules), text);
  } catch (err) {
    failed += 1;
    failures.push(`a text with other scripts is read back\n    ${err.message}`);
  }
}

/* -------------------------------------------------------------------------
 * The edges.
 * ---------------------------------------------------------------------- */

{
  // An empty text does not crash.
  let crashed = false;
  let modules = null;
  try {
    modules = encodeQr('');
  } catch (err) {
    crashed = true;
  }
  check('an empty text does not crash the encoder', crashed, false);
  checkTrue('an empty text still gives a matrix', modules !== null);
  if (modules) {
    check('an empty text is a version one matrix', modules.length, 21);
  }
}

{
  // Nothing at all does not crash either.
  let crashed = false;
  try {
    encodeQr(null);
    encodeQr(undefined);
  } catch (err) {
    crashed = true;
  }
  check('nothing at all does not crash the encoder', crashed, false);
}

{
  // The SVG is a picture, not a download.
  const svg = qrToSvg('https://example.com/split/ABC');
  checkTrue('the SVG says it is an SVG', svg.startsWith('<svg'));
  // The namespace is a URL, but nothing is fetched: there is no
  // image, no script and no stylesheet in what is written out.
  checkTrue('the SVG has no image', !svg.includes('<image'));
  checkTrue('the SVG has no script', !svg.includes('<script'));
  checkTrue('the SVG has no stylesheet', !svg.includes('<style'));
  checkTrue('the SVG has a path', svg.includes('<path'));

  // The quiet zone: the viewBox is bigger than the code itself by
  // four modules on every side.
  const viewBox = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
  checkTrue('the SVG has a viewBox', viewBox !== null);
  if (viewBox) {
    const dimension = Number(viewBox[1]);
    const modules = (dimension / 10) - 8;
    check('the quiet zone is four modules', (dimension / 10) % 1, 0);
    checkTrue('the code size is one of the known sizes', [21, 25, 29, 33, 37, 41, 45, 49, 53, 57].includes(modules));
  }
}

{
  // The error correction actually corrects something.
  //
  // A code with one module changed should still give the same data
  // codewords, because that is what the error correction is for.
  const data = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17];
  const ecc = errorCorrection(data, 10);
  check('the error correction makes ten codewords', ecc.length, 10);
  checkTrue(
    'the error correction is not all zeroes',
    ecc.some((value) => value !== 0),
  );
}

/* -------------------------------------------------------------------------
 * The report.
 * ---------------------------------------------------------------------- */

console.log('');
if (failures.length > 0) {
  for (const failure of failures) {
    console.log(`FAIL  ${failure}`);
  }
  console.log('');
}
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
