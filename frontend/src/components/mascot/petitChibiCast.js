/**
 * The Petit Chibi Guild.
 *
 * Six companions, one per kind of money question, each with a name
 * that is a small joke about what they are for: Mone sounds like
 * "money" and is written with the character for a sprout, Kaneru puts
 * the character for gold next to the verb for playing a melody,
 * Zenimaru is a small coin with the affectionate suffix a boy's name
 * takes. A reader who reads Japanese gets the joke; a reader who does
 * not still gets a character with a job.
 *
 * This file is the registry and nothing else. It holds who they are -
 * name, kanji, the meaning behind it, the palette, the prop they
 * carry, the pages they belong to - and no drawing code at all. The
 * drawing reads from here, so a seventh character is a new entry in
 * this table rather than a new branch in a renderer.
 *
 * The bios are written out in all three languages rather than keyed
 * into the i18n files, because they belong to the character: a
 * translator who changes "wealth that keeps growing" is changing what
 * Mone is, not fixing a label.
 */

/** The companion a reader gets before they have chosen one. */
export const DEFAULT_PETIT_PERSONA = 'mone';

/**
 * The six of them.
 *
 * `pages` is where each one is the specialist. A reader who has not
 * picked a favourite is handed whoever belongs to the page they are
 * on, which is why the shapes of the entries matter more than the
 * order.
 */
