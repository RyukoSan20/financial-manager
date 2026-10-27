// The text for the grouped sidebar, the advanced features, the single
// add button, the onboarding, the month timeline and the reminders.
//
// These are a group, so they live in their own batch and can be moved
// over without touching the other screens. Each language has the same
// key names, so a lookup always finds the same thing.
//
// A component picks the language it needs and reads the plain string
// out of it:
//
//   const { language } = useTranslation();
//   const K = batch6[language]?.a5;
//   <p>{K.sidebar_group_money}</p>

export const batch6 = {
  id: {
    a5: {
      // The groups in the sidebar.
      sidebar_group_money: "Uang",
      sidebar_group_plan: "Rencana",
      sidebar_group_insight: "Wawasan",
      sidebar_group_tools: "Alat",
      sidebar_group_other: "Lainnya",

      // The switch panel.
      switches_title: "Pilihan tampilan",
      switches_intro:
        "Semua ini bisa dimatikan lagi. Yang berubah hanya tampilan, bukan data.",
      switches_nav_v2: "Menu dikelompokkan",
      switches_nav_v2_desc:
        "Menu samping dikelompokkan menurut jenisnya, jadi lebih mudah mencari.",
      switches_single_add: "Satu tombol tambah",
      switches_single_add_desc:
        "Hanya ada satu tombol tambah di setiap halaman, di tempat yang sama.",
      switches_advanced: "Fitur lanjutan",
      switches_advanced_desc:
        "Fitur yang jarang dipakai, seperti Toko dan Peta Pengeluaran, disembunyikan sampai dinyalakan.",
      switches_reminders: "Pengingat",
      switches_reminders_desc:
        "Pengingat dikirim ke peramban. Tidak ada yang dikirim sampai dinyalakan.",
      switches_reset: "Kembalikan semua ke semula",
      switches_reset_done: "Semua pilihan sudah dikembalikan ke semula.",
      switches_on: "Nyala",
      switches_off: "Mati",

      // The advanced features that are hidden.
      advanced_locked_title: "Fitur ini tersembunyi",
      advanced_locked_body:
        "Fitur lanjutan tidak ditampilkan di menu sampai dinyalakan di Pilihan tampilan.",
      advanced_locked_go: "Buka Pilihan tampilan",
      advanced_locked_back: "Kembali",

      // The single add button.
      single_add_label: "Tambah",

      // The onboarding.
      onboarding_welcome_title: "Selamat datang",
      onboarding_welcome_body:
        "Empat langkah singkat untuk mengatur keuanganmu. Bisa dilewati kapan saja.",
      onboarding_step_accounts: "Buat akun",
      onboarding_step_accounts_body:
        "Satu akun untuk uang harian sudah cukup. Akun tambahan bisa dibuat nanti.",
      onboarding_step_budget: "Tentukan anggaran",
      onboarding_step_budget_body:
        "Berapa yang bisa dibelanjakan bulan ini, menurut kategorinya.",
      onboarding_step_recurring: "Catat yang berulang",
      onboarding_step_recurring_body:
        "Sewa, langganan, gaji. Yang muncul tiap bulan.",
      onboarding_step_first: "Catat transaksi pertama",
      onboarding_step_first_body:
        "Satu transaksi saja sudah cukup untuk melihat pola pengeluaran.",
      onboarding_skip: "Lewati",
      onboarding_next: "Lanjut",
      onboarding_back: "Kembali",
      onboarding_finish: "Selesai",
      onboarding_start: "Mulai pengaturan",
      onboarding_dismiss: "Tutup",
      onboarding_step_of: "Langkah {current} dari {total}",
      onboarding_done_title: "Sudah siap",
      onboarding_done_body:
        "Pengaturan selesai. Dasar-dasarnya sudah ada, dan sisanya bisa menyusul.",
      onboarding_go_dashboard: "Ke beranda",

      // The month timeline.
      timeline_title: "Bulan ini",
      timeline_empty: "Belum ada transaksi bulan ini.",
      timeline_income: "Masuk",
      timeline_expense: "Keluar",
      timeline_net: "Selisih",
      timeline_count: "{count} transaksi",
      timeline_day: "Hari {day}",

      // The reminders.
      reminders_title: "Pengingat",
      reminders_intro:
        "Pengingat muncul di peramban, di perangkat ini saja.",
      reminders_permission_needed: "Peramban belum mengizinkan pengingat.",
      reminders_permission_button: "Izinkan pengingat",
      reminders_permission_granted: "Peramban mengizinkan pengingat.",
      reminders_permission_denied: "Peramban menolak pengingat.",
      reminders_frequency: "Seberapa sering",
      reminders_frequency_daily: "Setiap hari",
      reminders_frequency_weekly: "Setiap minggu",
      reminders_frequency_monthly: "Setiap bulan",
      reminders_day_of_week: "Hari",
      reminders_time: "Jam",
      reminders_test: "Kirim satu sekarang",
      reminders_test_sent: "Pengingat percobaan dikirim.",
      reminders_not_enabled:
        "Pengingat belum dinyalakan. Nyalakan di Pilihan tampilan terlebih dahulu.",
      reminders_saved: "Pengingat disimpan.",

      // What the server says should be reminded about.
      reminder_code_payment_due: "Ada yang harus dibayar.",
      reminder_code_budget_exceeded: "Anggaranmu sudah habis.",
      reminder_code_recurring_due: "Ada tagihan berulang yang jatuh tempo.",
      reminder_code_nothing_recorded: "Belum ada transaksi yang dicatat kemarin.",
      reminder_code_nothing_to_say: "Tidak ada yang perlu diingatkan.",
    },
  },

  en: {
    a5: {
      // The groups in the sidebar.
      sidebar_group_money: "Money",
      sidebar_group_plan: "Planning",
      sidebar_group_insight: "Insight",
      sidebar_group_tools: "Tools",
      sidebar_group_other: "Other",

      // The switch panel.
      switches_title: "Display options",
      switches_intro:
        "Every one of these can be turned off again. Only the display changes, not the data.",
      switches_nav_v2: "Grouped menu",
      switches_nav_v2_desc:
        "The side menu is grouped by what it is for, so it is easier to find things.",
      switches_single_add: "One add button",
      switches_single_add_desc:
        "There is one add button on each page, always in the same place.",
      switches_advanced: "Advanced features",
      switches_advanced_desc:
        "Features that are used now and then, such as Shop and Spending Map, are hidden until they are turned on.",
      switches_reminders: "Reminders",
      switches_reminders_desc:
        "Reminders are shown in the browser, on this device only. Nothing is sent until they are turned on.",
      switches_reset: "Put everything back",
      switches_reset_done: "Everything has been put back.",
      switches_on: "On",
      switches_off: "Off",

      // The advanced features that are hidden.
      advanced_locked_title: "This one is hidden",
      advanced_locked_body:
        "Advanced features are not shown in the menu until they are turned on in Display options.",
      advanced_locked_go: "Open Display options",
      advanced_locked_back: "Go back",

      // The single add button.
      single_add_label: "Add",

      // The onboarding.
      onboarding_welcome_title: "Welcome",
      onboarding_welcome_body:
        "Four short steps to set up your finances. You can skip them at any time.",
      onboarding_step_accounts: "Make an account",
      onboarding_step_accounts_body:
        "One account for everyday money. More can be added later.",
      onboarding_step_budget: "Set a budget",
      onboarding_step_budget_body:
        "How much can be spent this month, by category.",
      onboarding_step_recurring: "Note what repeats",
      onboarding_step_recurring_body:
        "Rent, subscriptions, salary. The things that come round each month.",
      onboarding_step_first: "Record your first transaction",
      onboarding_step_first_body:
        "One transaction is enough to start seeing a spending pattern.",
      onboarding_skip: "Skip",
      onboarding_next: "Next",
      onboarding_back: "Back",
      onboarding_finish: "Finish",
      onboarding_start: "Start the setup",
      onboarding_dismiss: "Close",
      onboarding_step_of: "Step {current} of {total}",
      onboarding_done_title: "All set",
      onboarding_done_body:
        "The setup is done. The basics are in place, and the rest can follow.",
      onboarding_go_dashboard: "Go to the dashboard",

      // The month timeline.
      timeline_title: "This month",
      timeline_empty: "No transactions this month yet.",
      timeline_income: "In",
      timeline_expense: "Out",
      timeline_net: "Difference",
      timeline_count: "{count} transactions",
      timeline_day: "Day {day}",

      // The reminders.
      reminders_title: "Reminders",
      reminders_intro:
        "Reminders appear in the browser, on this device only.",
      reminders_permission_needed: "The browser has not allowed reminders yet.",
      reminders_permission_button: "Allow reminders",
      reminders_permission_granted: "The browser allows reminders.",
      reminders_permission_denied: "The browser refused reminders.",
      reminders_frequency: "How often",
      reminders_frequency_daily: "Every day",
      reminders_frequency_weekly: "Every week",
      reminders_frequency_monthly: "Every month",
      reminders_day_of_week: "Day",
      reminders_time: "Time",
      reminders_test: "Send one now",
      reminders_test_sent: "A test reminder was sent.",
      reminders_not_enabled:
        "Reminders are not turned on yet. Turn them on in Display options first.",
      reminders_saved: "Reminders saved.",

      // What the server says should be reminded about.
      reminder_code_payment_due: "There is a payment due.",
      reminder_code_budget_exceeded: "A budget has been used up.",
      reminder_code_recurring_due: "A recurring bill is due.",
      reminder_code_nothing_recorded: "Nothing was recorded yesterday.",
      reminder_code_nothing_to_say: "There is nothing to remind you about.",
    },
  },

  ja: {
    a5: {
      // The groups in the sidebar.
      sidebar_group_money: "お金",
      sidebar_group_plan: "計画",
      sidebar_group_insight: "インサイト",
      sidebar_group_tools: "ツール",
      sidebar_group_other: "その他",

      // The switch panel.
      switches_title: "表示オプション",
      switches_intro:
        "これらはすべて元に戻せます。変わるのは表示だけで、データは変わりません。",
      switches_nav_v2: "メニューをグループ化",
      switches_nav_v2_desc:
        "サイドメニューを用途ごとにまとめるので、探しやすくなります。",
      switches_single_add: "追加ボタンをひとつに",
      switches_single_add_desc:
        "各ページに追加ボタンはひとつだけあり、常に同じ位置にあります。",
      switches_advanced: "高度な機能",
      switches_advanced_desc:
        "ストアや支出マップなど必要になるたびに使う機能は、オンにするまでメニューに出ません。",
      switches_reminders: "リマインダー",
      switches_reminders_desc:
        "リマインダーはこの端末のブラウザにだけ表示されます。オンのままでは何も送られません。",
      switches_reset: "すべて元に戻す",
      switches_reset_done: "すべて元に戻しました。",
      switches_on: "オン",
      switches_off: "オフ",

      // The advanced features that are hidden.
      advanced_locked_title: "この機能は隠されています",
      advanced_locked_body:
        "高度な機能は、表示オプションでオンにするまでメニューに表示されません。",
      advanced_locked_go: "表示オプションを開く",
      advanced_locked_back: "戻る",

      // The single add button.
      single_add_label: "追加",

      // The onboarding.
      onboarding_welcome_title: "ようこそ",
      onboarding_welcome_body:
        "家計を整えるための4つの短いステップです。いつでもスキップできます。",
      onboarding_step_accounts: "口座をつくる",
      onboarding_step_accounts_body:
        "日常のお金用に口座を1つ作れば十分です。",
      onboarding_step_budget: "予算を決める",
      onboarding_step_budget_body:
        "今月、カテゴリーごとに使える金額を決めます。",
      onboarding_step_recurring: "繰り返すものを記録する",
      onboarding_step_recurring_body:
        "家賃、サブスク、給与など、毎月入るものを記録します。",
      onboarding_step_first: "最初の取引を記録する",
      onboarding_step_first_body:
        "取引が1件あるだけで、支出のパターンが見えてきます。",
      onboarding_skip: "スキップ",
      onboarding_next: "次へ",
      onboarding_back: "戻る",
      onboarding_finish: "完了",
      onboarding_start: "設定を始める",
      onboarding_dismiss: "閉じる",
      onboarding_step_of: "ステップ {current} / {total}",
      onboarding_done_title: "準備完了",
      onboarding_done_body:
        "設定は終わりました。基本的なところまで整ったので、あとは少しずつ築いていけます。",
      onboarding_go_dashboard: "ダッシュボードへ",

      // The month timeline.
      timeline_title: "今月",
      timeline_empty: "今月の取引はまだありません。",
      timeline_income: "入金",
      timeline_expense: "出金",
      timeline_net: "差額",
      timeline_count: "{count}件の取引",
      timeline_day: "{day}日",

      // The reminders.
      reminders_title: "リマインダー",
      reminders_intro:
        "リマインダーはこの端末のブラウザにだけ表示されます。",
      reminders_permission_needed: "ブラウザがまだリマインダーを許可していません。",
      reminders_permission_button: "リマインダーを許可する",
      reminders_permission_granted: "ブラウザはリマインダーを許可しています。",
      reminders_permission_denied: "ブラウザがリマインダーを拒否しました。",
      reminders_frequency: "頻度",
      reminders_frequency_daily: "毎日",
      reminders_frequency_weekly: "毎週",
      reminders_frequency_monthly: "毎月",
      reminders_day_of_week: "曜日",
      reminders_time: "時刻",
      reminders_test: "今すぐ1件送る",
      reminders_test_sent: "テストのリマインダーを送りました。",
      reminders_not_enabled:
        "リマインダーはまだオンになっていません。先に表示オプションでオンにしてください。",
      reminders_saved: "リマインダーを保存しました。",

      // What the server says should be reminded about.
      reminder_code_payment_due: "支払いが期限を迎えています。",
      reminder_code_budget_exceeded: "予算を使い切りました。",
      reminder_code_recurring_due: "定期支払いが期限を迎えています。",
      reminder_code_nothing_recorded: "昨日記録がありませんでした。",
      reminder_code_nothing_to_say: "リマインダーする内容はありません。",
    },
  },
};

export default batch6;
