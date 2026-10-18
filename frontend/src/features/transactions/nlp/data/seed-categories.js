/**
 * Seed category dictionary based on system_key
 * Organized by category type with brand (high weight) and generic terms
 * 
 * system_key: unique identifier for the category
 * brand: brand names (weight 0.9)
 * generic: generic terms (weight 0.6)
 */

export const SEED_CATEGORIES = {
  food: {
    system_key: 'food',
    name: 'Makanan & Minuman',
    brand: [
      'gofood', 'shopeefood', 'grabfood', 'foodpanda',
      'kfc', 'mcdonalds', 'burgerking', 'starbucks', 'coffee',
      'bakmi', 'pizza', 'dominos', 'hokben', 'ichiban',
      'chatime', 'lempuk', 'wedang', 'es teh', 'teh manis'
    ],
    generic: [
      'makan', 'minum', 'sarapan', 'makan siang', 'makan malam',
      'bakso', 'soto', 'nasi goreng', 'nasgor', 'mie ayam',
      'kopi', 'teh', 'jus', 'air mineral', 'warung', 'tempat makan',
      'restoran', 'cafe', 'kedai', 'martabak', 'pecel', 'gudeg',
      'sate', 'rawon', 'rendang', 'sambal', 'lalap'
    ],
    avoid: ['teh'] // ambiguous alone, needs context
  },
  
  transport: {
    system_key: 'transport',
    name: 'Transportasi',
    brand: [
      'grab', 'gojek', 'maxim', 'blue bird', 'taxi',
      'krl', 'krt', 'transjakarta', 'jakarta', 'mrt jakarta',
      'lrt', 'commuterline', 'whoosh'
    ],
    generic: [
      'ojek', 'ojek online', 'ojek gratis', 'parkir', 'bensin',
      'premium', 'pertalite', 'pertamax', 'shell', 'vpower',
      'tol', 'jalan tol', 'gerbang tol', 'penerbitan',
      '下田', '下田', '下田', '下田' // placeholder for stopwords
    ],
    avoid: ['trans'] // too ambiguous
  },
  
  shopping: {
    system_key: 'shopping',
    name: 'Belanja',
    brand: [
      'indomaret', 'alfamart', 'alfamidi', ' Lawson', 'seven eleven',
      'carrefour', 'hypermart', 'giant', 'transmart',
      'minimarket', 'toko kelontong', 'warung kelontong'
    ],
    generic: [
      'belanja', 'beli', 'pembelian', 'groceries', 'sembako',
      'saham', 'obat', 'obat obatan', 'farmasi'
    ],
    avoid: []
  },
  
  pulsa: {
    system_key: 'pulsa',
    name: 'Pulsa & Data',
    brand: [
      'telkomsel', 'simpati', 'as', 'kartu halo',
      'indosat', 'im3', 'axis', 'three', 'xl',
      'gojek', 'grab', 'gopay', 'grabpay'
    ],
    generic: [
      'pulsa', 'data', 'kuota', 'internet', 'paket data',
      'wifi', 'indihome', 'first media', 'my republic'
    ],
    avoid: []
  },
  
  bills: {
    system_key: 'bills',
    name: 'Tagihan',
    brand: [
      'pln', 'bpjs', 'pdam', 'telkom', 'token listrik',
      'bill', 'tagihan'
    ],
    generic: [
      'listrik', 'air', 'iuran', 'cicilan', 'angsuran',
      'kontrak', 'sewa', 'kost', 'kos'
    ],
    avoid: []
  },
  
  health: {
    system_key: 'health',
    name: 'Kesehatan',
    brand: [
      'halodoc', 'gohealth', 'sehatq', 'kimia farma',
      'guardian', 'watsons', ' аптек', 'apotek'
    ],
    generic: [
      'obat', 'vitamin', 'obat masuk', 'dokter', 'rumah sakit',
      'rs', 'klinik', 'medical', 'cek kesehatan', 'medical checkup',
      'gym', 'fitness', 'olahraga', 'renang', 'yoga', 'workout'
    ],
    avoid: []
  },
  
  entertainment: {
    system_key: 'entertainment',
    name: 'Hiburan',
    brand: [
      'netflix', 'spotify', 'disney', 'disney+', 'hbo',
      'youtube', 'playstation', 'steam', 'epic games', 'garena',
      'freefire', 'mobile legends', 'mobilelegend', 'genshin'
    ],
    generic: [
      'film', 'bioskop', 'cinema', 'konser', 'bioskop',
      'game', 'gaming', 'langganan', 'subscription',
      'streaming', 'musik', 'podcast'
    ],
    avoid: []
  },
  
  fashion: {
    system_key: 'fashion',
    name: 'Fashion',
    brand: [
      'shopee', 'lazada', 'blibli', 'tokopedia', 'zalora',
      'uniqlo', 'zara', 'h&m', 'pull&bear', 'bershka',
      'fgm', 'panama', 'cardinal', 'greenlight'
    ],
    generic: [
      'baju', 'pakaian', 'celana', 'sepatu', 'sandal',
      'tas', 'topi', 'jam tangan', 'aksesoris',
      'fashion', 'clothes', 'jersey', 'kaos', 'kemeja'
    ],
    avoid: ['baju'] // needs context from shopping
  },
  
  gift: {
    system_key: 'gift',
    name: 'Hadiah',
    brand: [],
    generic: [
      'hadiah', 'kado', 'gift', 'ulang tahun', 'ulang tahun',
      'pernikahan', 'cathering', 'bunga', ' bouquet'
    ],
    avoid: []
  },
  
  housing: {
    system_key: 'housing',
    name: 'Tempat Tinggal',
    brand: [],
    generic: [
      'kos', 'kost', 'kontrakan', 'sewa', 'rental',
      'apartemen', 'apart', 'rumah', 'hunian',
      'deposit', 'uang muka'
    ],
    avoid: []
  },
  
  income: {
    system_key: 'income',
    name: 'Pendapatan',
    brand: [],
    generic: [
      'gaji', 'slip gaji', 'thr', 'bonus', 'komisi',
      'fee', 'honor', 'proyek', 'freelance', 'pendapatan',
      'terima', 'masuk', 'transfer masuk'
    ],
    avoid: ['transfer'] // too generic
  },
  
  transfer: {
    system_key: 'transfer',
    name: 'Transfer',
    brand: [],
    generic: [
      'transfer', 'tf', 'mutasi', 'pindah', 'kirim',
      'topup', 'top up', 'saldo masuk'
    ],
    avoid: []
  }
};

/**
 * Build lookup map for fast matching
 * @param {Object} categories - Category data
 * @returns {Map<string, {system_key: string, weight: number}>}
 */
export function buildLookupMap(categories) {
  const lookup = new Map();
  
  for (const [key, cat] of Object.entries(categories)) {
    // Add brand terms with high weight
    for (const term of cat.brand || []) {
      lookup.set(term.toLowerCase(), {
        system_key: key,
        weight: 0.9
      });
    }
    
    // Add generic terms with lower weight
    for (const term of cat.generic || []) {
      lookup.set(term.toLowerCase(), {
        system_key: key,
        weight: 0.6
      });
    }
  }
  
  return lookup;
}

export default SEED_CATEGORIES;