export const PETIT_CHIBI_CAST = Object.freeze({
  mone: Object.freeze({
    id: 'mone',
    name: 'Mone',
    kanji: '萌音',
    gender: 'female',
    vibe: 'modern, cheerful, aesthetic',
    // Mo (萌) is a sprout putting out its first leaves; ne (音) is a
    // sound. Money that is growing, and that you can hear growing.
    meaning: Object.freeze({
      id: 'Bunyinya seperti "money". 萌 (tunas) + 音 (bunyi) — kekayaan yang terus bertumbuh.',
      en: 'It sounds like "money". 萌 (a sprout) + 音 (a sound) — wealth that keeps growing.',
      ja: '「マネー」の響き。萌（芽ばえ）＋音＝育ちつづけるお金。',
    }),
    tagline: Object.freeze({
      id: 'Keuangan yang terus bertumbuh',
      en: 'Finances that keep growing',
      ja: '育ちつづける家計',
    }),
    bio: Object.freeze({
      id: 'Mone mencatat hal kecil setiap hari, karena tunas tumbuh dari yang kecil.',
      en: 'Mone records the small things daily, because a sprout grows from small things.',
      ja: '毎日の小さな記録から。芽は小さなところから育ちます。',
    }),
    palette: Object.freeze({
      hairDark: '#6E473B',
      hairLight: '#9E6B55',
      highlight: '#FFF8E7',
      irisTop: '#4A2E35',
      irisMid: '#9E6B55',
      irisBottom: '#F3D19C',
      cloth: '#FCE8E6',
      clothAlt: '#FFFDF9',
      accent: '#66BB6A',
      ribbon: '#F4A6A0',
      skin: '#FBE6DA',
      cheek: '#F7B2AD',
    }),
    hair: 'twin_locks_hat',
    prop: 'konpeito_bottle',
    pages: Object.freeze(['/', '/login', '/register']),
  }),

  kaneru: Object.freeze({
    id: 'kaneru',
    name: 'Kaneru',
    kanji: '奏る',
    gender: 'male',
    vibe: 'gentle, musical, neat',
    meaning: Object.freeze({
      id: '金 (uang) + 奏でる (memainkan melodi) — keuangan yang selaras dan seimbang.',
      en: '金 (money) + 奏でる (to play a melody) — finances in balance, playing in tune.',
      ja: '金＋奏でる。釣り合いのとれた、調和した家計。',
    }),
    tagline: Object.freeze({
      id: 'Anggaran yang selaras',
      en: 'A budget in tune',
      ja: '調和のとれた予算',
    }),
    bio: Object.freeze({
      id: 'Kaneru menata anggaran seperti menata nada: tidak ada yang terlalu keras.',
      en: 'Kaneru arranges a budget like notes: nothing too loud.',
      ja: '予算を音のように並べます。どれも大きすぎないように。',
    }),
    palette: Object.freeze({
      hairDark: '#6D5448',
      hairLight: '#CFC7B5',
      highlight: '#FFF8E7',
      irisTop: '#2F4842',
      irisMid: '#6B9E88',
      irisBottom: '#A8E6CF',
      cloth: '#EFECE6',
      clothAlt: '#FFFDF9',
      accent: '#52796F',
      ribbon: '#52796F',
      skin: '#FBE6DA',
      cheek: '#F7B2AD',
    }),
    hair: 'fluffy_bangs',
    prop: 'kakeibo_melody',
    pages: Object.freeze(['/budgets', '/analytics']),
  }),

  kogane: Object.freeze({
    id: 'kogane',
    name: 'Kogane',
    kanji: '黄金',
    gender: 'female',
    vibe: 'classic, warm, classy',
    meaning: Object.freeze({
      id: 'Berarti "emas murni" — aset berharga dan kekayaan jangka panjang.',
      en: 'It means "pure gold" — precious assets and long-term wealth.',
      ja: '「黄金」。大切な資産と、長い目で見た豊かさ。',
    }),
    tagline: Object.freeze({
      id: 'Aset yang dijaga lama',
      en: 'Assets kept for the long run',
      ja: '長く守る資産',
    }),
    bio: Object.freeze({
      id: 'Kogane menghitung yang sudah dimiliki, bukan yang ingin dibeli.',
      en: 'Kogane counts what is already owned, not what is wanted.',
      ja: 'すでに持っているものを数えます。欲しいものではなく。',
    }),
    palette: Object.freeze({
      hairDark: '#B8864B',
      hairLight: '#F5DEB3',
      highlight: '#FFFDF5',
      irisTop: '#5C3A21',
      irisMid: '#C9A227',
      irisBottom: '#FFD54F',
      cloth: '#FFFDF5',
      clothAlt: '#FFFFFF',
      accent: '#E6B84D',
      ribbon: '#E6B84D',
      skin: '#FBE6DA',
      cheek: '#F7B2AD',
    }),
    hair: 'twin_tails_bows',
    prop: 'golden_watch',
    pages: Object.freeze(['/accounts', '/market', '/calculators']),
  }),

  zenimaru: Object.freeze({
    id: 'zenimaru',
    name: 'Zenimaru',
    kanji: '銭丸',
    gender: 'male',
    vibe: 'cute, diligent, merchant apprentice',
    meaning: Object.freeze({
      id: '銭 (uang receh) + 丸 (akhiran nama anak laki-laki) — tiap receh ada artinya.',
      en: '銭 (small change) + 丸 (the suffix a boy\u2019s name takes) — every small coin counts.',
      ja: '銭＋丸。小さな一枚も、ちゃんと数に入ります。',
    }),
    tagline: Object.freeze({
      id: 'Tiap receh dihitung',
      en: 'Every coin counted',
      ja: '一枚ずつ、きちんと',
    }),
    bio: Object.freeze({
      id: 'Zenimaru mencatat yang receh, karena yang receh yang paling sering hilang.',
      en: 'Zenimaru records the small change, because small change is what goes missing.',
      ja: '小銭を記録します。いちばん消えやすいのが小銭だから。',
    }),
    palette: Object.freeze({
      hairDark: '#3E2723',
      hairLight: '#6D4C41',
      highlight: '#FFF8E7',
      irisTop: '#8D493A',
      irisMid: '#D08C60',
      irisBottom: '#F4A261',
      cloth: '#E3F2EA',
      clothAlt: '#D6E6F2',
      accent: '#D6E6F2',
      ribbon: '#8D493A',
      skin: '#FBE6DA',
      cheek: '#F7B2AD',
    }),
    hair: 'short_spikes_band',
    prop: 'lucky_coin',
    pages: Object.freeze(['/transactions', '/feed']),
  }),

  minori: Object.freeze({
    id: 'minori',
    name: 'Minori',
    kanji: '実り',
    gender: 'female',
    vibe: 'calm, mature, healing',
    meaning: Object.freeze({
      id: 'Berarti "panen yang matang" — target tabungan dan investasi yang tercapai.',
      en: 'It means "a ripened harvest" — savings and goals that came good.',
      ja: '「実り」。目標や投資が、ちゃんと実ること。',
    }),
    tagline: Object.freeze({
      id: 'Target yang akhirnya matang',
      en: 'Goals that finally ripen',
      ja: 'やがて実る目標',
    }),
    bio: Object.freeze({
      id: 'Minori menunggu dengan sabar, dan menghitung panen saat waktunya tiba.',
      en: 'Minori waits patiently, and counts the harvest when it is time.',
      ja: 'じっくり待って、時が来たら実りを数えます。',
    }),
    palette: Object.freeze({
      hairDark: '#5A3E48',
      hairLight: '#8D6E7C',
      highlight: '#FFF8E7',
      irisTop: '#4A3540',
      irisMid: '#9C8AA5',
      irisBottom: '#D1C4E9',
      cloth: '#F4EFFA',
      clothAlt: '#FFFDF9',
      accent: '#B39DDB',
      ribbon: '#C9A227',
      skin: '#FBE6DA',
      cheek: '#F7B2AD',
    }),
    hair: 'side_braid',
    prop: 'harvest_basket',
    pages: Object.freeze(['/goals', '/health-coach', '/recurring']),
  }),

  koneko: Object.freeze({
    id: 'koneko',
    name: 'Koneko',
    altName: 'Tamari',
    kanji: '貯猫',
    gender: 'companion',
    vibe: 'ultra-cute lucky cat companion',
    meaning: Object.freeze({
      id: '貯金 (menabung) + 猫 (kucing) + 福 (rezeki) — kucing penjaga tabungan.',
      en: '貯金 (saving) + 猫 (cat) + 福 (fortune) — the cat who guards the savings.',
      ja: '貯金＋猫＋福。貯金を見まもる招き猫。',
    }),
    tagline: Object.freeze({
      id: 'Penjaga celengan',
      en: 'Keeper of the money box',
      ja: '貯金箱の番人',
    }),
    bio: Object.freeze({
      id: 'Koneko menjaga celengan rumah, dan membubuhkan cap kaki tiap kali kamu menabung.',
      en: 'Koneko guards the household money box, and stamps a paw print each time you save.',
      ja: '家の貯金箱を守り、貯めるたびに肉球のはんこを押します。',
    }),
    palette: Object.freeze({
      hairDark: '#D49A6A',
      hairLight: '#FFFDF9',
      highlight: '#FFFDF9',
      irisTop: '#4A3540',
      irisMid: '#C9A227',
      irisBottom: '#FFD54F',
      cloth: '#FFFDF9',
      clothAlt: '#F7B2AD',
      accent: '#E53935',
      ribbon: '#FFD54F',
      skin: '#FBE6DA',
      cheek: '#F7B2AD',
    }),
    hair: 'cat_ear_hood',
    prop: 'fuku_koban',
    pages: Object.freeze(['/household']),
  }),
});

