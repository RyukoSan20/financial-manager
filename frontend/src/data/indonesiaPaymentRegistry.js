/**
 * The Indonesian payment institutions, in one place.
 *
 * An Indonesian reader has money in a conventional bank, in a digital
 * bank, in an e-wallet, in a tap card, on a credit card, and sometimes
 * in their own shop. Each of those has a number: the bank's code from
 * Bank Indonesia, the length of the account number, and the phone
 * number that an e-wallet is reached at.
 *
 * That knowledge was scattered through the application - some of it in
 * the account form, some of it in the code that reads a quick entry,
 * some of it in the transfer screen. So it was wrong in three places
 * at once, and the reader was asked to remember a bank code they should
 * not have to remember.
 *
 * So there is one table of it here, and one in the server, and they
 * say the same thing. The server's copy is the authority: this file
 * is generated from it, and a check in the test suite holds the two
 * the same.
 *
 * Three things this table is for:
 *
 * - **telling the reader where their money is.** Picking "SeaBank"
 *   fills in the brand colour, the badge, the Bank Indonesia code and
 *   the shape of the account number.
 * - **reading a line of Indonesian.** "kopi jago 10rb gopay" names the
 *   wallet, and "paket data tsel 50rb" names the operator, and the
 *   account and the category follow from it.
 * - **knowing what a transfer costs.** Which rail the money goes over
 *   decides the fee: same bank is free, BI-FAST is two and a half
 *   thousand, a real-time online transfer is six and a half thousand,
 *   and topping up a wallet is whatever that wallet charges.
 *
 * Nothing here is a secret and nothing here is fetched from the
 * network. It is a table of public facts about how money moves in
 * Indonesia.
 */

// ---------------------------------------------------------------------------
// The kinds of institution
// ---------------------------------------------------------------------------

export const BANK_CONVENTIONAL = 'BANK_CONVENTIONAL';
export const BANK_DIGITAL = 'BANK_DIGITAL';
export const BANK_SYARIAH = 'BANK_SYARIAH';
export const BANK_BPD = 'BANK_BPD';
export const EWALLET = 'EWALLET';
export const EMONEY_CARD = 'EMONEY_CARD';
export const PULSA_TELCO = 'PULSA_TELCO';
export const PAYLATER_CREDIT = 'PAYLATER_CREDIT';
export const CASH = 'CASH';

// ---------------------------------------------------------------------------
// The table
// ---------------------------------------------------------------------------

