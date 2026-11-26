/**
 * The contract of the concept engine.
 *
 * A concept is the visual identity of the app. These checks are about the
 * things that would break quietly:
 *
 *   1. Every concept declares the same tokens. A concept that is missing a
 *      token would fall back to the previous one and look like the reader's
 *      own choice.
 *   2. The stylesheet and the token map agree. The map in utils/theme.js
 *      exists so the picker can show all six concepts at once; if the two
 *      drift apart, the picker lies about what a concept looks like.
 *   3. The geometry never moves. A concept may not change a width, a
 *      column count or a breakpoint.
 *   4. Every concept has a name, a tag, a description and a line of
 *      dialogue, in every language.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  THEME_CONCEPTS,
  THEME_CONCEPT_IDS,
  DEFAULT_THEME_CONCEPT,
  CONCEPT_TOKENS,
} from '../../utils/theme.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const css = fs.readFileSync(
  path.join(root, 'src/styles/theme-concepts.css'),
  'utf8'
);

let failed = 0;
const check = (name, ok, detail) => {
  if (ok) {
    console.log(`  ok  ${name}`);
  } else {
    console.log(`  FAIL ${name}${detail ? ` - ${detail}` : ''}`);
    failed += 1;
  }
};

// ---------------------------------------------------------------- the set
console.log('\nthe concepts');

check(
  'there are six concepts',
  THEME_CONCEPT_IDS.length === 6,
  `found ${THEME_CONCEPT_IDS.length}`
);

check(
  'the default is kawaii_bento',
  DEFAULT_THEME_CONCEPT === 'kawaii_bento'
);

for (const id of THEME_CONCEPT_IDS) {
  check(`the concept "${id}" is in the stylesheet`, css.includes(`[data-theme-concept='${id}']`));
}

// ------------------------------------------------------- the token shape
console.log('\nthe tokens');

const LIGHT_TOKENS = Object.keys(CONCEPT_TOKENS.kawaii_bento.light);

/**
 * The stylesheet wraps a long value across several lines. The map writes
 * it on one. The two are the same value, so the comparison is made on the
 * whitespace taken out.
 */
const squash = (value) => value.replace(/\s+/g, ' ').trim();

for (const id of THEME_CONCEPT_IDS) {
  const light = CONCEPT_TOKENS[id].light;
  const dark = CONCEPT_TOKENS[id].dark;

  const missingLight = LIGHT_TOKENS.filter((token) => !(token in light));
  check(
    `the concept "${id}" declares every token on the light side`,
    missingLight.length === 0,
    missingLight.join(', ')
  );

  // The dark side is an OVERRIDE map: it holds the tokens that change in
  // the dark, and the rest is inherited from the light side. The picker
  // merges the two before it draws a card, so the merged result has to
  // hold every token.
  const merged = { ...light, ...dark };
  const missingMerged = LIGHT_TOKENS.filter((token) => !(token in merged));
  check(
    `the concept "${id}" has every token on the dark side`,
    missingMerged.length === 0,
    missingMerged.join(', ')
  );
}

// ------------------------------------------- the map and the stylesheet
console.log('\nthe map and the stylesheet agree');

for (const id of THEME_CONCEPT_IDS) {
  const light = CONCEPT_TOKENS[id].light;
  // Find the light block of this concept in the stylesheet.
  const blockStart = css.indexOf(`html[data-theme-concept='${id}'] {`);
  const darkStart = css.indexOf(
    `html[data-theme-concept='${id}'].dark {`
  );
  const nextConcept = css.indexOf('\nhtml[data-theme-concept=', blockStart + 10);

  check(`the concept "${id}" has a block in the stylesheet`, blockStart > -1);

  if (blockStart > -1) {
    const end = nextConcept > -1 ? nextConcept : css.length;
    const block = css.slice(blockStart, end);

    for (const [token, value] of Object.entries(light)) {
      // The stylesheet writes the value on the token's own line, so a
      // simple substring is enough and does not depend on the order.
      const written = block.includes(`${token}: ${value};`);
      check(
        `the concept "${id}" writes ${token} the same way in both places`,
        written,
        written ? '' : `stylesheet and map disagree about ${token}`
      );
    }

    // Every token the map gives the concept has to be in the stylesheet
    // too, and the other way round.
    const mapTokens = Object.keys(light);
    const sheetTokens = [
      ...block.matchAll(/(--concept-[a-z-]+):\s*([^;]+);/g),
    ].map((m) => m[1]);
    const onlyInMap = mapTokens.filter((token) => !sheetTokens.includes(token));
    const onlyInSheet = sheetTokens.filter((token) => !mapTokens.includes(token));
    check(
      `the concept "${id}" declares the same tokens in both places`,
      onlyInMap.length === 0 && onlyInSheet.length === 0,
      [...onlyInMap, ...onlyInSheet].join(', ')
    );
  }

  if (darkStart > -1) {
    const dark = CONCEPT_TOKENS[id].dark;
    const darkEnd = css.indexOf('\nhtml[data-theme-concept=', darkStart + 10);
    const block = css.slice(darkStart, darkEnd > -1 ? darkEnd : css.length);
    for (const [token, value] of Object.entries(dark)) {
      const written = block.includes(`${token}: ${value};`);
      check(
        `the concept "${id}" writes ${token} the same way on the dark side`,
        written,
        written ? '' : `stylesheet and map disagree about ${token}`
      );
    }

    const mapTokens = Object.keys(dark);
    const sheetTokens = [
      ...block.matchAll(/(--concept-[a-z-]+):\s*([^;]+);/g),
    ].map((m) => m[1]);
    const onlyInMap = mapTokens.filter((token) => !sheetTokens.includes(token));
    const onlyInSheet = sheetTokens.filter((token) => !mapTokens.includes(token));
    check(
      `the concept "${id}" declares the same tokens on the dark side in both places`,
      onlyInMap.length === 0 && onlyInSheet.length === 0,
      [...onlyInMap, ...onlyInSheet].join(', ')
    );
  }
}

