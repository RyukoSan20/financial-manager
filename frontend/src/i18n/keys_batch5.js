// The text for the Indonesian calculators.
//
// These are the screens that work out the things this country has
// its own rules for: the income tax an employer withholds, the sales
// tax, the religious holiday allowance, and the insurance that comes
// out of a salary.
//
// The keys live here, in their own batch, because they are a group
// that can be moved over without touching the other screens. Each
// language has the same key names, so a lookup always finds the same
// thing.
//
// A component picks the language it needs and reads the plain string
// out of it:
//
//   const { language } = useTranslation();
//   const K = batch5[language]?.id_calculators;
//   <p>{K.pph21_title}</p>
//
// This is a plain lookup, not a translator call, so it can never
// blank the page.

export const batch5 = {
  id: {
    id_calculators: {
      // The tab names.
      tab_pph21: 'PPh 21',
      tab_ppn: 'PPN',
      tab_thr: 'THR',
      tab_bpjs: 'BPJS',

      // PPh 21.
      pph21_title: 'Pajak Penghasilan (PPh 21)',
      pph21_subtitle:
        'Pajak penghasilan yang dipotong dari gaji bulanan.',
      pph21_gross: 'Penghasilan Bruto per Bulan',
      pph21_status: 'Status pajak',
      pph21_category: 'Kategori tarif efektif',
      pph21_rate: 'Tarif Efektif',
      pph21_tax: 'PPh 21 per bulan',
      pph21_net: 'Penghasilan bersih',
      pph21_ptkp: 'Penghasilan Tidak Kena Pajak per tahun',
      pph21_annual: 'Pajak setahun',
      pph21_annual_title: 'Pajak setahun dan bulan terakhir',
      pph21_annual_gross: 'Penghasilan bruto per bulan',
      pph21_pension: 'Iuran pensiun yang dibayar sendiri per bulan',
      pph21_zakat: 'Zakat / sumbangan keagamaan per bulan',
      pph21_position_fee: 'Biaya jabatan',
      pph21_taxable: 'Penghasilan kena pajak setahun',
      pph21_total_tax: 'PPh 21 setahun',
      pph21_withheld: 'Sudah dipotong Januari - November',
      pph21_december: 'PPh 21 bulan Desember',
      pph21_daily_title: 'PPh 21 harian',
      pph21_daily_gross: 'Penghasilan bruto harian',
      pph21_daily_note:
        'Sampai Rp 450.000 sehari tidak dipotong. Di atas itu sampai Rp 2.500.000 dipotong 0,5%.',

      // PPN.
      ppn_title: 'Pajak Pertambahan Nilai (PPN)',
      ppn_subtitle:
        'Tarifnya 12%, tetapi barang dan jasa biasa dikenai 11/12 dari harga sehingga pajaknya 11% dari harga.',
      ppn_price: 'Harga sebelum pajak',
      ppn_luxury: 'Barang/jasa mewah (PPN 12% penuh)',
      ppn_base: 'Dasar pengenaan pajak',
      ppn_rate: 'Tarif',
      ppn_tax: 'PPN terutang',
      ppn_total: 'Total dengan PPN',

      // THR.
      thr_title: 'Tunjangan Hari Raya (THR)',
      thr_subtitle:
        'Berlaku bagi pekerja yang sudah setidaknya satu bulan bekerja secara terus menerus.',
      thr_salary: 'Gaji pokok per bulan',
      thr_allowance: 'Tunjangan tetap per bulan',
      thr_months: 'Masa kerja (bulan)',
      thr_result: 'THR yang diterima',
      thr_one_month: 'Satu bulan upah',
      thr_method: 'Cara hitung',
      thr_method_full: 'Satu bulan upah',
      thr_method_proportional: 'dari satu bulan upah',
      thr_method_not_eligible: 'Belum memenuhi syarat masa kerja',
      thr_not_eligible: 'Belum memenuhi syarat masa kerja',

      // The failures.
      calc_error_unknown_status: 'Status pajak itu tidak dikenal.',
      calc_error_unknown_risk: 'Tingkat risiko pekerjaan itu tidak dikenal.',
      calc_error_unknown_category: 'Kategori tarif efektif itu tidak dikenal.',
      calc_error_unknown: 'Perhitungan gagal. Coba lagi.',

      // BPJS.
      bpjs_title: 'Iuran BPJS',
      bpjs_subtitle:
        'Iuran yang dipotong dari gaji, dan bagian yang dibayar perusahaan.',
      bpjs_wage: 'Gaji per bulan',
      bpjs_risk: 'Tingkat risiko kerja',
      bpjs_risk_low: 'Rendah (perkantoran)',
      bpjs_risk_medium: 'Menengah',
      bpjs_risk_high: 'Tinggi (industri berat)',
      bpjs_family: 'Jumlah tanggungan tambahan',
      bpjs_worker: 'Potongan dari pekerja',
      bpjs_employer: 'Dibayar perusahaan',
      bpjs_health: 'BPJS Kesehatan',
      bpjs_health_family: 'BPJS Kesehatan (tanggungan tambahan)',
      bpjs_old_age: 'Jaminan Hari Tua (JHT)',
      bpjs_pension: 'Jaminan Pensiun (JP)',
      bpjs_accident: 'Jaminan Kecelakaan Kerja (JKK)',
      bpjs_death: 'Jaminan Kematian (JKM)',
      bpjs_total: 'Total',
      bpjs_take_home: 'Gaji yang diterima',

      // Shared.
      rule_source: 'Sumber aturan',
      per_month: 'per bulan',
      per_day: 'per hari',
      per_year: 'per tahun',
    },
  },

  en: {
    id_calculators: {
      // The tab names.
      tab_pph21: 'Income Tax',
      tab_ppn: 'VAT',
      tab_thr: 'Holiday Pay',
      tab_bpjs: 'Social Insurance',

      // PPh 21.
      pph21_title: 'Income Tax (PPh 21)',
      pph21_subtitle: 'The income tax withheld from a monthly salary.',
      pph21_gross: 'Gross monthly income',
      pph21_status: 'Tax status',
      pph21_category: 'Effective rate category',
      pph21_rate: 'Effective rate',
      pph21_tax: 'Tax per month',
      pph21_net: 'Net income',
      pph21_ptkp: 'Tax-free allowance per year',
      pph21_annual: 'Annual tax',
      pph21_annual_title: 'The tax for the year, and the last month',
      pph21_annual_gross: 'Gross monthly income',
      pph21_pension: 'Own pension contribution per month',
      pph21_zakat: 'Religious contribution per month',
      pph21_position_fee: 'Position fee',
      pph21_taxable: 'Taxable income for the year',
      pph21_total_tax: 'Tax for the year',
      pph21_withheld: 'Already withheld, January to November',
      pph21_december: 'Tax for December',
      pph21_daily_title: 'Daily income tax',
      pph21_daily_gross: 'Daily gross income',
      pph21_daily_note:
        'Nothing is withheld up to 450,000 a day. Above that and up to 2,500,000, half a percent.',

      // PPN.
      ppn_title: 'Value Added Tax (VAT)',
      ppn_subtitle:
        'The rate is 12%, but ordinary goods are taxed on 11/12 of the price, so the tax paid is 11%.',
      ppn_price: 'Price before tax',
      ppn_luxury: 'Luxury goods (full 12% VAT)',
      ppn_base: 'Tax base',
      ppn_rate: 'Rate',
      ppn_tax: 'Tax payable',
      ppn_total: 'Total with tax',

      // THR.
      thr_title: 'Religious Holiday Allowance (THR)',
      thr_subtitle:
        'Paid to a worker with at least one month of continuous service.',
      thr_salary: 'Basic monthly wage',
      thr_allowance: 'Fixed allowance per month',
      thr_months: 'Months of service',
      thr_result: 'The allowance',
      thr_one_month: 'One month of wages',
      thr_method: 'How it was worked out',
      thr_method_full: 'One month of wages',
      thr_method_proportional: 'of one month of wages',
      thr_method_not_eligible: 'Not enough service to qualify',
      thr_not_eligible: 'Not enough service to qualify',

      // The failures.
      calc_error_unknown_status: 'That tax status is not one of the known ones.',
      calc_error_unknown_risk: 'That risk level is not one of the known ones.',
      calc_error_unknown_category: 'That tax bracket is not one of the known ones.',
      calc_error_unknown: 'The working out failed. Please try again.',

      // BPJS.
      bpjs_title: 'Social Insurance Contributions',
      bpjs_subtitle: 'What comes out of the salary, and what the employer adds.',
      bpjs_wage: 'Monthly wage',
      bpjs_risk: 'Risk level of the work',
      bpjs_risk_low: 'Low (office work)',
      bpjs_risk_medium: 'Medium',
      bpjs_risk_high: 'High (heavy industry)',
      bpjs_family: 'Extra dependants covered',
      bpjs_worker: 'Deducted from the worker',
      bpjs_employer: 'Paid by the employer',
      bpjs_health: 'Health insurance (BPJS Kesehatan)',
      bpjs_health_family: 'Health insurance (extra dependants)',
      bpjs_old_age: 'Old-age savings (JHT)',
      bpjs_pension: 'Pension (JP)',
      bpjs_accident: 'Work accident cover (JKK)',
      bpjs_death: 'Death benefit (JKM)',
      bpjs_total: 'Total',
      bpjs_take_home: 'Take-home pay',

      // Shared.
      rule_source: 'Source of the rule',
      per_month: 'per month',
      per_day: 'per day',
      per_year: 'per year',
    },
  },

  ja: {
    id_calculators: {
      // The tab names.
      tab_pph21: '所得税',
      tab_ppn: '消費税',
      tab_thr: '宗教祭日手当',
      tab_bpjs: '社会保険',

      // PPh 21.
      pph21_title: '所得税（PPh 21）',
      pph21_subtitle: '毎月切り落とされる所得税です。',
      pph21_gross: '月間の課税総所得',
      pph21_status: '税務上の世帯区分',
      pph21_category: '実効税率の区分',
      pph21_rate: '実効税率',
      pph21_tax: '月々の税額',
      pph21_net: '手取り額',
      pph21_ptkp: '年額課税控除額',
      pph21_annual: '年分の税額',
      pph21_annual_title: '年分の税額と最後の月の税額',
      pph21_annual_gross: '月間の課税総所得',
      pph21_pension: '自己負担の年金保険料（月額）',
      pph21_zakat: '宗教寄付金（月額）',
      pph21_position_fee: '役職給与控除',
      pph21_taxable: '年分の課税所得',
      pph21_total_tax: '年分の税額',
      pph21_withheld: '1月から11月までの控除済',
      pph21_december: '12月の税額',
      pph21_daily_title: '日給の所得税',
      pph21_daily_gross: '1日の課税総所得',
      pph21_daily_note:
        '1日45万ルピまで控除はありません。それから250万ルピまで0.5%です。',

      // PPN.
      ppn_title: '消費税（PPN）',
      ppn_subtitle:
        '税率は12%ですが、通常の品目は価格の11/12を課税標準とするため、実質11%です。',
      ppn_price: '税抜きの価格',
      ppn_luxury: '高級品（PPN 12%フル）',
      ppn_base: '課税標準',
      ppn_rate: '税率',
      ppn_tax: '消費税額',
      ppn_total: '税込合計',

      // THR.
      thr_title: '宗教祭日手当（THR）',
      thr_subtitle: '1か月以上の勤続がある労働者に支払われます。',
      thr_salary: '基本給（月額）',
      thr_allowance: '固定手当（月額）',
      thr_months: '勤続月数',
      thr_result: '支給額',
      thr_one_month: '1か月分賃金',
      thr_method: '計算方法',
      thr_method_full: '1か月分賃金',
      thr_method_proportional: '1か月分賃金のうち',
      thr_method_not_eligible: '勤続要件を満たしていません',
      thr_not_eligible: '勤続要件を満たしていません',

      // The failures.
      calc_error_unknown_status: 'その税区分は認識できません。',
      calc_error_unknown_risk: 'その危険度は認識できません。',
      calc_error_unknown_category: 'その課税区分は認識できません。',
      calc_error_unknown: '計算に失敗しました。もう一度お試しください。',

      // BPJS.
      bpjs_title: '社会保険保険料',
      bpjs_subtitle: '賃金から引かれる分と会社が負担する分です。',
      bpjs_wage: '月額賃金',
      bpjs_risk: '事業の危険度',
      bpjs_risk_low: '低（オフィス勤務）',
      bpjs_risk_medium: '中',
      bpjs_risk_high: '高（重工業）',
      bpjs_family: '追加の被扶養者数',
      bpjs_worker: '本人控除',
      bpjs_employer: '会社負担',
      bpjs_health: '健康保険（BPJS Kesehatan）',
      bpjs_health_family: '健康保険（追加の被扶養者）',
      bpjs_old_age: '老齢付年金（JHT）',
      bpjs_pension: '年金（JP）',
      bpjs_accident: '労災保険（JKK）',
      bpjs_death: '死亡保障（JKM）',
      bpjs_total: '合計',
      bpjs_take_home: '手取り額',

      // Shared.
      rule_source: '根拠となる法令',
      per_month: '月額',
      per_day: '日額',
      per_year: '年額',
    },
  },
};

export default batch5;