export const INSTITUTIONS = [
  {
    id: "bca",
    name: "BCA",
    kind: "BANK_CONVENTIONAL",
    code: "014",
    digits: 10,
    aliases: ["bca", "mybca", "m-bca", "klikbca", "bank central asia"],
    color: "#0A4DA2",
    numberKind: "account",
    topupFee: null,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "mandiri",
    name: "Bank Mandiri",
    kind: "BANK_CONVENTIONAL",
    code: "008",
    digits: 13,
    aliases: ["mandiri", "livin", "livin by mandiri"],
    color: "#0B4A9B",
    numberKind: "account",
    topupFee: null,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "bri",
    name: "Bank BRI",
    kind: "BANK_CONVENTIONAL",
    code: "002",
    digits: 15,
    aliases: ["bri", "brimo", "britama", "simpedes"],
    color: "#0C7C3F",
    numberKind: "account",
    topupFee: null,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "bni",
    name: "Bank BNI",
    kind: "BANK_CONVENTIONAL",
    code: "009",
    digits: 10,
    aliases: ["bni", "wondr"],
    color: "#F26522",
    numberKind: "account",
    topupFee: null,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "btn",
    name: "Bank BTN",
    kind: "BANK_CONVENTIONAL",
    code: "200",
    digits: 16,
    aliases: ["btn", "bale"],
    color: "#2E7D32",
    numberKind: "account",
    topupFee: null,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "cimb",
    name: "CIMB Niaga",
    kind: "BANK_CONVENTIONAL",
    code: "022",
    digits: null,
    aliases: ["cimb", "cimb niaga", "octo"],
    color: "#B01513",
    numberKind: "account",
    topupFee: null,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "permata",
    name: "Bank Permata",
    kind: "BANK_CONVENTIONAL",
    code: "013",
    digits: null,
    aliases: ["permata", "permatame"],
    color: "#6B3FA0",
    numberKind: "account",
    topupFee: null,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "danamon",
    name: "Bank Danamon",
    kind: "BANK_CONVENTIONAL",
    code: "011",
    digits: null,
    aliases: ["danamon"],
    color: "#1B7B3E",
    numberKind: "account",
    topupFee: null,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "ocbc",
    name: "Bank OCBC",
    kind: "BANK_CONVENTIONAL",
    code: "028",
    digits: null,
    aliases: ["ocbc", "nyala"],
    color: "#C8102E",
    numberKind: "account",
    topupFee: null,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "maybank",
    name: "Maybank",
    kind: "BANK_CONVENTIONAL",
    code: "016",
    digits: null,
    aliases: ["maybank"],
    color: "#0B4A9B",
    numberKind: "account",
    topupFee: null,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "panin",
    name: "Bank Panin",
    kind: "BANK_CONVENTIONAL",
    code: "019",
    digits: null,
    aliases: ["panin"],
    color: "#0C4DA2",
    numberKind: "account",
    topupFee: null,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "dbs",
    name: "Bank DBS",
    kind: "BANK_CONVENTIONAL",
    code: "046",
    digits: null,
    aliases: ["dbs", "digibank"],
    color: "#D0202E",
    numberKind: "account",
    topupFee: null,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "uob",
    name: "Bank UOB",
    kind: "BANK_CONVENTIONAL",
    code: "023",
    digits: null,
    aliases: ["uob", "tmrw"],
    color: "#00539B",
    numberKind: "account",
    topupFee: null,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "hsbc",
    name: "HSBC",
    kind: "BANK_CONVENTIONAL",
    code: "087",
    digits: null,
    aliases: ["hsbc"],
    color: "#DB0011",
    numberKind: "account",
    topupFee: null,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "jago",
    name: "Bank Jago",
    kind: "BANK_DIGITAL",
    code: "542",
    digits: 12,
    aliases: ["jago", "kantong jago"],
    color: "#0F9D58",
    numberKind: "account",
    topupFee: null,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "seabank",
    name: "SeaBank",
    kind: "BANK_DIGITAL",
    code: "535",
    digits: 12,
    aliases: ["seabank", "sea bank"],
    color: "#0A3D91",
    numberKind: "account",
    topupFee: null,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "blu",
    name: "blu by BCA Digital",
    kind: "BANK_DIGITAL",
    code: "501",
    digits: 12,
    aliases: ["blu", "bca digital"],
    color: "#0A4DA2",
    numberKind: "account",
    topupFee: null,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "allo",
    name: "Allo Bank",
    kind: "BANK_DIGITAL",
    code: "567",
    digits: null,
    aliases: ["allo", "allobank"],
    color: "#1E40AF",
    numberKind: "account",
    topupFee: null,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "superbank",
    name: "Superbank",
    kind: "BANK_DIGITAL",
    code: "562",
    digits: null,
    aliases: ["superbank"],
    color: "#0E7490",
    numberKind: "account",
    topupFee: null,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "bnc",
    name: "Bank Neo Commerce",
    kind: "BANK_DIGITAL",
    code: "490",
    digits: null,
    aliases: ["bnc", "neobank", "neo commerce"],
    color: "#DB2777",
    numberKind: "account",
    topupFee: null,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "saqu",
    name: "Bank Saqu",
    kind: "BANK_DIGITAL",
    code: "548",
    digits: null,
    aliases: ["saqu"],
    color: "#059669",
    numberKind: "account",
    topupFee: null,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "krom",
    name: "Krom Bank",
    kind: "BANK_DIGITAL",
    code: "459",
    digits: null,
    aliases: ["krom"],
    color: "#4338CA",
    numberKind: "account",
    topupFee: null,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "linebank",
    name: "Line Bank",
    kind: "BANK_DIGITAL",
    code: "484",
    digits: null,
    aliases: ["line bank", "hanabank", "hana"],
    color: "#06C755",
    numberKind: "account",
    topupFee: null,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "raya",
    name: "Bank Raya",
    kind: "BANK_DIGITAL",
    code: "494",
    digits: null,
    aliases: ["raya", "bank raya"],
    color: "#B91C1C",
    numberKind: "account",
    topupFee: null,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "jenius",
    name: "Jenius SMBC",
    kind: "BANK_DIGITAL",
    code: "213",
    digits: null,
    aliases: ["jenius", "btpn"],
    color: "#1D4ED8",
    numberKind: "account",
    topupFee: null,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "bsi",
    name: "Bank Syariah Indonesia",
    kind: "BANK_SYARIAH",
    code: "451",
    digits: null,
    aliases: ["bsi", "byond", "bank syariah indonesia"],
    color: "#007A33",
    numberKind: "account",
    topupFee: null,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "muamalat",
    name: "Bank Muamalat",
    kind: "BANK_SYARIAH",
    code: "147",
    digits: null,
    aliases: ["muamalat"],
    color: "#0F766E",
    numberKind: "account",
    topupFee: null,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "bca_syariah",
    name: "BCA Syariah",
    kind: "BANK_SYARIAH",
    code: "536",
    digits: null,
    aliases: ["bca syariah", "bcas"],
    color: "#1B7B3E",
    numberKind: "account",
    topupFee: null,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "mega_syariah",
    name: "Bank Mega Syariah",
    kind: "BANK_SYARIAH",
    code: "506",
    digits: null,
    aliases: ["mega syariah", "bms"],
    color: "#C8102E",
    numberKind: "account",
    topupFee: null,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "aladin",
    name: "Bank Aladin Syariah",
    kind: "BANK_SYARIAH",
    code: "947",
    digits: null,
    aliases: ["aladin", "bank aladin"],
    color: "#F59E0B",
    numberKind: "account",
    topupFee: null,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "bank_dki",
    name: "Bank DKI",
    kind: "BANK_BPD",
    code: "111",
    digits: null,
    aliases: ["dki", "jakone", "bank dki"],
    color: "#C8102E",
    numberKind: "account",
    topupFee: null,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "bjb",
    name: "Bank BJB",
    kind: "BANK_BPD",
    code: "110",
    digits: null,
    aliases: ["bjb"],
    color: "#0C7C3F",
    numberKind: "account",
    topupFee: null,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "bank_jateng",
    name: "Bank Jateng",
    kind: "BANK_BPD",
    code: "113",
    digits: null,
    aliases: ["jateng"],
    color: "#0B4A9B",
    numberKind: "account",
    topupFee: null,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "bank_jatim",
    name: "Bank Jatim",
    kind: "BANK_BPD",
    code: "114",
    digits: null,
    aliases: ["jatim"],
    color: "#0A4DA2",
    numberKind: "account",
    topupFee: null,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "bpd_bali",
    name: "BPD Bali",
    kind: "BANK_BPD",
    code: "129",
    digits: null,
    aliases: ["bpd bali", "bali"],
    color: "#1E3A8A",
    numberKind: "account",
    topupFee: null,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "gopay",
    name: "GoPay",
    kind: "EWALLET",
    code: null,
    digits: null,
    aliases: ["gopay", "gojek"],
    color: "#00A99D",
    numberKind: "phone",
    topupFee: 1000,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "ovo",
    name: "OVO",
    kind: "EWALLET",
    code: null,
    digits: null,
    aliases: ["ovo"],
    color: "#4C2A85",
    numberKind: "phone",
    topupFee: 1000,
    vaPrefix: "39358",
    prefixes: [],
  },
  {
    id: "dana",
    name: "DANA",
    kind: "EWALLET",
    code: null,
    digits: null,
    aliases: ["dana"],
    color: "#1188FF",
    numberKind: "phone",
    topupFee: 500,
    vaPrefix: "3901",
    prefixes: [],
  },
  {
    id: "shopeepay",
    name: "ShopeePay",
    kind: "EWALLET",
    code: null,
    digits: null,
    aliases: ["shopeepay", "spay", "shopee pay"],
    color: "#EE4D2D",
    numberKind: "phone",
    topupFee: 1000,
    vaPrefix: "122",
    prefixes: [],
  },
  {
    id: "linkaja",
    name: "LinkAja",
    kind: "EWALLET",
    code: null,
    digits: null,
    aliases: ["linkaja", "link aja"],
    color: "#0C7C3F",
    numberKind: "phone",
    topupFee: 1000,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "isaku",
    name: "i.saku",
    kind: "EWALLET",
    code: null,
    digits: null,
    aliases: ["isaku", "i.saku"],
    color: "#005EB8",
    numberKind: "phone",
    topupFee: 1000,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "astrapay",
    name: "AstraPay",
    kind: "EWALLET",
    code: null,
    digits: null,
    aliases: ["astrapay", "astra pay"],
    color: "#E4002B",
    numberKind: "phone",
    topupFee: 1000,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "doku",
    name: "DOKU",
    kind: "EWALLET",
    code: null,
    digits: null,
    aliases: ["doku"],
    color: "#0F9D58",
    numberKind: "phone",
    topupFee: 1000,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "paypal",
    name: "PayPal",
    kind: "EWALLET",
    code: null,
    digits: null,
    aliases: ["paypal"],
    color: "#003087",
    numberKind: "email",
    topupFee: 1000,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "flazz",
    name: "BCA Flazz",
    kind: "EMONEY_CARD",
    code: null,
    digits: 16,
    aliases: ["flazz", "bca flazz"],
    color: "#0A4DA2",
    numberKind: "card",
    topupFee: null,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "emoney",
    name: "Mandiri e-money",
    kind: "EMONEY_CARD",
    code: null,
    digits: null,
    aliases: ["emoney", "e-money", "etoll", "mandiri emoney"],
    color: "#0B4A9B",
    numberKind: "card",
    topupFee: null,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "brizzi",
    name: "BRI Brizzi",
    kind: "EMONEY_CARD",
    code: null,
    digits: null,
    aliases: ["brizzi", "bri brizzi"],
    color: "#0C7C3F",
    numberKind: "card",
    topupFee: null,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "tapcash",
    name: "BNI TapCash",
    kind: "EMONEY_CARD",
    code: null,
    digits: null,
    aliases: ["tapcash", "tap cash"],
    color: "#F26522",
    numberKind: "card",
    topupFee: null,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "jaklingko",
    name: "JakLingko / KMT",
    kind: "EMONEY_CARD",
    code: null,
    digits: null,
    aliases: ["kmt", "jaklingko", "jak lingko"],
    color: "#1D4ED8",
    numberKind: "card",
    topupFee: null,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "telkomsel",
    name: "Telkomsel / by.U",
    kind: "PULSA_TELCO",
    code: null,
    digits: null,
    aliases: ["telkomsel", "tsel", "simpati", "halo", "byu", "by.u"],
    color: "#E2001A",
    numberKind: "phone",
    topupFee: null,
    vaPrefix: null,
    prefixes: ["0811", "0812", "0813", "0821", "0822", "0823", "0851", "0852", "0853"],
  },
  {
    id: "indosat",
    name: "Indosat IM3 / Tri (3)",
    kind: "PULSA_TELCO",
    code: null,
    digits: null,
    aliases: ["indosat", "im3", "tri", "kartu 3", "bima+"],
    color: "#F8B500",
    numberKind: "phone",
    topupFee: null,
    vaPrefix: null,
    prefixes: ["0814", "0815", "0816", "0855", "0856", "0857", "0858", "0895", "0896", "0897", "0898", "0899"],
  },
  {
    id: "xl",
    name: "XL / AXIS",
    kind: "PULSA_TELCO",
    code: null,
    digits: null,
    aliases: ["xl", "axis", "myxl", "axisnet"],
    color: "#4E2A84",
    numberKind: "phone",
    topupFee: null,
    vaPrefix: null,
    prefixes: ["0817", "0818", "0819", "0859", "0877", "0878", "0831", "0832", "0833", "0838"],
  },
  {
    id: "smartfren",
    name: "Smartfren",
    kind: "PULSA_TELCO",
    code: null,
    digits: null,
    aliases: ["smartfren", "sf"],
    color: "#E4002B",
    numberKind: "phone",
    topupFee: null,
    vaPrefix: null,
    prefixes: ["0881", "0882", "0883", "0884", "0885", "0886", "0887", "0888", "0889"],
  },
  {
    id: "spaylater",
    name: "SPayLater",
    kind: "PAYLATER_CREDIT",
    code: null,
    digits: null,
    aliases: ["spaylater", "shopee paylater"],
    color: "#EE4D2D",
    numberKind: "account",
    topupFee: null,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "gopaylater",
    name: "GoPayLater",
    kind: "PAYLATER_CREDIT",
    code: null,
    digits: null,
    aliases: ["gopaylater", "gopay later"],
    color: "#00A99D",
    numberKind: "account",
    topupFee: null,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "kredivo",
    name: "Kredivo",
    kind: "PAYLATER_CREDIT",
    code: null,
    digits: null,
    aliases: ["kredivo"],
    color: "#5B2C8D",
    numberKind: "account",
    topupFee: null,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "akulaku",
    name: "Akulaku",
    kind: "PAYLATER_CREDIT",
    code: null,
    digits: null,
    aliases: ["akulaku"],
    color: "#0C7C3F",
    numberKind: "account",
    topupFee: null,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "indodana",
    name: "Indodana",
    kind: "PAYLATER_CREDIT",
    code: null,
    digits: null,
    aliases: ["indodana"],
    color: "#1D4ED8",
    numberKind: "account",
    topupFee: null,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "traveloka",
    name: "Traveloka PayLater",
    kind: "PAYLATER_CREDIT",
    code: null,
    digits: null,
    aliases: ["traveloka paylater", "traveloka"],
    color: "#3C1053",
    numberKind: "account",
    topupFee: null,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "homecredit",
    name: "Home Credit",
    kind: "PAYLATER_CREDIT",
    code: null,
    digits: null,
    aliases: ["home credit", "homecredit"],
    color: "#C8102E",
    numberKind: "account",
    topupFee: null,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "atome",
    name: "Atome",
    kind: "PAYLATER_CREDIT",
    code: null,
    digits: null,
    aliases: ["atome"],
    color: "#F59E0B",
    numberKind: "account",
    topupFee: null,
    vaPrefix: null,
    prefixes: [],
  },
  {
    id: "cash",
    name: "Tunai / Cash",
    kind: "CASH",
    code: null,
    digits: null,
    aliases: ["tunai", "cash"],
    color: "#78716C",
    numberKind: "none",
    topupFee: null,
    vaPrefix: null,
    prefixes: [],
  },
];

