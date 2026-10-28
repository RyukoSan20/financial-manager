/**
 * The words for the privacy page's entries.
 *
 * The facts live in `src/data/privacyManifest.js`: which host is
 * reached, whether the reader's own records travel with it, and what
 * that host is. Those are checked against the backend by a test, so
 * they cannot quietly become wrong.
 *
 * The sentences that explain those facts are here, in the three
 * languages, because a reader is entitled to read the page in their
 * own language. The key of each entry is the `id` of the entry in the
 * manifest, so the page looks the words up by the fact it is
 * describing.
 *
 * This is a separate file, in the same way as the other batches, so
 * that the three language files are not made longer for a page that is
 * still being turned on.
 */

export const batch8 = {
  id: {
    privacy_entries: {
      out_advice: {
        who: 'Google',
        what: 'Total, saldo rekening, batas anggaran, kemajuan target, dan total utang.',
        when: 'Ketika pembaca meminta saran dari AI Advisor.',
        why: 'Untuk menjawab pertanyaannya. Angka-angka itu adalah pertanyaannya.',
      },
      out_receipt: {
        who: 'Google',
        what: 'Gambar struk, dan gambar layar tempat struk itu dipindai.',
        when: 'Ketika pembaca memindai struk.',
        why: 'Untuk membaca tulisan dan angkanya dari gambar.',
      },
      out_email: {
        who: 'Google',
        what: 'Pengirim, subjek, dan seribu karakter pertama dari email.',
        when: 'Ketika struk Gmail tidak dapat dibaca oleh parser biasa, dan cara terakhir dipakai.',
        why: 'Untuk mengambil nominal dan nama merchant dari email.',
      },
      out_gmail: {
        who: 'Google',
        what: 'Daftar pesan, dan teks pesan-pesan yang tampak seperti struk.',
        when: 'Ketika pembaca menghubungkan Gmail, dan setelahnya ketika kotak masuk diperiksa.',
        why: 'Untuk mencari struk-struk itu sejak awal.',
      },
      out_location: {
        who: 'OpenStreetMap',
        what: 'Lintang dan bujur, serta nama yang kembali.',
        when: 'Ketika pembaca bertanya di mana sebuah transaksi terjadi.',
        why: 'Untuk mengubah titik di peta menjadi nama tempat.',
      },
      out_maps: {
        who: 'Google',
        what: 'Lintang dan bujur.',
        when: 'Ketika peta ditampilkan untuk sebuah transaksi.',
        why: 'Untuk menggambar petanya.',
      },
      out_currency: {
        who: 'Frankfurter',
        what: 'Mata uang yang diinginkan. Tidak ada apa pun tentang pembaca.',
        when: 'Ketika saldo dalam mata uang lain dijumlahkan.',
        why: 'Untuk tahu berapa nilai satu mata uang dalam mata uang lain.',
      },
      out_market: {
        who: 'Yahoo Finance',
        what: 'Kode saham yang diinginkan. Tidak ada apa pun tentang pembaca.',
        when: 'Ketika halaman pasar dibuka.',
        why: 'Untuk menampilkan harganya.',
      },
      out_search: {
        who: 'Pasar tempat mencari',
        what: 'Kata yang diketik pembaca. Tidak ada apa pun tentang pembaca.',
        when: 'Ketika pembaca mencari sebuah produk.',
        why: 'Untuk menemukan produk itu.',
      },
      out_google_signin: {
        who: 'Google',
        what: 'Proses masuk, serta nama dan alamat email yang kembali bersamanya.',
        when: 'Ketika pembaca masuk dengan Google.',
        why: 'Untuk tahu siapa yang sedang masuk.',
      },
      stays_transactions: {
        what: 'transaksi',
        detail: 'Setiap transaksi, lengkap dengan nominal, kategori, dan catatannya.',
      },
      stays_accounts: {
        what: 'rekening dan saldo',
        detail: 'Rekening Anda, saldonya, dan mata uangnya.',
      },
      stays_budgets: {
        what: 'anggaran dan target',
        detail: 'Batas pengeluarannya, targetnya, dan sejauh mana Anda bilang.',
      },
      stays_recurring: {
        what: 'aturan berulang',
        detail: 'Tagihan dan pemasukan yang disetel untuk berulang.',
      },
      stays_settings: {
        what: 'pengaturan',
        detail: 'Bahasa, tema, aksen, dan mata uang yang ditampilkan.',
      },
      never_whole_records: {
        what: 'Seluruh riwayat catatan Anda',
        detail: 'Saran diberikan total dan nama rekening, anggaran, dan target, bukan daftar transaksi satu per satu.',
      },
      never_bulk: {
        what: 'Catatan Anda sekaligus',
        detail: 'Tidak ada jalur di aplikasi ini yang mengekspor semuanya sekaligus.',
      },
      never_sell: {
        what: 'Catatan Anda kepada orang lain',
        detail: 'Layanan di atas adalah seluruh daftar. Catatan Anda tidak dijual, dan tidak dibagikan kepada pengiklan.',
      },
    },
  },

  en: {
    privacy_entries: {
      out_advice: {
        who: 'Google',
        what: 'The totals, the account balances, the budget limits, the goal progress and the debt total.',
        when: 'When the reader asks the AI Advisor for advice.',
        why: 'To answer the question. The numbers are the question.',
      },
      out_receipt: {
        who: 'Google',
        what: 'The picture of the receipt, and the picture of the screen it was scanned from.',
        when: 'When the reader scans a receipt.',
        why: 'To read the words and the figures off the picture.',
      },
      out_email: {
        who: 'Google',
        what: 'The sender, the subject and the first thousand characters of the email.',
        when: 'When a Gmail receipt cannot be read by the ordinary parsers and the last resort is used.',
        why: 'To pull the amount and the merchant out of the email.',
      },
      out_gmail: {
        who: 'Google',
        what: 'The list of messages, and the text of the ones that look like receipts.',
        when: 'When the reader connects Gmail, and afterwards when the inbox is checked.',
        why: 'To find the receipts in the first place.',
      },
      out_location: {
        who: 'OpenStreetMap',
        what: 'The latitude and longitude, and the name that comes back.',
        when: 'When the reader asks where a transaction happened.',
        why: 'To turn a point on a map into a place name.',
      },
      out_maps: {
        who: 'Google',
        what: 'The latitude and longitude.',
        when: 'When a map is shown for a transaction.',
        why: 'To draw the map.',
      },
      out_currency: {
        who: 'Frankfurter',
        what: 'Which currency is wanted. Nothing about the reader.',
        when: 'When a balance in another currency is added up.',
        why: 'To know what one currency is worth in another.',
      },
      out_market: {
        who: 'Yahoo Finance',
        what: 'Which ticker is wanted. Nothing about the reader.',
        when: 'When the market page is opened.',
        why: 'To show the price.',
      },
      out_search: {
        who: 'The marketplace',
        what: 'The words the reader typed. Nothing about the reader.',
        when: 'When the reader searches for a product.',
        why: 'To find the product.',
      },
      out_google_signin: {
        who: 'Google',
        what: 'The sign-in, and the name and email address that come back with it.',
        when: 'When the reader signs in with Google.',
        why: 'To know who is signing in.',
      },
      stays_transactions: {
        what: 'transactions',
        detail: 'Every transaction, with its amount, its category and its note.',
      },
      stays_accounts: {
        what: 'accounts and balances',
        detail: 'The accounts, their balances and their currencies.',
      },
      stays_budgets: {
        what: 'budgets and goals',
        detail: 'The limits, the targets and how far along they are.',
      },
      stays_recurring: {
        what: 'recurring rules',
        detail: 'The bills and income set up to repeat.',
      },
      stays_settings: {
        what: 'settings',
        detail: 'The language, the theme, the accent and the currency on screen.',
      },
      never_whole_records: {
        what: 'The full history of your records',
        detail: 'The advice is given the totals and the names of the accounts, budgets and goals, not the whole list of transactions one by one.',
      },
      never_bulk: {
        what: 'Your records in bulk',
        detail: 'There is no path in this application that exports everything at once.',
      },
      never_sell: {
        what: 'Your records to anyone else',
        detail: 'The services above are the whole list. Your records are not sold, and they are not shared with an advertiser.',
      },
    },
  },

  ja: {
    privacy_entries: {
      out_advice: {
        who: 'Google',
        what: '合計、口座残高、予算の上限、目標の進捗、負債の合計。',
        when: 'AI Advisor に助言を求めたとき。',
        why: '質問に答えるため。その数字そのものが質問です。',
      },
      out_receipt: {
        who: 'Google',
        what: 'レシートの画像と、スキャンされた画面の画像。',
        when: 'レシートをスキャンしたとき。',
        why: '画像から文字と金額を読み取るため。',
      },
      out_email: {
        who: 'Google',
        what: '送信者、件名、メールの最初の 1000 文字。',
        when: 'Gmail のレシートを通常の解析器が読めず、最後の手段を使うとき。',
        why: 'メールから金額と店名を取り出すため。',
      },
      out_gmail: {
        who: 'Google',
        what: 'メッセージの一覧と、レシートのように見えるものの本文。',
        when: 'Gmail を接続したとき、およびそのあと受信箱を確認するとき。',
        why: 'まずレシートを見つけるため。',
      },
      out_location: {
        who: 'OpenStreetMap',
        what: '緯度と経度、および返ってきた地名。',
        when: '取引がどこで起きたかを聞いたとき。',
        why: '地図上の点を地名に変えるため。',
      },
      out_maps: {
        who: 'Google',
        what: '緯度と経度。',
        when: '取引の地図を表示するとき。',
        why: '地図を描くため。',
      },
      out_currency: {
        who: 'Frankfurter',
        what: 'どの通貨が必要か。読者の情報は何も含まない。',
        when: '別通貨の残高を集計するとき。',
        why: 'ある通貨が別通貨でいくらになるかを知るため。',
      },
      out_market: {
        who: 'Yahoo Finance',
        what: 'どのティッカーが必要か。読者の情報は何も含まない。',
        when: '市場ページを開いたとき。',
        why: '価格を表示するため。',
      },
      out_search: {
        who: 'KERANJANGAN',
        what: '読者が入力した語。読者の情報は何も含まない。',
        when: '商品を検索したとき。',
        why: '商品を見つけるため。',
      },
      out_google_signin: {
        who: 'Google',
        what: 'サインインと、それに返ってきた名前とメールアドレス。',
        when: 'Google でサインインしたとき。',
        why: '誰がサインインしているかを知るため。',
      },
      stays_transactions: {
        what: '取引',
        detail: 'すべての取引。金額、カテゴリ、メモまで。',
      },
      stays_accounts: {
        what: '口座と残高',
        detail: '口座、残高、通貨まで。',
      },
      stays_budgets: {
        what: '予算と目標',
        detail: '上限、目標、そしてそこまでの進み具合。',
      },
      stays_recurring: {
        what: '繰り返しルール',
        detail: '繰り返しに設定した請求と収入。',
      },
      stays_settings: {
        what: '設定',
        detail: '言語、テーマ、アクセント、画面に表示する通貨。',
      },
      never_whole_records: {
        what: '記録の完全な履歴',
        detail: '助言には合計と口座・予算・目標の名だけが渡され、取引の一覧は一件ずつ渡されません。',
      },
      never_bulk: {
        what: '記録の一括での扱い',
        detail: 'このアプリにはすべてを一度に書き出す経路がありません。',
      },
      never_sell: {
        what: '他者への記録の開示',
        detail: '上記のサービスがすべてです。記録は販売されず、広告主にも共有されません。',
      },
    },
  },
};

export default batch8;
