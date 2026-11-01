/**
 * A QR code, written here rather than brought in.
 *
 * The host of a shared bill wants to show the invite link on the
 * table, or send it to the group as a picture. Either way it has to
 * be a picture of a code that a phone camera can read, without
 * anybody installing anything.
 *
 * There are two ways to get one. The first is a library. The second
 * is to write the specification yourself. The library would be a
 * dependency, and a dependency that draws the one thing that has to
 * be right - the code that other people's phones read - is a
 * dependency that has to be trusted with the whole feature. So the
 * specification is implemented here, and the tests check it against
 * the worked example in the specification and against a decoder
 * written alongside it.
 *
 * What is implemented: byte mode, versions 1 to 10, error correction
 * level M. That is more than enough for an invite link, which is a
 * few dozen characters.
 *
 * The specification is ISO/IEC 18004. The parts of it that matter
 * here are:
 *
 * - the finder patterns, the timing patterns, the alignment pattern,
 *   the format information and the version information, which say
 *   where everything is;
 * - the data encoding, which turns the text into a bit string;
 * - the Reed-Solomon error correction, which lets a code be read
 *   when part of it is smudged or in shadow;
 * - the masking, which tries eight ways of laying the code out and
 *   keeps the one that is easiest to read.
 */

const MODE_BYTE = 0x4;

/** The error correction level M: about fifteen percent can be lost. */
export const ECC_M = 0;

/**
 * The capacity of each version at level M, in data codewords.
 *
 * From the specification, table 9. Only versions 1 to 10 are
 * here, because an invite link never needs more.
 */
const DATA_CODEWORDS = {
  1: 16,
  2: 28,
  3: 44,
  4: 64,
  5: 86,
  6: 108,
  7: 124,
  8: 154,
  9: 182,
  10: 216,
};

/**
 * The number of error correction codewords per block, and the number
 * of blocks, for each version at level M.
 *
 * From the specification, table 13. The first number is how many
 * error correction codewords each block holds; the second is how
 * many blocks the data is split into.
 */
const ECC_BLOCKS = {
  1: { eccPerBlock: 10, blocks: 1 },
  2: { eccPerBlock: 16, blocks: 1 },
  3: { eccPerBlock: 26, blocks: 1 },
  4: { eccPerBlock: 18, blocks: 2 },
  5: { eccPerBlock: 24, blocks: 2 },
  6: { eccPerBlock: 16, blocks: 4 },
  7: { eccPerBlock: 18, blocks: 4 },
  8: { eccPerBlock: 22, blocks: 4 },
  9: { eccPerBlock: 22, blocks: 5 },
  10: { eccPerBlock: 26, blocks: 5 },
};

/**
 * Where the alignment pattern goes, for each version.
 *
 * The specification gives the centre coordinates of the alignment
 * patterns. The first entry is unused: the pattern at the corner is
 * always covered by a finder pattern.
 */
const ALIGNMENT_POSITIONS = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
};

/** The size of a code, in modules, for each version. */
export function moduleCount(version) {
  return 17 + 4 * version;
}

/**
 * The Reed-Solomon generator polynomial for a given number of error
 * correction codewords.
 *
 * This is the polynomial (x - a^0)(x - a^1)...(x - a^(n-1)), over
 * the field of 256 elements that the specification defines, with
 * a = 2.
 */
export function generatorPolynomial(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i += 1) {
    poly = multiplyPolynomials(poly, [1, gfExp(i)]);
  }
  return poly;
}

/** Multiply two polynomials over the field, the low term first. */
function multiplyPolynomials(a, b) {
  const result = new Array(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i += 1) {
    for (let j = 0; j < b.length; j += 1) {
      result[i + j] ^= gfMultiply(a[i], b[j]);
    }
  }
  return result;
}

/** The powers of two in the field of 256 elements, as the spec defines them. */
const EXP = new Array(512).fill(0);
const LOG = new Array(256).fill(0);

