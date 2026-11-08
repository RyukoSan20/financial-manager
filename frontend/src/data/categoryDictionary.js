/**
 * The category dictionary.
 *
 * The categories were one flat list for every kind of transaction: an
 * expense was offered "Gaji", an income was offered "Ojol & Taksi
 * Online". A reader who records an expense and a reader who records
 * their salary were handed the same sheet of paper, and neither of
 * them could tell which parts of it applied to them.
 *
 * So the dictionary is a tree, and there are three trees - one for
 * each kind of transaction. Each category has its own sub-categories
 * under it, and the sub-categories are the words a reader would use
 * for the things they actually buy: "Kopi & Kafe", "BBM & Parkir",
 * "Ojol & Taksi Online".
 *
 * The parent is what is recorded against the transaction, because
 * that is what the budget and the report already understand. The
 * sub-category is what the reader chooses, and what the dictionary
 * suggests.
 *
 * The `systemKey` of each category is the key the server knows it
 * by, so the dictionary and the database always agree about which
 * category is which. A category the server does not know - one the
 * reader made themselves - is kept in the reader's own list, and is
 * shown beside these.
 *
 * These are suggestions, not decisions. The reader can always pick a
 * different one, and the one they pick is the one that is recorded.
 */

/**
 * The trees.
 *
 * `systemKey` is the key the server knows the category by. `name` is
 * what the reader sees. `subs` are the sub-categories under it, each
 * with the words that mean it.
 */