export const INSTITUTION_BY_ID = INSTITUTIONS.reduce((acc, i) => {
  acc[i.id] = i;
  return acc;
}, {});

/**
 * The groups the account form offers, in the order they are offered.
 */
export const INSTITUTION_GROUPS = [
  { kind: "BANK_CONVENTIONAL", label: "Bank Konvensional" },
  { kind: "BANK_DIGITAL", label: "Bank Digital" },
  { kind: "BANK_SYARIAH", label: "Bank Syariah" },
  { kind: "BANK_BPD", label: "Bank Pembangunan Daerah" },
  { kind: "EWALLET", label: "E-Wallet" },
  { kind: "EMONEY_CARD", label: "Kartu Tap" },
  { kind: "PAYLATER_CREDIT", label: "Paylater & Kredit" },
  { kind: "CASH", label: "Tunai / Cash" },
];

/**
 * The rails, and what each one costs.
 */
export const SESAMA_BANK = 'SESAMA_BANK';
export const BI_FAST = 'BI_FAST';
export const RTOL_ONLINE = 'RTOL_ONLINE';
export const TOPUP_EWALLET = 'TOPUP_EWALLET';
export const QRIS = 'QRIS';

export const TRANSFER_METHODS = [
  {
    id: "SESAMA_BANK",
    name: "Sesama Bank",
    fee: 0,
    kind: "transfer",
    note: "Gratis Rp 0",
  },
  {
    id: "BI_FAST",
    name: "BI-FAST",
    fee: 2500,
    kind: "transfer",
    note: "Biaya Rp 2.500",
  },
  {
    id: "RTOL_ONLINE",
    name: "RTOL Online",
    fee: 6500,
    kind: "transfer",
    note: "Biaya Rp 6.500",
  },
  {
    id: "TOPUP_EWALLET",
    name: "Top-Up E-Wallet",
    fee: 1000,
    kind: "topup",
    note: "Biaya admin dari e-wallet tujuan",
  },
  {
    id: "QRIS",
    name: "QRIS",
    fee: 0,
    kind: "qris",
    note: "Gratis Rp 0",
    mdr: 0.007,
  },
];

