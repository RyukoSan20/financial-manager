/**
 * The sub-categories.
 *
 * The categories were a flat list: "Makanan & Minuman", "Transportasi",
 * "Belanja" and so on. A reader who buys coffee every morning and
 * petrol every week has the same category for both, and the list of
 * transactions says nothing about what they actually spend on.
 *
 * So each category has a set of sub-categories under it, and the
 * words a reader uses point at one of them. "Kopi Jago" is not
 * "Makanan & Minuman", it is "Kopi & Kafe". "Pertamax" is not
 * "Transportasi", it is "BBM & Bensin".
 *
 * The parent is what is recorded against the transaction, because
 * that is what the budget and the report already understand. The
 * sub-category is what the reader chooses, and what the dictionary
 * suggests.
 *
 * These are suggestions, not decisions. The reader can always pick a
 * different one, and the one they pick is the one that is recorded.
 *
 * The trees themselves live in `data/categoryDictionary`, because the
 * reader-facing sheet and the parser have to agree about what is
 * under each category. This file is the list of words that point at
 * them.
 */

import { CATEGORY_DICTIONARY } from '../../../data/categoryDictionary.js';

/**
 * The sub-categories of each category.
 *
 * `key` is the name the sub-category is known by inside the
 * application. `name` is what the reader sees. `words` are the
 * things a reader might type that mean it.
 */
