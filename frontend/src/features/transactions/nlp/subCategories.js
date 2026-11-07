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
 * "Transportasi", it is "BBM & Parkir".
 *
 * The parent is what is recorded against the transaction, because
 * that is what the budget and the report already understand. The
 * sub-category is what the reader chooses, and what the dictionary
 * suggests.
 *
 * These are suggestions, not decisions. The reader can always pick a
 * different one, and the one they pick is the one that is recorded.
 */

/**
 * The sub-categories of each category.
 *
 * `key` is the name the sub-category is known by inside the
 * application. `name` is what the reader sees. `words` are the
 * things a reader might type that mean it.
 */
export const SUB_CATEGORIES = {
  food_drink: [
    { key: 'coffee_tea', name: 'Kopi & Teh', words: ['kopi', 'coffee', 'teh', 'tea', 'kafe', 'cafe', 'warkop', 'warkup', 'barista', 'espresso', 'latte', 'americano', 'kapal', 'kopi susu', 'coppelate', 'jago'] },
    { key: 'restaurant', name: 'Restoran & Kuliner', words: ['resto', 'restaurant', 'makan di luar', 'warung', 'kedai', 'rumah makan', 'sate', 'bakso', 'soto', 'nasi goreng', 'nasgor', 'mie ayam', 'bakmi', 'gudeg', 'rendang', 'nasi padang', 'pecel'] },
    { key: 'groceries', name: 'Belanja Dapur', words: ['belanja', 'supermarket', 'supermarket', 'indomaret', 'alfamart', 'sayur', 'sayuran', 'buah', 'beras', 'gula', 'minyak', 'telur', 'daging', 'ikan', 'bahan pokok'] },
    { key: 'snacks', name: 'Camilan & Manisan', words: ['camilan', 'snack', 'keripik', 'chitato', 'tahu goreng', 'risoles', 'martabak', 'roti', 'donat', 'bolu', 'kue', 'cokelat', 'es krim', 'ice cream'] },
    { key: 'instant', name: 'Makanan Instan', words: ['indomie', 'mie instan', 'supermie', 'nasi instan', 'mi instan', 'koreng'] },
    { key: 'drinks', name: 'Minuman', words: ['minuman', 'air mineral', 'aqua', 'teh kotak', 'soda', 'coca cola', 'sprite', 'air gallon', 'susu'] },
    { key: 'delivery', name: 'Antar', words: ['grabfood', 'gofood', 'shopeefood', 'delivery', 'antar', 'ojek', 'gojek', 'grab'] },
  ],
  transportation: [
    { key: 'fuel', name: 'BBM & Parkir', words: ['bensin', 'bbm', 'pertamax', 'pertalite', 'dexlite', 'shell', ' Pertamina', 'parkir', 'parkiran', 'parking', 'tol', 'e-toll'] },
    { key: 'ride', name: 'Ojek & Taksi', words: ['gojek', 'grab', 'ojek', 'online', 'motor', 'taksi', 'taxi', 'uber', 'didi', 'maxus'] },
    { key: 'public_transport', name: 'Transportasi Umum', words: ['krl', 'mrt', 'lrt', 'transjakarta', 'tj', 'kereta', 'pesawat', 'plane', 'kapal', 'bus', 'kereta api'] },
    { key: 'vehicle_care', name: 'Perawatan Kendaraan', words: ['servis', 'ganti oli', 'ban', 'oli', 'tambal ban', 'sparepart', 'oli motor', 'oli mobil'] },
    { key: 'parking_fee', name: 'Parkir & Tol', words: ['parkir mall', 'parkir mall', 'parkirValidated', 'tol', 'e toll'] },
  ],
  shopping: [
    { key: 'clothing', name: 'Pakaian', words: ['baju', 'kaos', 'kemeja', 'celana', 'dress', 'jaket', 'sepatu', 'shoes', 'sandal', 'hijab', 'jam tangan'] },
    { key: 'electronics', name: 'Elektronik', words: ['hp', 'laptop', 'komputer', 'tablet', 'tv', 'headset', 'earphone', 'speaker', 'kabel', 'powerbank', 'charger', 'mouse', 'keyboard'] },
    { key: 'household', name: 'Perlengkapan Rumah', words: ['panci', 'wajan', 'sendok', 'pisau', 'kompor', 'kettle', 'teko', 'botol', 'tumbler', 'dispenser', 'sapu', 'pel', 'tempat tidur'] },
    { key: 'beauty', name: 'Kecantikan & Perawatan', words: ['skincare', 'sabun', 'shampo', 'sampo', 'bedak', 'lipstik', 'parfum', 'deodoran'] },
    { key: 'baby', name: 'Bayi & Anak', words: ['popok', 'bayi', 'anak', 'mainan', 'toy', 'susu formula', 'stroller'] },
  ],
  health: [
    { key: 'clinic', name: 'Klinik & Dokter', words: ['dokter', 'klinik', 'puskesmas', 'hospital', 'rumah sakit', 'checkup', 'medical check'] },
    { key: 'medicine', name: 'Obat & Apotek', words: ['apotek', 'obat', 'medicine', 'vitamin', 'suplemen', 'sirup'] },
    { key: 'fitness', name: 'Olahraga & Fitness', words: ['gym', 'gymnasium', 'fitness', 'yoga', 'lari', 'run', 'sepeda', 'renang', 'kolam'] },
    { key: 'dental', name: 'Gigi', words: ['gigi', 'dokter gigi', 'scaling', 'behel', 'kawat gigi'] },
    { key: 'surgery', name: 'Operasi & Perawatan', words: ['operasi', 'surgery', 'rawat inap', 'ICU', 'bedah'] },
  ],
  education: [
    { key: 'course', name: 'Kursus & Kelas', words: ['kursus', 'kelas', 'course', 'les', 'bimbel', 'tutor'] },
    { key: 'books', name: 'Buku & Alat Tulis', words: ['buku', 'book', 'alat tulis', 'pulpen', 'kertas', 'laptop', 'spidol'] },
    { key: 'tuition', name: 'SPP & Kuliah', words: ['spp', 'ukt', 'kuliah', 'kampus', 'university', 'biaya kuliah'] },
  ],
  entertainment: [
    { key: 'streaming', name: 'Streaming & Musik', words: ['netflix', 'spotify', 'disney', 'youtube premium', 'hbo', 'viu', 'iflix'] },
    { key: 'cinema', name: 'Bioskop & Hiburan', words: ['bioskop', 'cinema', 'nonton', 'konser', 'concert', 'pertunjukan'] },
    { key: 'games', name: 'Game', words: ['game', 'ps5', 'playstation', 'xbox', 'steam', 'mobile legends', 'pubg'] },
    { key: 'travel', name: 'Liburan & Travelling', words: ['liburan', 'travel', 'hotel', 'tiket', 'pesawat', 'vacation'] },
  ],
  bills_utilities: [
    { key: 'electricity', name: 'Listrik', words: ['listrik', 'pln', 'token listrik', 'electric'] },
    { key: 'water', name: 'Air', words: ['pdam', 'tagihan air', 'water bill'] },
    { key: 'internet', name: 'Internet & TV', words: ['internet', 'indihome', 'wifi', 'indibox', 'tv kabel', 'first media'] },
    { key: 'phone', name: 'Pulsa & Telepon', words: ['pulsa', 'telepon', 'telkomsel', 'simPATI', 'axis', 'data'] },
    { key: 'gas', name: 'Gas', words: ['pgn', 'gas', 'lpg', 'elpiji'] },
  ],
  savings_investment: [
    { key: 'savings', name: 'Tabungan', words: ['tabungan', 'save', 'deposit', 'Dana darurat', 'emergency fund'] },
    { key: 'investment', name: 'Investasi', words: ['saham', 'stock', 'reksa dana', 'mutu', 'crypto', 'bitcoin', 'gold', 'emas'] },
    { key: 'retirement', name: 'Pensiun', words: ['dplk', 'pensiun', 'retirement', 'dana pensiun'] },
  ],
  other_expense: [
    { key: 'donation', name: 'Donasi & Sosial', words: ['donasi', 'zakat', 'sumbangan', 'sosial', 'charity'] },
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
 */
export function subCategoriesFor(parentSystemKey) {
  return SUB_CATEGORIES[parentSystemKey] || [];
}

/**
 * The name of the sub-category under a category, for the reader to
 * see.
 */
export function subCategoryName(parentSystemKey, key) {
  const list = SUB_CATEGORIES[parentSystemKey] || [];
  const found = list.find((sub) => sub.key === key);
  return found ? found.name : null;
}

export default {
  SUB_CATEGORIES,
  suggestSubCategory,
  subCategoriesFor,
  subCategoryName,
};