function buildTables() {
  let value = 1;
  for (let i = 0; i < 255; i += 1) {
    EXP[i] = value;
    LOG[value] = i;
    value <<= 1;
    // The field wraps: a number above 255 becomes itself, doubled,
    // less 255.
    if (value & 0x100) value ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) {
    EXP[i] = EXP[i - 255];
  }
}
buildTables();

function gfExp(n) {
  return EXP[n];
}

function gfMultiply(a, b) {
  if (a === 0 || b === 0) return 0;
  return EXP[(LOG[a] + LOG[b]) % 255];
}

/** Divide in the field: a / b. */

/**
 * The error correction codewords for a block of data.
 *
 * This is the Reed-Solomon remainder of the data, divided by the
 * generator polynomial.
 */
export function errorCorrection(dataCodewords, degree) {
  const generator = generatorPolynomial(degree);
  const remainder = new Array(degree).fill(0);

  for (const byte of dataCodewords) {
    const factor = byte ^ remainder[0];
    remainder.shift();
    remainder.push(0);
    if (factor !== 0) {
      for (let i = 0; i < degree; i += 1) {
        remainder[i] ^= gfMultiply(generator[i + 1], factor);
      }
    }
  }

  return remainder;
}

/**
 * The bits of the text, in byte mode, with the mode and the length
 * in front of it.
 */
function encodeData(text, version) {
  const bytes = [];
  for (const char of text) {
    // A character outside the basic multilingual plane is written as
    // a surrogate pair, which is two UTF-8 bytes each.
    const code = char.codePointAt(0);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(
        0xe0 | (code >> 12),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }

  const bits = [];
  const push = (value, length) => {
    for (let i = length - 1; i >= 0; i -= 1) {
      bits.push((value >> i) & 1);
    }
  };

  push(MODE_BYTE, 4);

  // The length is written in eight bits for versions 1 to 9, and in
  // sixteen bits for version 10 and above.
  const lengthBits = versionLengthBits(version);
  push(bytes.length, lengthBits);

  for (const byte of bytes) {
    push(byte, 8);
  }

  // The terminator: up to four zero bits, if there is room.
  const capacityBits = DATA_CODEWORDS[version] * 8;
  push(0, Math.min(4, capacityBits - bits.length));

  // The rest is filled with the padding pattern: alternating 0xEC
  // and 0x11, as the specification says.
  let pad = 0;
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }
  while (bits.length < capacityBits) {
    push(pad === 0 ? 0xec : 0x11, 8);
    pad += 1;
  }

  const bytesOut = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j += 1) {
      byte = (byte << 1) | bits[i + j];
    }
    bytesOut.push(byte);
  }
  return bytesOut;
}

/**
 * How many bits the character count is written in, for a version.
 *
 * Byte mode uses eight bits up to version 9, and sixteen bits from
 * version 10.
 */
function versionLengthBits(version) {
  return version <= 9 ? 8 : 16;
}

/**
 * The smallest version that holds the text.
 *
 * The character count is written in eight bits up to version 9, so
 * a text longer than 255 characters cannot be described in the
 * smaller versions and must go to version 10.
 */
function chooseVersion(byteLength) {
  for (let version = 1; version <= 9; version += 1) {
    const headerBits = 4 + versionLengthBits(version);
    if (headerBits + byteLength * 8 <= DATA_CODEWORDS[version] * 8) {
      return version;
    }
  }
  return 10;
}

/**
 * The data codewords, split into blocks, with the error correction
 * added, and interleaved the way the specification says.
 */