export const SUB_CATEGORIES = {
  food_drink: [
    { key: 'coffee_cafe', name: 'Kopi & Kafe', words: ['kopi', 'coffee', 'teh', 'tea', 'kafe', 'cafe', 'warkop', 'warkup', 'barista', 'espresso', 'latte', 'americano', 'kapal', 'kopi susu', 'coppelate', 'jago'] },
    { key: 'meals', name: 'Makan Pagi/Siang/Malam', words: ['makan', 'makan siang', 'makan malam', 'sarapan', 'breakfast', 'resto', 'restaurant', 'warung', 'kedai', 'rumah makan', 'sate', 'bakso', 'soto', 'nasi goreng', 'nasgor', 'mie ayam', 'bakmi', 'gudeg', 'rendang', 'nasi padang', 'pecel'] },
    { key: 'snacks', name: 'Jajanan & Camilan', words: ['camilan', 'snack', 'keripik', 'chitato', 'tahu goreng', 'risoles', 'martabak', 'roti', 'donat', 'bolu', 'kue', 'kue ulang tahun', 'cokelat', 'es krim', 'ice cream', 'gorengan'] },
    { key: 'groceries', name: 'Bahan Makanan & Sayur', words: ['belanja', 'supermarket', 'indomaret', 'alfamart', 'sayur', 'sayuran', 'buah', 'beras', 'gula', 'minyak', 'telur', 'daging', 'ikan', 'bahan pokok', 'bahan makanan'] },
    { key: 'drinks_boba', name: 'Minuman & Boba', words: ['minuman', 'boba', 'bobate', 'milktea', 'thai tea', 'air mineral', 'aqua', 'teh kotak', 'soda', 'coca cola', 'sprite', 'air gallon', 'susu', 'air'] },
    { key: 'delivery', name: 'Pesan Antar (Delivery)', words: ['grabfood', 'gofood', 'shopeefood', 'delivery', 'antar', 'ojek', 'gojek', 'grab'] },
    { key: 'restaurant', name: 'Restoran & Hangout', words: ['mcd', 'mcdonalds', 'kfc', 'starbucks', 'hangout', 'nongkrong', 'restoran'] },
  ],
  transportation: [
    { key: 'ride_hailing', name: 'Ojol & Taksi Online', words: ['gojek', 'grab', 'ojek', 'ojol', 'online', 'motor', 'taksi', 'taxi', 'uber', 'didi', 'maxim', 'blue bird'] },
    { key: 'fuel', name: 'BBM & Bensin', words: ['bensin', 'bbm', 'pertamax', 'pertalite', 'dexlite', 'shell', ' Pertamina', 'solar', 'petronas'] },
    { key: 'parking_toll', name: 'Parkir & Tol', words: ['parkir', 'parkiran', 'parking', 'valet', 'tol', 'e-toll', 'etoll'] },
    { key: 'public_transport', name: 'KRL / MRT / Transjakarta', words: ['krl', 'mrt', 'lrt', 'transjakarta', 'tj', 'busway', 'kereta', 'kereta api', 'pesawat', 'plane', 'kapal', 'bus', 'stasiun', 'halte'] },
    { key: 'vehicle_care', name: 'Servis & Cuci Kendaraan', words: ['servis', 'ganti oli', 'ban', 'oli', 'tambal ban', 'sparepart', 'oli motor', 'oli mobil', 'cuci mobil'] },
  ],
  shopping: [
    { key: 'daily_needs', name: 'Kebutuhan Harian / Minimarket', words: ['indomaret', 'indom', 'alfamart', 'minimarket', 'warung', 'kebutuhan harian', 'sembako'] },
    { key: 'supermarket', name: 'Supermarket & Bulanan', words: ['supermarket', 'carrefour', 'hypermart', 'giant', 'transmart', 'tmart', 'hero', 'cold storage', 'bulanan'] },
    { key: 'fashion', name: 'Pakaian & Fashion', words: ['baju', 'kaos', 'kemeja', 'celana', 'dress', 'jaket', 'sepatu', 'shoes', 'sandal', 'hijab', 'jam tangan', 'pakaian', 'clothes'] },
    { key: 'electronics', name: 'Elektronik & Gadget', words: ['hp', 'laptop', 'komputer', 'tablet', 'tv', 'headset', 'earphone', 'speaker', 'kabel', 'powerbank', 'charger', 'mouse', 'keyboard', 'elektronik'] },
    { key: 'marketplace', name: 'Marketplace / Online Shop', words: ['shopee', 'tokopedia', 'lazada', 'bukalapak', 'blibli', 'amazon', 'marketplace', 'online shop'] },
  ],
  bills_utilities: [
    { key: 'electricity', name: 'Listrik & Token PLN', words: ['listrik', 'pln', 'token listrik', 'token pln', 'electric'] },
    { key: 'water', name: 'Air PDAM', words: ['pdam', 'tagihan air', 'water bill'] },
    { key: 'internet', name: 'Internet & Wi-Fi', words: ['internet', 'indihome', 'wifi', 'indibox', 'tv kabel', 'first media'] },
    { key: 'mobile_data', name: 'Pulsa & Paket Data', words: ['pulsa', 'telkomsel', 'simpati', 'xl', 'axis', 'three', 'telepon', 'paket data', 'kuota', 'data'] },
    { key: 'rent', name: 'Sewa / Kos / KPR', words: ['sewa', 'kos', 'kost', 'kontrakan', 'apartemen', 'kpr', 'cicilan', 'angsuran'] },
    { key: 'subscriptions', name: 'Langganan Digital', words: ['langganan', 'subscription', 'netflix', 'spotify', 'youtube premium', 'disney', 'hbo', 'membership'] },
  ],
  health: [
    { key: 'medicine', name: 'Obat & Apotek', words: ['apotek', 'pharmacy', 'obat', 'medicine', 'vitamin', 'suplemen', 'sirup', 'kimia farma', 'guardian', 'watsons'] },
    { key: 'doctor', name: 'Dokter & Rumah Sakit', words: ['dokter', 'klinik', 'puskesmas', 'hospital', 'rumah sakit', 'checkup', 'medical check', 'lab'] },
    { key: 'sports', name: 'Olahraga & Gym', words: ['gym', 'gymnasium', 'fitness', 'yoga', 'lari', 'run', 'sepeda', 'renang', 'kolam', 'senam', 'workout'] },
    { key: 'self_care', name: 'Perawatan Diri & Skincare', words: ['skincare', 'sabun', 'shampo', 'sampo', 'bedak', 'lipstik', 'parfum', 'deodoran', 'sunscreen', 'kosmetik'] },
  ],
  entertainment: [
    { key: 'cinema', name: 'Nonton & Bioskop', words: ['bioskop', 'cinema', 'nonton', 'film', 'movie', 'xxi', 'cgv', 'streaming'] },
    { key: 'games', name: 'Game & Hobi', words: ['game', 'gaming', 'ps5', 'playstation', 'psn', 'xbox', 'steam', 'mobile legend', 'mobilelegand', 'pubg', 'hobi'] },
    { key: 'holiday', name: 'Liburan & Staycation', words: ['liburan', 'travel', 'hotel', 'tiket', 'pesawat', 'vacation', 'staycation'] },
    { key: 'events', name: 'Konser & Event', words: ['konser', 'concert', 'festival', 'pertunjukan', 'event'] },
  ],
  education: [
    { key: 'books', name: 'Buku & Alat Tulis', words: ['buku', 'book', 'alat tulis', 'pulpen', 'kertas', 'spidol'] },
    { key: 'courses', name: 'Kursus & Pelatihan', words: ['kursus', 'kelas', 'course', 'les', 'bimbel', 'tutor', 'pelatihan'] },
    { key: 'tuition', name: 'Uang Sekolah / Kuliah', words: ['spp', 'ukt', 'kuliah', 'kampus', 'university', 'biaya sekolah', 'biaya kuliah'] },
  ],
  savings_investment: [
    { key: 'savings', name: 'Tabungan', words: ['tabungan', 'save', 'deposit', 'dana darurat', 'emergency fund'] },
    { key: 'investment', name: 'Investasi', words: ['saham', 'stock', 'reksa dana', 'mutu', 'crypto', 'bitcoin', 'gold', 'emas'] },
    { key: 'retirement', name: 'Pensiun', words: ['dplk', 'pensiun', 'retirement', 'dana pensiun'] },
  ],
  other_expense: [
    { key: 'split_bill', name: 'Patungan / Split Bill', words: ['patungan', 'split', 'split bill', 'dibagi', 'bagi bill'] },
    { key: 'gifts', name: 'Hadiah & Kado', words: ['hadiah', 'gift', 'kado', 'present', 'amplop', 'bunga'] },
    { key: 'donation', name: 'Donasi & Zakat', words: ['donasi', 'donation', 'zakat', 'infak', 'sedekah', 'sumbangan', 'sosial', 'charity'] },
    { key: 'household', name: 'Kebutuhan Rumah Tangga', words: ['kebutuhan rumah', 'perlengkapan rumah', 'panci', 'wajan', 'sendok', 'pisau', 'kompor', 'sapu', 'pengasuh', 'babysitter'] },
    { key: 'penalty', name: 'Denda & Biaya Admin', words: ['denda', 'penalty', 'administrasi', 'biaya admin'] },
    { key: 'misc', name: 'Lain-lain', words: ['lain', 'misc', 'lainnya', 'aneh'] },
  ],
};