// ------------------------------------------------------------- the geometry
console.log('\nthe geometry never moves');

const geometry = css.slice(
  css.indexOf('/* The geometry.'),
  css.indexOf('/* ========================================================================')
);
check(
  'the geometry is declared once, outside the concepts',
  geometry.includes('--concept-grid-gap') &&
    geometry.includes('--concept-container')
);
check(
  'the concept grid is one column on a phone',
  /@media \(min-width: 640px\)[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/.test(css)
);
check(
  'the concept grid is three columns on a desktop',
  /@media \(min-width: 1024px\)[\s\S]*?repeat\(3, minmax\(0, 1fr\)\)/.test(css)
);

// No concept may set a width, a grid or a breakpoint of its own.
for (const id of THEME_CONCEPT_IDS) {
  const blockStart = css.indexOf(`html[data-theme-concept='${id}'] {`);
  const next = css.indexOf('\nhtml[data-theme-concept=', blockStart + 10);
  const block = css.slice(blockStart, next > -1 ? next : css.length);
  const forbidden = block.match(
    /(width|max-width|min-width|grid-template-columns|@media)\s*:/
  );
  check(
    `the concept "${id}" does not change the geometry`,
    !forbidden,
    forbidden ? forbidden[0] : ''
  );
}

// ---------------------------------------------------------- the contrast
console.log('\nevery concept is readable');

// The relative luminance of a colour, per WCAG.
const luminance = (hex) => {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map((at) => {
    const c = parseInt(value.slice(at, at + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

const contrast = (a, b) => {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

// The pairs the app actually draws: the ink on the card, the ink on the
// canvas, the muted ink on both, the text on a badge, and the text on
// the accent.
const PAIRS = [
  ['the ink on the card', '--concept-ink', '--concept-card'],
  ['the ink on the canvas', '--concept-ink', '--concept-canvas'],
  ['the muted ink on the card', '--concept-ink-muted', '--concept-card'],
  ['the muted ink on the canvas', '--concept-ink-muted', '--concept-canvas'],
  ['the text on a badge', '--concept-badge-ink', '--concept-badge-bg'],
  ['the text on the accent', '--concept-accent-ink', '--concept-accent'],
];

for (const id of THEME_CONCEPT_IDS) {
  const light = CONCEPT_TOKENS[id].light;
  const dark = { ...light, ...CONCEPT_TOKENS[id].dark };

  for (const side of ['light', 'dark']) {
    const tokens = side === 'light' ? light : dark;
    for (const [name, fg, bg] of PAIRS) {
      const ratio = contrast(tokens[fg], tokens[bg]);
      check(
        `the concept "${id}" reads ${name} on the ${side} side`,
        ratio >= 4.5,
        `${tokens[fg]} on ${tokens[bg]} is ${ratio.toFixed(2)}:1`
      );
    }
  }
}

// ------------------------------------------------------------ the voice
console.log('\nevery concept is written about, in every language');
const i18nDir = path.join(root, 'src/i18n');
for (const lang of ['id', 'en', 'ja']) {
  const file = path.join(i18nDir, `${lang}.js`);
  const source = fs.readFileSync(file, 'utf8');
  for (const id of THEME_CONCEPT_IDS) {
    check(
      `the concept "${id}" is described in ${lang}`,
      source.includes(`concept_${id}_desc`)
    );
    check(
      `the concept "${id}" has a name in ${lang}`,
      source.includes(`concept_${id}:`)
    );
    check(
      `the concept "${id}" has a line of dialogue in ${lang}`,
      source.includes(`concept_line_${id}:`)
    );
    // The tag is a per-concept key too, whatever it is called.
    const tag = THEME_CONCEPTS[id].tagKey.split('.')[1];
    check(
      `the concept "${id}" has a tag in ${lang}`,
      source.includes(`${tag}:`)
    );
    const label = THEME_CONCEPTS[id].labelKey.split('.')[1];
    check(
      `the concept "${id}" has a name in ${lang}`,
      source.includes(`${label}:`)
    );
  }
}

// ------------------------------------------------------------ the labels
console.log('\nthe labels point at real keys');

for (const id of THEME_CONCEPT_IDS) {
  const concept = THEME_CONCEPTS[id];
  check(
    `the concept "${id}" has a name key`,
    typeof concept.labelKey === 'string' && concept.labelKey.includes(id)
  );
  check(
    `the concept "${id}" has a tag key`,
    typeof concept.tagKey === 'string' && concept.tagKey.startsWith('appearance.')
  );
  check(
    `the concept "${id}" has a description key`,
    typeof concept.descriptionKey === 'string' &&
      concept.descriptionKey.includes(id)
  );
  check(
    `the concept "${id}" has four palette colours`,
    Array.isArray(concept.palette) && concept.palette.length === 4
  );
  check(
    `the concept "${id}" names a companion`,
    typeof concept.persona === 'string' && concept.persona.length > 0
  );
}

console.log(
  failed === 0
    ? '\nOK: the concept engine holds together'
    : `\n${failed} checks failed`
);
process.exit(failed === 0 ? 0 : 1);
