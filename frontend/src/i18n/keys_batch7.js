/**
 * The words for the insights.
 *
 * A separate file, in the same way as the other batches, so that the
 * three language files are not made longer for a feature that is
 * still being turned on.
 *
 * The keys are the same in all three languages, and the three files
 * together are checked by the i18n test.
 */

/**
 * A %s in a word is a hole. Use fill() to put a value in it.
 *
 * The same helper the other batches use, so a sentence with a number
 * in it is written the same way everywhere in this application.
 */
export const fill = (template, ...values) => {
  let cursor = 0;
  return String(template ?? '').replace(/%s/g, () =>
    cursor < values.length ? String(values[cursor++]) : '',
  );
};

export const batch7 = {
  id: {
    insights_title: "Temuan dari catatan Anda",
    insights_subtitle: "Hal-hal yang sudah ada di catatan Anda, tetapi belum pernah ditunjukkan",
    insights_loading: "Mencari temuan...",
    insights_none: "Belum ada temuan. Semua catatan Anda sudah rapi.",
    insights_empty_short: "Tidak ada temuan",

    // A bill paid twice.
    duplicate_title: "Tagihan terbayar dua kali",
    duplicate_desc: "Transaksi dengan jumlah, rekening, dan tanggal yang sama.",
    duplicate_high: "Kemungkinan besar terhitung dua kali",
    duplicate_medium: "Perlu diperiksa",
    duplicate_same_day: "Tanggal sama",
    duplicate_days_apart: "%s hari berlomba",
    duplicate_view: "Lihat transaksi",

    // A subscription that was never set up.
    subscription_title: "Langganan yang belum dicatat",
    subscription_desc: "Pembayaran rutin dari tempat yang sama, tanpa aturan berulang.",
    subscription_months: "Berlangsung %s bulan",
    subscription_total: "Total sudah dibayar: %s",
    subscription_last: "Terakhir: %s",
    subscription_set_up: "Catat sebagai aturan berulang",

    // The balance ahead.
    calendar_title: "Perkiraan saldo sebulan ke depan",
    calendar_desc: "Saldo bergerak mengikuti tagihan dan pemasukan yang sudah diatur.",
    calendar_day: "Saldo hari ini",
    calendar_income: "Masuk",
    calendar_expense: "Keluar",
    calendar_event: "%s · %s",

    // What to buy this month.
    shopping_title: "Saran belanja bulan ini",
    shopping_desc: "Yang biasa Anda beli bulan lalu dan belum dibeli bulan ini.",
    shopping_estimate: "Perkiraan biaya",
    shopping_last_bought: "Terakhir beli: %s",
    shopping_add_to_list: "Tambahkan ke daftar",

    // The page saying what leaves the device.
    privacy_title: "Data Anda dan perangkat Anda",
    privacy_desc: "Apa yang meninggalkan perangkat ini, dan apa yang tidak pernah meninggalkannya.",
    privacy_local_title: "Yang tetap di perangkat",
    privacy_local_desc: "Catatan, anggaran, target, aturan berulang, dan pengaturan Anda.",
    privacy_sent_title: "Yang dikirim keluar, dan ke mana",
    privacy_sent_desc: "Setiap hal yang meninggalkan perangkat ini, apa yang dikirim, dan mengapa.",
    privacy_never_title: "Yang tidak pernah dikirim",
    privacy_never_desc: "Tidak ada catatan yang dikirim ke mana pun tanpa Anda meminta.",
    privacy_placeholder: "Baris ini diisi setelah setiap layanan yang ada diperiksa satu per satu.",
    privacy_on_device: " diproses di perangkat",
  },

  en: {
    insights_title: "What your records already say",
    insights_subtitle: "Things that are already in your records, but have never been pointed out",
    insights_loading: "Looking for findings...",
    insights_none: "No findings. Your records are already in order.",
    insights_empty_short: "No findings",

    duplicate_title: "A bill paid twice",
    duplicate_desc: "Transactions with the same amount, account and date.",
    duplicate_high: "Most likely counted twice",
    duplicate_medium: "Worth checking",
    duplicate_same_day: "Same day",
    duplicate_days_apart: "%s days apart",
    duplicate_view: "See the transactions",

    subscription_title: "Subscriptions you never set up",
    subscription_desc: "Regular payments from the same place, with no recurring rule behind them.",
    subscription_months: "Running for %s months",
    subscription_total: "Paid in total: %s",
    subscription_last: "Last: %s",
    subscription_set_up: "Set up as a recurring rule",

    calendar_title: "The balance for the month ahead",
    calendar_desc: "The balance moves with the bills and income you have already set up.",
    calendar_day: "Balance today",
    calendar_income: "In",
    calendar_expense: "Out",
    calendar_event: "%s · %s",

    shopping_title: "What to buy this month",
    shopping_desc: "What you bought last month and have not bought this month.",
    shopping_estimate: "Estimated cost",
    shopping_last_bought: "Last bought: %s",
    shopping_add_to_list: "Add to the list",

    privacy_title: "Your data and your device",
    privacy_desc: "What leaves this device, and what never leaves it.",
    privacy_local_title: "What stays on the device",
    privacy_local_desc: "Transactions, budgets, goals, recurring rules and your settings.",
    privacy_sent_title: "What is sent out, and where",
    privacy_sent_desc: "Everything that leaves this device, what is sent, and why.",
    privacy_never_title: "What is never sent",
    privacy_never_desc: "No record is sent anywhere without you asking for it.",
    privacy_placeholder: "This line is filled in once each service has been checked one by one.",
    privacy_on_device: " processed on the device",
  },

  ja: {
    insights_title: "記録がすでに語っていること",
    insights_subtitle: "記録の中にはあるものの、まだleveвается적으로示されていないこと",
    insights_loading: "指摘を探しています...",
    insights_none: "指摘はありません。記録はすでに整っています。",
    insights_empty_short: "指摘なし",

    duplicate_title: "二重払いの可能性がある請求",
    duplicate_desc: "金額、口座、日付がすべて同じ取引。",
    duplicate_high: "二重計上の可能性が高い",
    duplicate_medium: "確認が要ります",
    duplicate_same_day: "同じ日",
    duplicate_days_apart: "%s日差",
    duplicate_view: "取引を見る",

    subscription_title: "登録されていないサブスク",
    subscription_desc: "同じ場所からの定期的な支払いで、繰り返しルールが設定されていません。",
    subscription_months: "%sか月連続",
    subscription_total: "支払総額: %s",
    subscription_last: "最終: %s",
    subscription_set_up: "繰り返しルールとして登録",

    calendar_title: "今後1か月の残高",
    calendar_desc: "設定済みの請求と収入に応じて残高が動きます。",
    calendar_day: "今日の残高",
    calendar_income: "入金",
    calendar_expense: "出金",
    calendar_event: "%s · %s",

    shopping_title: "今月の買い物候補",
    shopping_desc: "先月買い、今年はまだ買っていないもの。",
    shopping_estimate: "概算費用",
    shopping_last_bought: "最終購入: %s",
    shopping_add_to_list: "リストに追加",

    privacy_title: "あなたのデータとデバイス",
    privacy_desc: "この端末から出るもの、そして絶対に出ないもの。",
    privacy_local_title: "端末に留まるもの",
    privacy_local_desc: "取引、予算、目標、繰り返しルール、設定。",
    privacy_sent_title: "外部に送られるものとその先",
    privacy_sent_desc: "この端末から出るすべて、送られる内容、その理由。",
    privacy_never_title: "決して送られないもの",
    privacy_never_desc: "依頼しない記録がどこかへ送られることはありません。",
    privacy_placeholder: "各サービスを一つずつ確認したあとにこの行が埋まります。",
    privacy_on_device: "（端末内で処理）",
  },
};

export default batch7;