export const CATEGORY_DICTIONARY = {
  expense: [
    {
      systemKey: 'food_drink',
      name: 'Makanan & Minuman',
      icon: '🍔',
      subs: [
        { key: 'coffee_cafe', name: 'Kopi & Kafe', words: ['kopi', 'coffee', 'cafe', 'kafe', 'warkop', 'espresso', 'latte', 'americano', 'jago', 'kapal', 'teh', 'tea'] },
        { key: 'meals', name: 'Makan Pagi/Siang/Malam', words: ['makan', 'sarapan', 'breakfast', 'lunch', 'dinner', 'nasi', 'nasgor', 'mie ayam', 'bakso', 'soto', 'rendang', 'sate'] },
        { key: 'snacks', name: 'Jajanan & Camilan', words: ['camilan', 'snack', 'keripik', 'chitato', 'tahu goreng', 'risol', 'martabak', 'roti', 'donat', 'kue', 'cokelat'] },
        { key: 'groceries', name: 'Bahan Makanan & Sayur', words: ['belanja', 'supermarket', 'sayur', 'sayuran', 'buah', 'beras', 'gula', 'minyak', 'telur', 'daging', 'ikan', 'bahan pokok'] },
        { key: 'drinks_boba', name: 'Minuman & Boba', words: ['minuman', 'boba', 'bobate', 'milktea', 'thai tea', 'air mineral', 'aqua', 'soda', 'coca cola', 'sprite', 'es teh'] },
        { key: 'delivery', name: 'Pesan Antar (Delivery)', words: ['grabfood', 'gofood', 'shopeefood', 'delivery', 'antar', 'ojek', 'gojek', 'grab'] },
        { key: 'restaurant', name: 'Restoran & Hangout', words: ['resto', 'restaurant', 'warung', 'kedai', 'rumah makan', 'mcd', 'kfc', 'starbucks', 'hangout', 'nongkrong'] },
      ],
    },
    {
      systemKey: 'transportation',
      name: 'Transportasi',
      icon: '🚗',
      subs: [
        { key: 'ride_hailing', name: 'Ojol & Taksi Online', words: ['gojek', 'grab', 'ojek', 'ojol', 'online', 'motor', 'taksi', 'taxi', 'maxim', 'blue bird', 'didi'] },
        { key: 'fuel', name: 'BBM & Bensin', words: ['bensin', 'bbm', 'pertamax', 'pertalite', 'dexlite', 'shell', ' Pertamina', 'solar', 'petronas'] },
        { key: 'parking_toll', name: 'Parkir & Tol', words: ['parkir', 'parkiran', 'parking', 'tol', 'e-toll', 'etoll'] },
        { key: 'public_transport', name: 'KRL / MRT / Transjakarta', words: ['krl', 'mrt', 'lrt', 'transjakarta', 'tj', 'kereta', 'bus', 'busway', 'pesawat', 'kapal', 'halte'] },
        { key: 'vehicle_care', name: 'Servis & Cuci Kendaraan', words: ['servis', 'ganti oli', 'ban', 'oli', 'sparepart', 'tambal ban', 'cuci mobil', 'wash'] },
      ],
    },
    {
      systemKey: 'shopping',
      name: 'Belanja',
      icon: '🛒',
      subs: [
        { key: 'daily_needs', name: 'Kebutuhan Harian / Minimarket', words: ['indomaret', 'alfamart', 'minimarket', 'warung', 'kebutuhan harian', 'sembako'] },
        { key: 'supermarket', name: 'Supermarket & Bulanan', words: ['supermarket', 'carrefour', 'giant', 'transmart', 'tmart', 'hero', 'bulanan'] },
        { key: 'fashion', name: 'Pakaian & Fashion', words: ['baju', 'pakaian', 'kemeja', 'kaos', 'celana', 'dress', 'sepatu', 'sandal', 'jaket', 'uniqlo', 'zara'] },
        { key: 'electronics', name: 'Elektronik & Gadget', words: ['hp', 'laptop', 'komputer', 'tablet', 'tv', 'headset', 'earphone', 'speaker', 'kabel', 'powerbank', 'charger', 'mouse', 'keyboard'] },
        { key: 'marketplace', name: 'Marketplace / Online Shop', words: ['shopee', 'tokopedia', 'lazada', 'bukalapak', 'blibli', 'amazon', 'marketplace', 'online shop'] },
      ],
    },
    {
      systemKey: 'bills_utilities',
      name: 'Tagihan & Utilitas',
      icon: '📄',
      subs: [
        { key: 'electricity', name: 'Listrik & Token PLN', words: ['listrik', 'pln', 'token listrik', 'token pln', 'electric'] },
        { key: 'water', name: 'Air PDAM', words: ['pdam', 'tagihan air', 'water bill', 'air'] },
        { key: 'internet', name: 'Internet & Wi-Fi', words: ['internet', 'indihome', 'wifi', 'indibox', 'first media', 'tv kabel'] },
        { key: 'mobile_data', name: 'Pulsa & Paket Data', words: ['pulsa', 'telkomsel', 'simpati', 'xl', 'axis', 'three', 'paket data', 'kuota', 'data'] },
        { key: 'rent', name: 'Sewa / Kos / KPR', words: ['sewa', 'kos', 'kost', 'kontrakan', 'apartemen', 'kpr', 'cicilan'] },
        { key: 'subscriptions', name: 'Langganan Digital', words: ['langganan', 'subscription', 'netflix', 'spotify', 'youtube premium', 'disney', 'hbo'] },
      ],
    },
    {
      systemKey: 'health',
      name: 'Kesehatan',
      icon: '🏥',
      subs: [
        { key: 'medicine', name: 'Obat & Apotek', words: ['apotek', 'obat', 'medicine', 'vitamin', 'suplemen', 'sirup', 'kimia farma', 'guardian', 'watsons'] },
        { key: 'doctor', name: 'Dokter & Rumah Sakit', words: ['dokter', 'klinik', 'puskesmas', 'hospital', 'rumah sakit', 'checkup', 'medical check', 'lab'] },
        { key: 'sports', name: 'Olahraga & Gym', words: ['gym', 'fitness', 'yoga', 'lari', 'run', 'sepeda', 'renang', 'kolam', 'senam'] },
        { key: 'self_care', name: 'Perawatan Diri & Skincare', words: ['skincare', 'sabun', 'shampo', 'bedak', 'lipstik', 'parfum', 'deodoran', 'sunscreen', 'kosmetik'] },
      ],
    },
    {
      systemKey: 'entertainment',
      name: 'Hiburan',
      icon: '🎬',
      subs: [
        { key: 'cinema', name: 'Nonton & Bioskop', words: ['bioskop', 'cinema', 'nonton', 'film', 'movie', 'xxi', 'cgv', 'streaming'] },
        { key: 'games', name: 'Game & Hobi', words: ['game', 'gaming', 'ps5', 'playstation', 'xbox', 'steam', 'mobile legend', 'pubg', 'hobi'] },
        { key: 'holiday', name: 'Liburan & Staycation', words: ['liburan', 'travel', 'hotel', 'tiket', 'pesawat', 'vacation', 'staycation'] },
        { key: 'events', name: 'Konser & Event', words: ['konser', 'concert', 'festival', 'pertunjukan', 'event', 'stand up comedy'] },
      ],
    },
    {
      systemKey: 'education',
      name: 'Pendidikan',
      icon: '📚',
      subs: [
        { key: 'books', name: 'Buku & Alat Tulis', words: ['buku', 'book', 'alat tulis', 'pulpen', 'kertas', 'spidol', 'buku tulis'] },
        { key: 'courses', name: 'Kursus & Pelatihan', words: ['kursus', 'kelas', 'course', 'les', 'bimbel', 'tutor', 'pelatihan', 'sertifikat'] },
        { key: 'tuition', name: 'Uang Sekolah / Kuliah', words: ['spp', 'ukt', 'kuliah', 'kampus', 'university', 'biaya sekolah', 'biaya kuliah'] },
      ],
    },
    {
      systemKey: 'other_expense',
      name: 'Keluarga & Sosial',
      icon: '🤝',
      subs: [
        { key: 'split_bill', name: 'Patungan / Split Bill', words: ['patungan', 'split', 'split bill', 'patungan bill', 'dibagi'] },
        { key: 'gifts', name: 'Hadiah & Kado', words: ['hadiah', 'kado', 'gift', 'present', 'amplop', 'bunga'] },
        { key: 'donation', name: 'Donasi & Zakat', words: ['donasi', 'zakat', 'infak', 'sedekah', 'sumbangan', 'sosial'] },
        { key: 'household', name: 'Kebutuhan Rumah Tangga', words: ['kebutuhan rumah', 'perlengkapan rumah', 'panci', 'wajan', 'sendok', 'sapu', 'pengasuh', 'babysitter'] },
      ],
    },
  ],

  income: [
    {
      systemKey: 'salary',
      name: 'Gaji & Upah',
      icon: '💰',
      subs: [
        { key: 'monthly_salary', name: 'Gaji Bulanan', words: ['gaji', 'salary', 'payroll', 'slip gaji'] },
        { key: 'allowance', name: 'Tunjangan & THR', words: ['tunjangan', 'thr', 'bonus', 'allowance', 'bonus akhir tahun'] },
        { key: 'overtime', name: 'Lembur & Insentif', words: ['lembur', 'overtime', 'insentif', 'incentive'] },
      ],
    },
    {
      systemKey: 'freelance',
      name: 'Bisnis & Toko',
      icon: '💻',
      subs: [
        { key: 'goods_sales', name: 'Penjualan Barang Warung/Toko', words: ['penjualan', 'jualan', 'warung', 'toko', 'omzet', 'sales'] },
        { key: 'services', name: 'Jasa & Proyek', words: ['jasa', 'proyek', 'project', 'freelance', 'honor', 'honorarium', 'konsultasi'] },
        { key: 'commission', name: 'Komisi & Afiliasi', words: ['komisi', 'commission', 'afiliasi', 'referal', 'fee'] },
      ],
    },
    {
      systemKey: 'investment_income',
      name: 'Investasi & Pasif',
      icon: '📈',
      subs: [
        { key: 'dividends', name: 'Dividen Saham', words: ['dividen', 'dividend', 'saham', 'stock'] },
        { key: 'deposit_interest', name: 'Bunga Deposito / Tabungan', words: ['bunga', 'deposito', 'tabungan', 'interest', 'reksa dana'] },
        { key: 'capital_gain', name: 'Capital Gain / Crypto', words: ['capital gain', 'crypto', 'bitcoin', 'ethereum', 'emas', 'gold'] },
        { key: 'property_rent', name: 'Sewa Properti', words: ['sewa properti', 'rental', 'kontrakan', 'property'] },
      ],
    },
    {
      systemKey: 'other_income',
      name: 'Pemasukan Lainnya',
      icon: '📦',
      subs: [
        { key: 'reimbursement', name: 'Pengembalian Utang / Reimbursement Patungan', words: ['reimbursement', 'pengembalian', 'patungan', 'balik modal', 'refund'] },
        { key: 'cashback', name: 'Hadiah / Cashback', words: ['cashback', 'hadiah', 'reward', 'voucher', 'poin'] },
        { key: 'secondhand', name: 'Penjualan Barang Bekas', words: ['barang bekas', 'bekas', 'jual barang', 'second hand', 'olshop'] },
      ],
    },
  ],

  transfer: [
    {
      systemKey: 'transfer',
      name: 'Mutasi Antar-Akun',
      icon: '🔄',
      subs: [
        { key: 'bank_transfer', name: 'Transfer Antar-Bank', words: ['transfer', 'trf', 'tf', 'mutasi', 'pindah', 'kirim', 'kiriman'] },
        { key: 'ewallet_topup', name: 'Top-Up E-Wallet (GoPay/OVO/DANA)', words: ['topup', 'top up', 'gopay', 'ovo', 'dana', 'linkaja', 'shopeepay', 'isi saldo'] },
        { key: 'atm_withdrawal', name: 'Tarik Tunai ATM', words: ['tarik tunai', 'withdraw', 'atm', 'cash'] },
        { key: 'cash_deposit', name: 'Setor Tunai', words: ['setor tunai', 'deposit', 'tunai masuk'] },
        { key: 'savings_allocation', name: 'Alokasi Tabungan / Target', words: ['alokasi', 'tabungan', 'target', 'goal', 'menyisihkan'] },
      ],
    },
  ],
};