/**
 * The sub-category of a category that the words point at.
 *
 * The words are looked at in the order they were written, so the
 * first word that means something wins. A word that means more than
 * one thing - "kopi" can be a drink and can be a gift - is asked of
 * the sub-category that is being looked for, so the caller can ask
 * again with a narrower question when it has to.
 *
 * Returns null when nothing matches. A null is an honest answer: the
 * reader is asked, rather than the application guessing.
 */
export function suggestSubCategory(query, parentSystemKey) {
  const list = SUB_CATEGORIES[parentSystemKey] || [];
  if (!list.length) return null;

  const words = String(query || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) return null;

  // The whole phrase first, then one word at a time. "kopi susu"
  // should land on coffee even if "susu" alone would land somewhere
  // else.
  for (const sub of list) {
    for (const phrase of sub.words || []) {
      const needle = String(phrase).toLowerCase();
      if (needle.includes(' ')) {
        if (words.join(' ').includes(needle)) return sub;
      }
    }
  }

  for (const word of words) {
    for (const sub of list) {
      for (const phrase of sub.words || []) {
        const needle = String(phrase).toLowerCase();
        if (needle.includes(' ')) continue;
        if (word === needle) return sub;
        if (needle.length >= 4 && word.startsWith(needle)) return sub;
      }
    }
  }

  return null;
}

/**
 * The sub-categories of a category, for the reader to choose from.
 *
 * The list comes from the dictionary, so the sheet the reader picks
 * from and the words the parser understands are the same list.
 *
 * The word list in this file is merged in, because it knows more
 * ways of saying things than the dictionary does - and the parser
 * needs every one of them.
 */
export function subCategoriesFor(parentSystemKey) {
  const fromDictionary = CATEGORY_DICTIONARY.expense
    .concat(CATEGORY_DICTIONARY.income)
    .concat(CATEGORY_DICTIONARY.transfer)
    .find((cat) => cat.systemKey === parentSystemKey);

  if (fromDictionary) {
    const extra = SUB_CATEGORIES[parentSystemKey] || [];
    return fromDictionary.subs.map((sub) => {
      const known = extra.find((w) => w.key === sub.key);
      // Every way of saying it that is known: the dictionary's own,
      // and the longer list here.
      const words = Array.from(
        new Set([...(sub.words || []), ...(known ? known.words || [] : [])])
      );
      return {
        key: sub.key,
        name: sub.name,
        words,
      };
    });
  }

  return SUB_CATEGORIES[parentSystemKey] || [];
}

/**
 * The name of the sub-category under a category, for the reader to
 * see.
 */
export function subCategoryName(parentSystemKey, key) {
  const list = SUB_CATEGORIES[parentSystemKey] || [];
  const found = list.find((sub) => sub.key === key);
  if (found) return found.name;
  const dictionary = CATEGORY_DICTIONARY.expense
    .concat(CATEGORY_DICTIONARY.income)
    .concat(CATEGORY_DICTIONARY.transfer)
    .find((cat) => cat.systemKey === parentSystemKey);
  const sub = dictionary?.subs.find((s) => s.key === key);
  return sub ? sub.name : null;
}

export default {
  SUB_CATEGORIES,
  suggestSubCategory,
  subCategoriesFor,
  subCategoryName,
};