/** Their ids, in the order the avatar dock shows them. */
export const PETIT_PERSONA_IDS = Object.freeze(Object.keys(PETIT_CHIBI_CAST));

/** Every prop the drawing has to know how to render. */
export const PETIT_PROPS = Object.freeze(
  PETIT_PERSONA_IDS.map((id) => PETIT_CHIBI_CAST[id].prop)
);

/** Every hair silhouette the drawing has to know how to render. */
export const PETIT_HAIR_STYLES = Object.freeze(
  PETIT_PERSONA_IDS.map((id) => PETIT_CHIBI_CAST[id].hair)
);

/**
 * Who keeps the reader company.
 *
 * Takes either a persona id ("kogane") or a path ("/accounts"). A
 * path is answered with the specialist for that page, longest match
 * first so "/health-coach" is not answered by whoever owns "/". An
 * id that is not one of the six, or a path nobody specialises in,
 * falls back to the default rather than to undefined - the drawing
 * must always have somebody to draw.
 */
export function getPetitPersona(idOrPage) {
  const key = String(idOrPage || '').trim();
  if (!key) return PETIT_CHIBI_CAST[DEFAULT_PETIT_PERSONA];

  if (PETIT_CHIBI_CAST[key]) return PETIT_CHIBI_CAST[key];

  if (key.startsWith('/')) {
    // The root owns "/" exactly; it must not swallow every other path
    // by being a prefix of all of them.
    let best = null;
    for (const id of PETIT_PERSONA_IDS) {
      for (const page of PETIT_CHIBI_CAST[id].pages) {
        const matches = page === '/' ? key === '/' : key === page || key.startsWith(`${page}/`);
        if (matches && (!best || page.length > best.page.length)) {
          best = { page, persona: PETIT_CHIBI_CAST[id] };
        }
      }
    }
    if (best) return best.persona;
  }

  return PETIT_CHIBI_CAST[DEFAULT_PETIT_PERSONA];
}

/** One of their lines, in the reader's language, with a safe fallback. */
export function petitText(persona, field, language = 'id') {
  const block = persona?.[field];
  if (!block) return '';
  return block[language] || block.id || '';
}

export default PETIT_CHIBI_CAST;