/**
 * The tree for a kind of transaction.
 *
 * A kind the dictionary does not know about falls back to the
 * expenses, because an expense is what most transactions are.
 */
export function dictionaryFor(type) {
  const key = String(type || 'expense').toLowerCase();
  return CATEGORY_DICTIONARY[key] || CATEGORY_DICTIONARY.expense;
}

/**
 * The sub-categories of one category.
 *
 * The category is looked up by the key the server knows it by, so the
 * dictionary and the database always agree about which category is
 * which.
 */
export function subsFor(systemKey, type = 'expense') {
  const tree = dictionaryFor(type);
  const found = tree.find((cat) => cat.systemKey === systemKey);
  return found ? found.subs : [];
}

/**
 * The category of a system key, in a kind of transaction.
 */
export function categoryFor(systemKey, type = 'expense') {
  const tree = dictionaryFor(type);
  return tree.find((cat) => cat.systemKey === systemKey) || null;
}

/**
 * The label of a category and a sub-category together.
 *
 * "Makanan & Minuman (Kopi & Kafe)" says both what it is and where
 * it sits, so the reader can tell two entries apart in a list.
 */
export function combinedLabel(parentName, subName) {
  if (!subName) return parentName || '';
  if (!parentName) return subName;
  return `${parentName} (${subName})`;
}

export default {
  CATEGORY_DICTIONARY,
  dictionaryFor,
  subsFor,
  categoryFor,
  combinedLabel,
};
