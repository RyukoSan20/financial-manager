// The text for the screens that had their messages written into the
// component.
//
// Two screens had messages that only ever appeared in Indonesian,
// whatever language the reader had picked: the text parser and the
// QR scanner. The breakdown viewer had the same problem in a third
// way, with Indonesian messages next to translated ones.
//
// The keys live here for the same reason the other batches are here:
// a group of related screens can be moved over without touching the
// others. Each language has the same key names, so a lookup always
// finds the same thing.
//
// A component picks the language it needs and reads the plain string
// out of it:
//
//   const { language } = useTranslation();
//   const K = batch4[language]?.text_parser;
//   <p>{K.empty_text}</p>
//
// This is a plain lookup, not a translator call, so it can never
// blank the page.

export const batch4 = {
  id: {
    text_parser: {
      load_failed: 'Gagal memuat data:',
      empty_text: 'Masukkan teks terlebih dahulu',
      text_too_short: 'Teks terlalu pendek. Minimal 10 karakter.',
      no_transaction: 'Tidak ada transaksi terdeteksi. Coba format teks yang berbeda.',
      parse_failed: 'Gagal parse:',
      unknown_error: 'Kesalahan tidak diketahui',
      pick_transaction: 'Pilih transaksi terlebih dahulu',
      pick_account: 'Pilih akun terlebih dahulu',
      save_failed: 'Gagal menyimpan:',
      choose_account: 'Pilih Akun',
      from_parsed_text: 'Transaksi dari teks yang dianalisis',
      confirm_error: 'Gagal konfirmasi:',
      examples_title: '💡 Contoh cepat:',
      input_label: 'Teks transaksi',
      placeholder: 'Tempel teks SMS bank, QRIS, GoPay, OVO, Dana, transfer, dll...',
      clear: 'Hapus',
      parsing: 'Menganalisis...',
      parse_now: 'Analisis Sekarang',
      reference: 'Referensi:',
      address: 'Alamat:',
      source: 'Sumber:',
      result_date: '📅 Tanggal',
      copy: 'Salin',
      copied: 'Tersalin',
      delete: 'Hapus',
    },
    qr_scanner: {
      load_failed: 'Gagal memuat kamera:',
      no_camera: 'Tidak ada kamera yang ditemukan',
      scanner_load_failed: 'Gagal memuat scanner QR:',
      permission_denied: 'Izin kamera ditolak. Izinkan akses kamera di pengaturan browser lalu coba lagi.',
      no_camera_device: 'Kamera tidak ditemukan pada perangkat ini.',
      start_failed: 'Gagal memulai kamera:',
      flash_unavailable: 'Flash tidak tersedia di kamera ini',
      torch_failed: 'Gagal menyalakan flash:',
      loading_camera: 'Memuat kamera...',
      unknown_error: 'Kesalahan tidak diketahui',
      stop_warning: 'Peringatan berhenti scanner:',
      start_failed_short: 'Gagal memulai scanner:',
      camera_error: 'Kesalahan kamera:',
    },
    breakdown: {
      load_failed: 'Gagal memuat rincian',
      delete_failed: 'Gagal menghapus baris',
      name_and_amount_required: 'Nama dan nominal harus diisi',
      add_failed: 'Gagal menambah baris',
      add_row: 'Tambah baris',
      empty: 'Belum ada rincian',
      total: 'Total',
    },
    accounts: {
      save_failed: 'Gagal menyimpan akun: ',
      unknown_error: 'Kesalahan tidak diketahui',
    },
    auth_callback: {
      failed: 'Autentikasi gagal: ',
      failed_short: 'Autentikasi gagal',
    },
    gmail_callback: {
      denied: 'Akses Gmail ditolak. Silakan coba lagi.',
      no_code: 'Kode OAuth tidak ditemukan.',
      processing: 'Memproses...',
      connected: 'Gmail berhasil terhubung!',
    },
    register: {
      weak_password: 'Password terlalu lemah. Gunakan kombinasi huruf besar, kecil, angka, dan simbol.',
      failed: 'Registrasi gagal. Email mungkin sudah terdaftar.',
    },
  },

  en: {
    text_parser: {
      load_failed: 'Failed to load data:',
      empty_text: 'Enter some text first',
      text_too_short: 'The text is too short. At least 10 characters.',
      no_transaction: 'No transaction found. Try a different text format.',
      parse_failed: 'Could not read the text:',
      unknown_error: 'Unknown error',
      pick_transaction: 'Pick a transaction first',
      pick_account: 'Pick an account first',
      save_failed: 'Could not save:',
      choose_account: 'Choose Account',
      from_parsed_text: 'Transaction from the parsed text',
      confirm_error: 'Could not confirm:',
      examples_title: '💡 Quick examples:',
      input_label: 'Transaction text',
      placeholder: 'Paste bank SMS, QRIS, GoPay, OVO, Dana, transfer text, etc...',
      clear: 'Clear',
      parsing: 'Parsing...',
      parse_now: 'Parse Now',
      reference: 'Reference:',
      address: 'Address:',
      source: 'Source:',
      result_date: '📅 Date',
      copy: 'Copy',
      copied: 'Copied',
      delete: 'Delete',
    },
    qr_scanner: {
      load_failed: 'Failed to load the camera:',
      no_camera: 'No camera was found',
      scanner_load_failed: 'Could not load the QR scanner:',
      permission_denied: 'Camera permission was denied. Allow camera access in your browser settings and try again.',
      no_camera_device: 'No camera was found on this device.',
      start_failed: 'Could not start the camera:',
      flash_unavailable: 'The flash is not available on this camera',
      torch_failed: 'Could not turn the flash on:',
      loading_camera: 'Loading the camera...',
      unknown_error: 'Unknown error',
      stop_warning: 'Warning while stopping the scanner:',
      start_failed_short: 'Could not start the scanner:',
      camera_error: 'Camera error:',
    },
    breakdown: {
      load_failed: 'Could not load the breakdown',
      delete_failed: 'Could not delete the row',
      name_and_amount_required: 'The name and the amount are both needed',
      add_failed: 'Could not add the row',
      add_row: 'Add a row',
      empty: 'No breakdown yet',
      total: 'Total',
    },
    accounts: {
      save_failed: 'Could not save the account: ',
      unknown_error: 'Unknown error',
    },
    auth_callback: {
      failed: 'Authentication failed: ',
      failed_short: 'Authentication failed',
    },
    gmail_callback: {
      denied: 'Gmail access was denied. Please try again.',
      no_code: 'The OAuth code was not found.',
      processing: 'Processing...',
      connected: 'Gmail is connected!',
    },
    register: {
      weak_password: 'The password is too weak. Use a mix of upper case, lower case, numbers and symbols.',
      failed: 'Could not register. The email may already be in use.',
    },
  },

  ja: {
    text_parser: {
      load_failed: 'データの読み込みに失敗しました：',
      empty_text: '先にテキストを入力してください',
      text_too_short: 'テキストが短すぎます。10文字以上入力してください。',
      no_transaction: '取引が見つかりませんでした。別の形式のテキストをお試しください。',
      parse_failed: '解析に失敗しました：',
      unknown_error: '不明なエラー',
      pick_transaction: '先に取引を選んでください',
      pick_account: '先に口座を選んでください',
      save_failed: '保存に失敗しました：',
      choose_account: '口座を選択',
      from_parsed_text: '解析したテキストからの取引',
      confirm_error: '確認に失敗しました：',
      examples_title: '💡 クイック例：',
      input_label: '取引テキスト',
      placeholder: '銀行のSMS、QRIS、GoPay、OVO、Dana、送金などのテキストを貼り付けてください…',
      clear: 'クリア',
      parsing: '解析中...',
      parse_now: '解析する',
      reference: '参照：',
      address: '住所：',
      source: '出典：',
      result_date: '📅 日付',
      copy: 'コピー',
      copied: 'コピーしました',
      delete: '削除',
    },
    qr_scanner: {
      load_failed: 'カメラの読み込みに失敗しました：',
      no_camera: 'カメラが見つかりませんでした',
      scanner_load_failed: 'QRスキャナーの読み込みに失敗しました：',
      permission_denied: 'カメラの権限が拒否されました。ブラウザの設定でカメラを許可してから再度お試しください。',
      no_camera_device: 'このデバイスにカメラが見つかりませんでした。',
      start_failed: 'カメラを起動できませんでした：',
      flash_unavailable: 'このカメラではフラッシュを使えません',
      torch_failed: 'フラッシュを点灯できませんでした：',
      loading_camera: 'カメラを読み込み中...',
      unknown_error: '不明なエラー',
      stop_warning: 'スキャナーを停止するときの警告：',
      start_failed_short: 'スキャナーを起動できませんでした：',
      camera_error: 'カメラのエラー：',
    },
    breakdown: {
      load_failed: '内訳の読み込みに失敗しました',
      delete_failed: '行を削除できませんでした',
      name_and_amount_required: '名前と金額の両方が必要です',
      add_failed: '行を追加できませんでした',
      add_row: '行を追加',
      empty: '内訳はまだありません',
      total: '合計',
    },
    accounts: {
      save_failed: '口座を保存できませんでした：',
      unknown_error: '不明なエラー',
    },
    auth_callback: {
      failed: '認証に失敗しました：',
      failed_short: '認証に失敗しました',
    },
    gmail_callback: {
      denied: 'Gmailへのアクセスが拒否されました。もう一度お試しください。',
      no_code: 'OAuthコードが見つかりませんでした。',
      processing: '処理中...',
      connected: 'Gmailを接続しました！',
    },
    register: {
      weak_password: 'パスワードが弱すぎます。大文字、小文字、数字、記号を組み合わせてください。',
      failed: '登録できませんでした。メールアドレスが既に使われている可能性があります。',
    },
  },
};

export default batch4;