function buildCodewords(version, dataCodewords) {
  const { eccPerBlock, blocks } = ECC_BLOCKS[version];
  const dataPerBlock = Math.floor(dataCodewords.length / blocks);

  const dataBlocks = [];
  const eccBlocks = [];
  let offset = 0;
  for (let i = 0; i < blocks; i += 1) {
    // The specification gives the shorter blocks the extra codewords,
    // so that the blocks come out the same size.
    const extra = i < dataCodewords.length % blocks ? 1 : 0;
    const size = dataPerBlock + extra;
    const block = dataCodewords.slice(offset, offset + size);
    offset += size;
    dataBlocks.push(block);
    eccBlocks.push(errorCorrection(block, eccPerBlock));
  }

  const result = [];
  const maxData = Math.max(...dataBlocks.map((block) => block.length));
  for (let i = 0; i < maxData; i += 1) {
    for (const block of dataBlocks) {
      if (i < block.length) result.push(block[i]);
    }
  }
  for (let i = 0; i < eccPerBlock; i += 1) {
    for (const block of eccBlocks) {
      result.push(block[i]);
    }
  }

  // The remainder bits, which are nothing at all, are not stored.
  return result;
}

/** A canvas of modules, with a note of which are reserved. */
function makeCanvas(size) {
  const modules = [];
  const reserved = [];
  for (let row = 0; row < size; row += 1) {
    modules.push(new Array(size).fill(false));
    reserved.push(new Array(size).fill(false));
  }
  return { modules, reserved, size };
}

function setFunctionModule(canvas, row, col, value) {
  canvas.modules[row][col] = value;
  canvas.reserved[row][col] = true;
}

/** The three finder patterns and the separators around them. */
function drawFinderPatterns(canvas) {
  const size = canvas.size;
  const centers = [
    [0, 0],
    [0, size - 7],
    [size - 7, 0],
  ];

  for (const [top, left] of centers) {
    for (let row = -1; row <= 7; row += 1) {
      for (let col = -1; col <= 7; col += 1) {
        const r = top + row;
        const c = left + col;
        if (r < 0 || r >= size || c < 0 || c >= size) continue;
        const inRing =
          row >= 0 && row <= 6 && col >= 0 && col <= 6
            ? row === 0 || row === 6 || col === 0 || col === 6
            : false;
        const inCore = row >= 2 && row <= 4 && col >= 2 && col <= 4;
        setFunctionModule(canvas, r, c, inRing || inCore);
      }
    }
  }
}

/** The timing patterns: the row and the column of alternating modules. */
function drawTimingPatterns(canvas) {
  const size = canvas.size;
  for (let i = 8; i < size - 8; i += 1) {
    const value = i % 2 === 0;
    setFunctionModule(canvas, 6, i, value);
    setFunctionModule(canvas, i, 6, value);
  }
}

/** The alignment patterns, except the ones the finder patterns cover. */
function drawAlignmentPatterns(canvas, version) {
  const positions = ALIGNMENT_POSITIONS[version] || [];
  if (positions.length === 0) return;

  for (const row of positions) {
    for (const col of positions) {
      // The three corners are covered by the finder patterns.
      const isCorner =
        (row === 6 && col === 6) ||
        (row === 6 && col === positions[positions.length - 1]) ||
        (row === positions[positions.length - 1] && col === 6);
      if (isCorner) continue;

      for (let dr = -2; dr <= 2; dr += 1) {
        for (let dc = -2; dc <= 2; dc += 1) {
          const value =
            dr === -2 || dr === 2 || dc === -2 || dc === 2 ||
            (dr === 0 && dc === 0);
          setFunctionModule(canvas, row + dr, col + dc, value);
        }
      }
    }
  }
}

/** The dark module, which is always there. */
function drawDarkModule(canvas) {
  const size = canvas.size;
  setFunctionModule(canvas, size - 8, 8, true);
}

