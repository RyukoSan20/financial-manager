/**
 * Comprehensive Indonesian category seed dictionary
 * Based on system_key for easy mapping
 * Includes brand names and generic terms
 */

export const SEED_CATEGORIES = {
  // =====================
  // FOOD & BEVERAGE
  // =====================
  food_drink: {
    system_key: 'food_drink',
    name: 'Makanan & Minuman',
    brand: [
      // Fast Food
      'mcdonalds', 'macdonald', 'mcd', 'kfc', 'kentucky', 'burger king', 'burgerking', 'bk',
      'jco', 'japanese cake', 'dunkin', 'dunkin donuts', 'starbucks', 'sbux',
      'hokben', 'hoka hoka bento', 'pizza hut', 'pizzahut', 'dominos', 'domino pizza',
      'subway', 'wendys', 'popeyes', 'royal chicken', 'cfc',
      'bread talk', 'breadtalk', 'lotus bakery',
      // Coffee & Tea
      'kopikuro', 'kopisoi', 'warkop', 'warung kopi', 'commongrounds',
      'cappuccino', 'espresso', 'latte', 'americano', 'mocha', 'flat white',
      'bubble tea', 'bobba', 'boba', 'milk tea', 'thai tea',
      'filosofi kopi', 'djournal', 'kopi oey', 'tuku',
      // Indonesian Food
      'bakso', 'bakso solo', 'bakmi', 'mie ayam', 'soto', 'soto ayam', 'soto betawi',
      'nasi goreng', 'nasgor', 'nasi padang', 'nasi uduk', 'nasi kuning', 'nasi liwet',
      'rendang', 'sate', 'sate ayam', 'sate taichan', 'sate padang',
      'gudeg', 'gudeg yu djum',
      'rawon', 'pecel', 'lalapan', 'lalap', 'karedok',
      'martabak', 'martabak manis', 'martabak asin',
      'batagor', 'siomay', 'pempek', 'cilok', 'cilok bumbu kacang',
      'bubur', 'bubur ayam', 'bubur kacang hijau',
      'ketoprak', 'lontong', 'opor', 'opor ayam', 'sayur lodeh',
      'kerak telor', 'mie aceh', 'mie rebus', 'kwetiau',
      'es teh', 'teh manis', 'es jeruk', 'jeruk', 'air mineral', 'aqua',
      'es cream', 'es krim', 'es gelato', 'puding', 'klepon', 'lupis',
      'dimsum', 'hakau', 'lumpia', 'risol', 'risoles', 'pastel',
      'pisang goreng', 'pisang crispy', 'pisang keju', 'pisang molen',
      'tahu gejrot', 'cimol', 'cireng',
      'keripik singkong', 'keripik tempe', 'keripik tahu',
      'nugget', 'sosis', 'makaroni',
      'donat', 'churros', 'croffle', 'roti', 'roti bakar',
      'es cendol', 'es teler', 'es buah', 'cendol', 'dawet',
      'kolak', 'cenil', 'kue lapis', 'kue', ' kue tart',
    ],
    generic: [
      'makan', 'makan siang', 'makan malam', 'sarapan', 'brunch', 'dinner', 'lunch',
      'minum', 'minuman', 'kopi', 'teh', 'susu', 'air',
      'daging', 'ayam', 'ikan', 'seafood', 'udang', 'cumi',
      'nasgor', 'nasi', 'mie', 'kwetiau', 'bihun', 'pasta',
      'gorengan', 'fried', 'grilled', 'baked', 'steamed',
      'restaurant', 'cafe', 'warung', 'kedai', 'stall',
      'delivery', 'takeaway', 'dine in', 'grabfood', 'gofood', 'shopeefood',
    ],
    avoid: ['teh', 'air']
  },

  // =====================
  // SHOPPING / GROCERIES
  // =====================
  shopping: {
    system_key: 'shopping',
    name: 'Belanja',
    brand: [
      // Modern Retail
      'indomaret', 'indom', 'alfamart', 'alfamidi',
      'carrefour', 'hypermart', 'giant', 'transmart', 'tmart',
      'hero', 'hero supermarket', 'cold storage',
      'superindo', 'ranch market', 'ranch',
      // Online Marketplace
      'shopee', 'tokopedia', 'tokped', 'lazada', 'blibli',
      'bukalapak', 'tiktok shop', 'tiktok',
      'zalora', 'amazon', 'ebay',
      // Grocery
      'sembako', 'beras', 'gula', 'garam', 'minyak', 'telur',
      'susu bubuk', 'susu cair', 'susu kental manis',
      'kecap', 'saos', 'bumbu', 'masako', 'royco',
      'sari roti', 'sariwangi', 'kapal api',
      // Household
      'sabun', 'shampo', 'odol', 'pasta gigi', 'sikat gigi',
      'tisu', 'popok', 'pembalut', 'diaper',
      'obat', 'paracetamol', 'vitamin', 'suplemen',
      'obat batuk', 'obat flu', 'obat maag', 'obat masuk angin',
      // Electronics
      'charger', 'kabel', 'headset', 'earphone', 'speaker',
      'powerbank', 'casing', 'tempered glass', 'screen protector',
      'flashdisk', 'memory card', 'mouse', 'keyboard',
    ],
    generic: [
      'belanja', 'beli', 'pembelian', 'groceries', 'grocery',
      'barang', 'barang kebutuhan', 'kebutuhan', 'rutinitas',
      'supermarket', 'minimarket', 'toko', 'warung',
      'pasaran', 'belanja online', 'online shopping',
    ],
    avoid: []
  },

  // =====================
  // TRANSPORTATION
  // =====================
  transportation: {
    system_key: 'transportation',
    name: 'Transportasi',
    brand: [
      // Ride Hailing
      'grab', 'grabcar', 'grabbike', 'grabfood', 'grabpay',
      'gojek', 'go ride', 'go car', 'go food', 'gopay',
      'maxim', 'blue bird', 'bluebird', 'silver bird', 'taxi',
      // Fuel
      'pertalite', 'pertamax', 'shell', 'vpower', 'total',
      'petronas', 'bensin', 'solar',
      // Toll
      'tol', 'jalan tol',
      // Parking
      'parkir', 'parkiran', 'parking', 'valet',
      // Transit
      'mrt', 'krl', 'lrt', 'commuterline',
      'trans jakarta', 'transjakarta', 'busway',
      'angkot', 'bajaj',
      // Rental
      'rental', 'sewa motor', 'sewa mobil',
    ],
    generic: [
      'ojek', 'ojek online', 'taxi', 'transport',
      'bensin', 'premium', 'parkir',
      'krl', 'mrt', 'trans', 'bus', 'kereta',
      'penerbangan', 'bandara', 'stasiun', 'terminal', 'halte',
      'ride', 'car', 'bike', 'motor', 'kendaraan',
    ],
    avoid: ['trans']
  },

  // =====================
  // PULSA & DATA
  // =====================
  bills_utilities: {
    system_key: 'bills_utilities',
    name: 'Pulsa & Data',
    brand: [
      // Providers
      'telkomsel', 'simpati', 'kartu halo', 'as', 'loop',
      'indosat', 'im3', 'mentari',
      'xl', 'axis', 'three', 'tri', 'byu',
      // E-Wallet
      'gopay', 'ovo', 'dana', 'linkaja', 'shopeepay',
      // Internet
      'indihome', 'first media', 'my republic', 'wifi',
      'paket data', 'kuota', 'internet',
      'pulsa', 'token listrik',
      // Utilities
      'pln', 'token pln', 'token listrik', 'listrik',
      'bpjs kesehatan', 'bpjs ketenagakerjaan', 'bpjs',
      'pdam', 'air pdam',
      // Insurance
      'prudential', 'aia', 'allianz', 'manulife',
      // Subscriptions
      'langganan', 'subscription', 'membership',
    ],
    generic: [
      'pulsa', 'data', 'kuota', 'internet', 'paket internet',
      'wifi', 'langganan', 'subscription',
      'topup', 'top up', 'isi ulang',
      'token', 'e-wallet', 'e wallet',
      'listrik', 'air', 'gas', 'telepon',
      'tagihan', 'bill', 'invoice',
      'cicilan', 'angsuran', 'kredit',
      'asuransi', 'premi', 'iuran',
      'kontrak', 'sewa', 'rental',
    ],
    avoid: []
  },

  // =====================
  // HEALTH
  // =====================
  health: {
    system_key: 'health',
    name: 'Kesehatan',
    brand: [
      // Pharmacy
      'apotek', 'pharmacy', 'kimia farma', 'guardian', 'watsons', 'century',
      'panadol', 'bodrex', 'paracetamol', 'biogesic',
      // Healthcare
      'halodoc', 'gohealth', 'alodokter', 'sehatq',
      'dokter', 'rs', 'rumah sakit', 'klinik',
      'vaksin', 'vaksinasi',
      // Fitness
      'gym', 'fitness', 'yoga', 'pilates',
      // Personal Care
      'sunscreen', 'moisturizer', 'skincare', 'beauty',
    ],
    generic: [
      'obat', 'vitamin', 'suplemen', 'obat masuk',
      'dokter', 'medical', 'kesehatan',
      'apotek', 'pharmacy',
      'gym', 'fitness', 'olahraga', 'workout',
      'senam', 'renang',
    ],
    avoid: ['obat']
  },

  // =====================
  // ENTERTAINMENT
  // =====================
  entertainment: {
    system_key: 'entertainment',
    name: 'Hiburan',
    brand: [
      // Streaming
      'netflix', 'spotify', 'youtube premium',
      'disney+', 'disney hotstar', 'hbo max', 'hbo',
      'prime video', 'amazon prime', 'viu', 'wetv',
      // Gaming
      'steam', 'steam wallet', 'epic games', 'fortnite',
      'playstation', 'psn', 'ps plus',
      'mobile legend', 'mobilelegend', 'ml',
      'freefire', 'genshin', 'genshin impact',
      'roblox', 'minecraft', 'pubg',
      // Movies
      'cinema', 'bioskop', 'xxi', 'cgv',
      // Events
      'konser', 'concert', 'festival', 'tiket', 'ticket',
    ],
    generic: [
      'film', 'bioskop', 'cinema', 'movie',
      'game', 'gaming', 'play',
      'streaming', 'nonton', 'watch',
      'hiburan', 'entertainment', 'rekreasi',
      'liburan', 'vacation', 'holiday',
      'musik', 'music',
    ],
    avoid: []
  },

  // =====================
  // FASHION
  // =====================
  fashion: {
    system_key: 'shopping',
    name: 'Fashion',
    brand: [
      // International
      'uniqlo', 'zara', 'hm', 'h&m', 'mango', 'gap',
      'lacoste', 'polo ralph lauren', 'tommy hilfiger', 'calvin klein',
      // Local & Regional
      '3second', 'roughneck', 'cargo',
      'eiger', 'consina', 'bodypack',
      'skechers', 'bata',
      // Bags & Accessories
      'wenger', 'swiss army', 'wildcraft', 'samsonite',
    ],
    generic: [
      'baju', 'pakaian', 'clothes', 'apparel',
      'celana', 'rok', 'dress', 'blouse', 'kemeja',
      'sepatu', 'sandal', 'shoes', 'boots',
      'tas', 'tas ransel', 'backpack',
      'topi', 'hat', 'cap',
      'jam tangan', 'watch', 'smartwatch',
      'kacamata', 'sunglasses',
      'boutique', 'toko baju', 'clothing store',
    ],
    avoid: []
  },

  // =====================
  // GIFTS & DONATIONS
  // =====================
  gift: {
    system_key: 'other_expense',
    name: 'Hadiah & Donasi',
    brand: [
      // E-Gifts
      'gift card', 'google play gift', 'steam wallet',
      // Indonesian Gifts
      'hadiah', 'kado', 'amplop',
      'bunga', 'bouquet', 'standing flower',
      // Donations
      'donasi', 'donation', 'zakat', 'infak', 'sedekah',
      'kitabisa',
    ],
    generic: [
      'hadiah', 'gift', 'kado', 'present',
      'uang', 'cash', 'tunai',
      'donasi', 'sedekah', 'amal',
      'zakat', 'infak', 'wakaf',
    ],
    avoid: []
  },

  // =====================
  // HOUSING
  // =====================
  housing: {
    system_key: 'bills_utilities',
    name: 'Tempat Tinggal',
    brand: [
      // Rent
      'kos', 'kost', 'kostan', 'kosan',
      'kontrakan', 'kontrak',
      'apartemen', 'apart', 'apartment',
    ],
    generic: [
      'kos', 'kost', 'kontrakan', 'sewa',
      'apartemen', 'apartment', 'rumah',
      'deposit', 'uang muka', 'uang tanda jadi',
    ],
    avoid: []
  },

  // =====================
  // INCOME
  // =====================
  //
  // The income is split the way the server splits it, so that "gaji"
  // is not the same category as "dividen". The reader's own money
  // has to be able to say where it came from.
  salary: {
    system_key: 'salary',
    name: 'Gaji & Upah',
    brand: [],
    generic: [
      'gaji', 'salary', 'payroll', 'slip gaji',
      'thr', 'tunjangan', 'bonus', 'bonus akhir tahun',
      'lembur', 'overtime', 'insentif',
    ],
    avoid: ['transfer']
  },

  freelance: {
    system_key: 'freelance',
    name: 'Bisnis & Toko',
    brand: [],
    generic: [
      'freelance', 'proyek', 'project',
      'komisi', 'commission', 'fee',
      'honor', 'honorarium', 'jasa',
      'penjualan', 'jualan', 'omzet',
    ],
    avoid: ['transfer']
  },

  investment_income: {
    system_key: 'investment_income',
    name: 'Investasi & Pasif',
    brand: [],
    generic: [
      'dividen', 'bunga', 'deposito',
      'royalti', 'royalty', 'capital gain', 'crypto',
    ],
    avoid: ['transfer']
  },

  other_income: {
    system_key: 'other_income',
    name: 'Pemasukan Lainnya',
    brand: [],
    generic: [
      'pendapatan', 'income', 'revenue',
      'terima', 'masuk', 'dapat', 'receive',
      'refund', 'cashback', 'rebate',
      'reimbursement', 'pengembalian',
    ],
    avoid: ['transfer']
  },

  // =====================
  // EDUCATION
  // =====================
  education: {
    system_key: 'education',
    name: 'Pendidikan',
    brand: [],
    generic: [
      'buku', 'book', 'alat tulis', 'pulpen', 'kertas',
      'kursus', 'kelas', 'course', 'les', 'bimbel', 'tutor',
      'spp', 'ukt', 'kuliah', 'kampus', 'university',
      'sekolah', 'school',
    ],
    avoid: []
  },

  // =====================
  // TRANSFER
  // =====================
  transfer: {
    system_key: 'transfer',
    name: 'Transfer',
    brand: [
      'transfer', 'trf', 'tf',
      'pindah', 'pindahkan',
      'mutasi', 'mutasi rekening',
      'kirim', 'kiriman',
      'top up', 'topup', 'saldo masuk',
    ],
    generic: [
      'transfer', 'pindah', 'mutasi',
      'kirim uang', 'kirim dana',
      'topup', 'top up', 'isi saldo',
      'withdraw', 'deposit',
      'tarik tunai', 'setor tunai',
      'atm', 'mobile banking', 'internet banking',
    ],
    avoid: []
  },
};

/**
 * Build lookup map for fast matching
 */
export function buildLookupMap(categories) {
  const lookup = new Map();
  
  for (const [key, cat] of Object.entries(categories)) {
    // The key the server knows the category by.
    //
    // The name of the entry in this file is not always the same as
    // the key: "fashion" is a kind of "shopping", and "gift" is a
    // kind of "other_expense". A suggestion that names a key the
    // server has never heard of cannot be looked up, so the category
    // carries its own key and that is the one that is used.
    const systemKey = cat.system_key || key;

    // Add brand terms with high weight (0.9)
    for (const term of cat.brand || []) {
      lookup.set(term.toLowerCase(), {
        system_key: systemKey,
        weight: 0.9,
        type: 'brand'
      });
    }
    
    // Add generic terms with lower weight (0.6)
    for (const term of cat.generic || []) {
      lookup.set(term.toLowerCase(), {
        system_key: systemKey,
        weight: 0.6,
        type: 'generic'
      });
    }
  }
  
  return lookup;
}

export default SEED_CATEGORIES;