export const TRANSFER_METHOD_BY_ID = TRANSFER_METHODS.reduce((acc, m) => {
  acc[m.id] = m;
  return acc;
}, {});

// ---------------------------------------------------------------------------
// Finding an institution in a line of Indonesian
// ---------------------------------------------------------------------------

/**
 * Every alias, lowercased, mapped to the institution it names.
 */
const ALIAS_INDEX = INSTITUTIONS.reduce((acc, institution) => {
  for (const alias of institution.aliases) {
    acc[alias.toLowerCase()] = institution;
  }
  acc[institution.name.toLowerCase()] = institution;
  return acc;
}, {});

/**
 * The text, in the shape the aliases are written in.
 */
function normalise(text) {
  return String(text || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Whether a word stands on its own.
 *
 * "bca" is a bank. "bcar" is not, and a line that happens to contain
 * the letters is not a bank transfer.
 */
function hasWord(haystack, word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`).test(haystack);
}

/**
 * The institution a line of Indonesian names.
 *
 * "kopi jago 10rb gopay" names GoPay. "makan siang 35rb qris mybca"
 * names BCA, by way of QRIS. "paket data tsel 50rb" names Telkomsel.
 *
 * The longest alias wins, so "bca digital" finds blu rather than BCA,
 * and "shopee paylater" finds SPayLater rather than ShopeePay.
 *
 * Returns the institution, or nothing when the line names none.
 */
export function detectProviderFromText(text) {
  const haystack = normalise(text);
  if (!haystack) return null;

  let best = null;
  let bestLength = 0;

  for (const [alias, institution] of Object.entries(ALIAS_INDEX)) {
    if (!alias || alias.length <= bestLength) continue;
    if (hasWord(haystack, alias)) {
      best = institution;
      bestLength = alias.length;
    }
  }

  return best;
}

/**
 * The rail a line of Indonesian names, if it names one.
 *
 * QRIS is the way the money went, not whose account it went from. A
 * reader who types "qris" is saying how they paid.
 */
export function detectTransferMethodFromText(text) {
  const haystack = normalise(text);
  if (!haystack) return null;

  if (hasWord(haystack, 'qris')) return TRANSFER_METHOD_BY_ID[QRIS];
  if (hasWord(haystack, 'bi-fast') || hasWord(haystack, 'bifast')) {
    return TRANSFER_METHOD_BY_ID[BI_FAST];
  }
  if (hasWord(haystack, 'rtol')) return TRANSFER_METHOD_BY_ID[RTOL_ONLINE];

  return null;
}

/**
 * The operator a phone number belongs to.
 *
 * Indonesian mobile numbers begin 08, and the next two digits say who
 * the operator is. A number written the international way, with 62 in
 * front of it, is the same number.
 *
 * "081234567890" is Telkomsel. "081512345678" is Indosat. "087712345678"
 * is XL. "088112345678" is Smartfren.
 */
export function detectTelcoByPhonePrefix(phoneNumber) {
  if (!phoneNumber) return null;

  let digits = String(phoneNumber).replace(/\D/g, '');

  // +62 812 3456 7890 is the same number as 0812 3456 7890.
  if (digits.startsWith('62')) {
    digits = '0' + digits.slice(2);
  } else if (digits.startsWith('8') && digits.length >= 10) {
    digits = '0' + digits;
  }

  if (digits.length < 4 || !digits.startsWith('08')) return null;

  const prefix = digits.slice(0, 4);
  for (const institution of INSTITUTIONS) {
    if (institution.kind !== PULSA_TELCO) continue;
    if (institution.prefixes.includes(prefix)) return institution;
  }

  return null;
}

// ---------------------------------------------------------------------------
// The number
// ---------------------------------------------------------------------------

/**
 * A bank account number, in the way it is written on the card.
 *
 * BCA is written 123-456-7890. BRI, which has fifteen digits, is
 * written in groups of four. The grouping follows the length of the
 * number, because the lengths differ and a fixed grouping would look
 * wrong on half of them.
 */
export function formatAccount(digits, expectedDigits = null) {
  const clean = String(digits || '').replace(/\D/g, '');
  if (!clean) return '';

  if (expectedDigits === 10) {
    // Ten digits are 3-3-4: 123-456-7890.
    const groups = [];
    for (let i = 0; i < 6; i += 3) groups.push(clean.slice(i, i + 3));
    if (clean.length > 6) groups.push(clean.slice(6));
    return groups.filter(Boolean).join('-');
  }

  const groups = [];
  for (let i = 0; i < clean.length; i += 4) groups.push(clean.slice(i, i + 4));
  return groups.join('-');
}

/**
 * An Indonesian phone number, the way it is written.
 */
export function formatPhone(digits) {
  const clean = String(digits || '').replace(/\D/g, '');
  if (clean.length < 4) return clean;
  return [clean.slice(0, 4), clean.slice(4, 8), clean.slice(8)].filter(Boolean).join('-');
}

/**
 * A card number, in groups of four.
 */
export function formatCard(digits) {
  const clean = String(digits || '').replace(/\D/g, '');
  const groups = [];
  for (let i = 0; i < clean.length; i += 4) groups.push(clean.slice(i, i + 4));
  return groups.join('-');
}

/**
 * Is the number the right shape, and how is it written?
 *
 * A bank account number is a number of a certain length. An e-wallet
 * is a phone number. So the two are checked differently and are
 * written differently.
 *
 * The answer is the number, whether it is right or not, the reason
 * when it is wrong, and the way it should be shown.
 */
export function validateAccountNumber(providerId, number) {
  const institution = INSTITUTION_BY_ID[String(providerId || '').toLowerCase()];
  if (!institution) {
    return {
      valid: false,
      formatted: String(number || '').trim(),
      error: 'unknown_provider',
      expected: null,
    };
  }

  const raw = String(number || '').trim();
  let digits = raw.replace(/\D/g, '');
  const kind = institution.numberKind;

  if (kind === 'none') {
    return { valid: true, formatted: raw, error: null, expected: null };
  }

  if (kind === 'phone') {
    if (digits.startsWith('62')) digits = '0' + digits.slice(2);
    if (!digits) {
      return { valid: false, formatted: raw, error: 'empty', expected: '08xx-xxxx-xxxx' };
    }
    if (!digits.startsWith('08')) {
      return {
        valid: false,
        formatted: raw,
        error: 'not_a_phone_number',
        expected: '08xx-xxxx-xxxx',
      };
    }
    if (digits.length < 10) {
      return {
        valid: false,
        formatted: formatPhone(digits),
        error: 'too_short',
        expected: '08xx-xxxx-xxxx',
      };
    }
    return {
      valid: true,
      formatted: formatPhone(digits),
      error: null,
      expected: '08xx-xxxx-xxxx',
    };
  }

  if (kind === 'email') {
    if (!raw.includes('@')) {
      return {
        valid: false,
        formatted: raw,
        error: 'not_an_email',
        expected: 'nama@email.com',
      };
    }
    return { valid: true, formatted: raw, error: null, expected: 'nama@email.com' };
  }

  const expectedDigits = institution.digits;

  if (kind === 'card') {
    if (digits.length < 6) {
      return {
        valid: false,
        formatted: raw,
        error: 'too_short',
        expected: 'Nomor kartu',
      };
    }
    return {
      valid: true,
      formatted: formatCard(digits),
      error: null,
      expected: 'Nomor kartu',
    };
  }

  if (!digits) {
    return {
      valid: false,
      formatted: raw,
      error: 'empty',
      expected: expectedDigits ? `${expectedDigits} digit` : 'Nomor rekening',
    };
  }
  if (expectedDigits && digits.length !== expectedDigits) {
    return {
      valid: false,
      formatted: formatAccount(digits, expectedDigits),
      error: 'wrong_length',
      expected: `${expectedDigits} digit`,
    };
  }
  return {
    valid: true,
    formatted: formatAccount(digits, expectedDigits),
    error: null,
    expected: expectedDigits ? `${expectedDigits} digit` : 'Nomor rekening',
  };
}

// ---------------------------------------------------------------------------
// The fee
// ---------------------------------------------------------------------------

/**
 * What a transfer costs.
 *
 * The rail decides most of it. A top-up of an e-wallet is charged by
 * the wallet, and the wallet decides: DANA is five hundred and GoPay
 * is a thousand.
 *
 * A QRIS payment by a reader costs nothing. The seven tenths of a
 * percent is what it costs the shop, and that is the shop's number
 * and not the reader's.
 */
export function transferFee(methodId, targetProviderId = null) {
  const method = TRANSFER_METHOD_BY_ID[String(methodId || '').toUpperCase()];
  if (!method) return 0;

  if (method.id === TOPUP_EWALLET) {
    const target = INSTITUTION_BY_ID[String(targetProviderId || '').toLowerCase()];
    if (target && target.topupFee !== null && target.topupFee !== undefined) {
      return target.topupFee;
    }
    return method.fee;
  }

  if (method.id === QRIS) return 0;

  return method.fee || 0;
}

/**
 * What a shop pays when a reader pays it by QRIS.
 */
export function merchantMdr(methodId = QRIS) {
  const method = TRANSFER_METHOD_BY_ID[String(methodId || '').toUpperCase()];
  if (!method) return 0;
  return method.mdr || 0;
}

// ---------------------------------------------------------------------------
// The groups
// ---------------------------------------------------------------------------

/**
 * The institutions of one group, in the order they are offered.
 */
export function institutionsInGroup(kind) {
  return INSTITUTIONS.filter((i) => i.kind === kind);
}

/**
 * The name of a group of institutions.
 */
export function groupLabel(kind) {
  const group = INSTITUTION_GROUPS.find((g) => g.kind === kind);
  return group ? group.label : kind;
}

/**
 * One institution, by its id.
 */
export function findInstitution(providerId) {
  return INSTITUTION_BY_ID[String(providerId || '').toLowerCase()] || null;
}

/**
 * The hint under the account number field.
 *
 * "12 digit" for a bank, "Nomor HP 08xx" for a wallet, and so on.
 * The reader knows which one they are filling in, so the field says
 * which one it wants.
 */
export function numberHint(providerId) {
  const institution = findInstitution(providerId);
  if (!institution) return null;

  if (institution.numberKind === 'phone') return 'Nomor HP 08xx';
  if (institution.numberKind === 'email') return 'Alamat email';
  if (institution.numberKind === 'card') return 'Nomor kartu';
  if (institution.numberKind === 'none') return null;
  if (institution.digits) return `${institution.digits} digit`;
  return 'Nomor rekening';
}

/**
 * The badge on the account.
 *
 * The bank code is what the reader sees on their own card, so the
 * badge carries it.
 */
export function institutionBadge(providerId) {
  const institution = findInstitution(providerId);
  if (!institution) return null;
  if (institution.code) return `Kode Bank ${institution.code}`;
  return institution.name;
}

export default {
  INSTITUTIONS,
  INSTITUTION_BY_ID,
  INSTITUTION_GROUPS,
  TRANSFER_METHODS,
  TRANSFER_METHOD_BY_ID,
  detectProviderFromText,
  detectTransferMethodFromText,
  detectTelcoByPhonePrefix,
  validateAccountNumber,
  formatAccount,
  formatPhone,
  formatCard,
  transferFee,
  merchantMdr,
  institutionsInGroup,
  groupLabel,
  findInstitution,
  numberHint,
  institutionBadge,
};