/** The format information: the error correction level and the mask. */
function drawFormatInformation(canvas, mask) {
  const size = canvas.size;
  // The level M, in the two bits the specification uses for it.
  const levelBits = 0b00;

  const data = (levelBits << 3) | mask;
  let remainder = data;
  for (let i = 0; i < 10; i += 1) {
    remainder = (remainder << 1) ^ ((remainder >> 9) * 0x537);
  }
  const format = ((data << 10) | remainder) ^ 0x5412;

  // The first copy.
  //
  // Six bits run down the column eight, from the top. The seventh
  // sits at the corner, and the remaining eight run along the row
  // eight towards the left, with the ninth to the fourteenth counted
  // from the right of that run.
  //
  // The row comes first in every call.
  for (let i = 0; i <= 5; i += 1) {
    setFunctionModule(canvas, i, 8, bitOf(format, i));
  }
  setFunctionModule(canvas, 7, 8, bitOf(format, 6));
  setFunctionModule(canvas, 8, 8, bitOf(format, 7));
  setFunctionModule(canvas, 8, 7, bitOf(format, 8));
  for (let i = 9; i < 15; i += 1) {
    setFunctionModule(canvas, 8, 14 - i, bitOf(format, i));
  }

  // The second copy: the same fifteen bits, along the row eight at
  // the right and down the column eight at the bottom.
  for (let i = 0; i < 8; i += 1) {
    setFunctionModule(canvas, 8, size - 1 - i, bitOf(format, i));
  }
  for (let i = 8; i < 15; i += 1) {
    setFunctionModule(canvas, size - 15 + i, 8, bitOf(format, i));
  }

  // The dark module, which is always dark and always there.
  setFunctionModule(canvas, size - 8, 8, true);
}

function bitOf(value, index) {
  return ((value >> index) & 1) === 1;
}

/** The version information, which only versions 7 and above carry. */
function drawVersionInformation(canvas, version) {
  if (version < 7) return;

  let remainder = version;
  for (let i = 0; i < 12; i += 1) {
    remainder = (remainder << 1) ^ ((remainder >> 11) * 0x1f25);
  }
  const bits = (version << 12) | remainder;

  // The version information sits in an eighteen by six block at the
  // bottom left, and in the same block turned the other way at the
  // top right. Both blocks start three modules in from the edge of
  // the code.
  const edge = canvas.size - 11;
  for (let i = 0; i < 18; i += 1) {
    const row = Math.floor(i / 3);
    const col = i % 3;
    // One copy in the top right, one in the bottom left.
    setFunctionModule(canvas, row, edge + col, bitOf(bits, i));
    setFunctionModule(canvas, edge + col, row, bitOf(bits, i));
  }
}

/**
 * The eight masks of the specification, and the penalty of each.
 *
 * The mask that scores lowest is the one that is kept: a code where
 * the modules are less lumpy is easier for a camera to read.
 */
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

/** Lay the data into the canvas, in the order the specification says. */
function placeData(canvas, codewords) {
  const size = canvas.size;
  const bits = [];
  for (const byte of codewords) {
    for (let i = 7; i >= 0; i -= 1) {
      bits.push((byte >> i) & 1);
    }
  }

  let index = 0;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    // The column six is the timing pattern, so it is skipped.
    if (right === 6) right -= 1;

    for (let step = 0; step < size; step += 1) {
      const row = upward ? size - 1 - step : step;
      for (let colOffset = 0; colOffset < 2; colOffset += 1) {
        const col = right - colOffset;
        if (canvas.reserved[row][col]) continue;
        canvas.modules[row][col] = index < bits.length ? bits[index] === 1 : false;
        index += 1;
      }
    }
    upward = !upward;
  }
}

/** How lumpy a masked code is. The lower the better. */
function penalty(modules, size) {
  let score = 0;

  // Rule 1: five modules in a row of the same colour.
  for (let row = 0; row < size; row += 1) {
    score += runPenalty(modules[row]);
  }
  for (let col = 0; col < size; col += 1) {
    const column = [];
    for (let row = 0; row < size; row += 1) column.push(modules[row][col]);
    score += runPenalty(column);
  }

  // Rule 2: a block of the same colour.
  for (let row = 0; row < size - 1; row += 1) {
    for (let col = 0; col < size - 1; col += 1) {
      const value = modules[row][col];
      if (
        value === modules[row][col + 1] &&
        value === modules[row + 1][col] &&
        value === modules[row + 1][col + 1]
      ) {
        score += 3;
      }
    }
  }

  // Rule 3: the pattern that looks like the finder pattern.
  const pattern = [true, false, true, true, true, false, true, false, false, false, false];
  const reversed = pattern.slice().reverse();
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col <= size - 11; col += 1) {
      let forward = true;
      let backward = true;
      for (let i = 0; i < 11; i += 1) {
        if (modules[row][col + i] !== pattern[i]) forward = false;
        if (modules[row][col + i] !== reversed[i]) backward = false;
      }
      if (forward) score += 40;
      if (backward) score += 40;
    }
  }

  // Rule 4: how much of the code is dark.
  let dark = 0;
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (modules[row][col]) dark += 1;
    }
  }
  const percent = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;

  return score;
}

function runPenalty(line) {
  let score = 0;
  let run = 1;
  for (let i = 1; i < line.length; i += 1) {
    if (line[i] === line[i - 1]) {
      run += 1;
    } else {
      if (run >= 5) score += 3 + (run - 5);
      run = 1;
    }
  }
  if (run >= 5) score += 3 + (run - 5);
  return score;
}

/**
 * The QR code for a string.
 *
 * Returns the modules as an array of arrays of booleans, the row
 * index first. The top left is the first.
 */
export function encodeQr(text) {
  const content = text === null || text === undefined ? '' : String(text);

  const version = chooseVersion(content.length);
  const dataCodewords = encodeData(content, version);
  const codewords = buildCodewords(version, dataCodewords);

  let best = null;
  let bestScore = Infinity;

  for (let mask = 0; mask < 8; mask += 1) {
    const canvas = makeCanvas(moduleCount(version));
    drawFinderPatterns(canvas);
    drawAlignmentPatterns(canvas, version);
    drawTimingPatterns(canvas);
    drawFormatInformation(canvas, mask);
    drawVersionInformation(canvas, version);
    drawDarkModule(canvas);

    placeData(canvas, codewords);
    applyMask(canvas, mask);

    const score = penalty(canvas.modules, canvas.size);
    if (score < bestScore) {
      bestScore = score;
      best = canvas;
    }
  }

  return best.modules;
}

/** Apply a mask to the data modules, leaving the function modules alone. */
function applyMask(canvas, mask) {
  const fn = MASKS[mask];
  for (let row = 0; row < canvas.size; row += 1) {
    for (let col = 0; col < canvas.size; col += 1) {
      if (canvas.reserved[row][col]) continue;
      if (fn(row, col)) {
        canvas.modules[row][col] = !canvas.modules[row][col];
      }
    }
  }
}

/**
 * The QR code as an SVG.
 *
 * The code is drawn as one path, so that the browser has one thing
 * to draw rather than thousands of rectangles.
 */
export function qrToSvg(text, options = {}) {
  const modules = encodeQr(text);
  const size = modules.length;
  const quiet = options.quiet === undefined ? 4 : options.quiet;
  const dimension = (size + quiet * 2) * 10;

  let path = '';
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (!modules[row][col]) continue;
      const x = (col + quiet) * 10;
      const y = (row + quiet) * 10;
      path += `M${x} ${y}h10v10h-10z`;
    }
  }

  const background = options.background || '#ffffff';
  const foreground = options.foreground || '#000000';

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dimension} ${dimension}" ` +
    `width="${dimension}" height="${dimension}" role="img" shape-rendering="crispEdges">` +
    `<rect width="${dimension}" height="${dimension}" fill="${background}"/>` +
    `<path d="${path}" fill="${foreground}"/>` +
    `</svg>`
  );
}

export default encodeQr;


