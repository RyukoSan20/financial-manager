/**
 * The words for the companion and the toast.
 *
 * The character says things to the reader about their own money, so
 * the words have to be warm without being silly, and they have to be
 * in the reader's own language.
 *
 * The toast replaces the browser's own `alert`. That dialog was in
 * whatever language the browser was in, or in no language at all, and
 * it stopped the application dead while it was on screen. These
 * words take its place.
 *
 * Every string is in all three languages, so the checks in `scripts/`
 * can hold it to that.
 */

const batch10 = {
  id: {
    moe: {
      title: 'Moe',
      dismiss: 'Kirim Moe pergi',
      toast_dismiss: 'Tutup',
      // The greeting on the dashboard.
      hello: 'Halo! Saya Moe. Saya sudah lihat catatan Anda.',
      // The greeting when the budget holds.
      happy: 'Anggaran Anda aman.',
      // The greeting when the spending has gone over.
      worried: 'Pengeluaran Anda lewat dari anggaran. Ayo lihat.',
      // The greeting in the shop.
      shopkeeper: 'Kasir siap! Mau masukkan apa saja?',
      // The greeting when reading a receipt.
      detective: 'Mari kita baca struk ini bersama.',
      // The toast.
      added_to_wishlist: '%s masuk ke wishlist.',
      moved_to_board: '%s masuk ke papan belanja.',
      saved: 'Tersimpan.',
      save_failed: 'Gagal menyimpan.',
      deleted: 'Dihapus.',
      delete_failed: 'Gagal menghapus.',
      moved: 'Berpindah.',
      move_failed: 'Gagal memindahkan.',
      needs_account: 'Pilih dulu rekeningnya.',
      needs_amount: 'Masukkan nominalnya.',
      invalid_amount: 'Nominalnya belum benar.',
      needs_category: 'Pilih dulu kategorinya.',
      same_account: 'Rekening asal dan tujuan tidak boleh sama.',
      voice_failed: 'Maaf, suaranya tidak terbaca.',
      copy_failed: 'Tidak bisa menyalin. Salin manual saja.',
    },
  },
  en: {
    moe: {
      title: 'Moe',
      dismiss: 'Send Moe away',
      toast_dismiss: 'Close',
      hello: 'Hello! I am Moe. I have been through your records.',
      happy: 'Your budget is safe.',
      worried: 'Your spending has gone over the budget. Let us look.',
      shopkeeper: 'The till is ready! What are we adding?',
      detective: 'Let us read this receipt together.',
      added_to_wishlist: '%s was added to the wishlist.',
      moved_to_board: '%s was added to the shopping board.',
      saved: 'Saved.',
      save_failed: 'Could not save.',
      deleted: 'Deleted.',
      delete_failed: 'Could not delete.',
      moved: 'Moved.',
      move_failed: 'Could not move.',
      needs_account: 'Choose the account first.',
      needs_amount: 'Enter the amount.',
      invalid_amount: 'That amount is not right yet.',
      needs_category: 'Choose the category first.',
      same_account: 'The account and the target cannot be the same.',
      voice_failed: 'Sorry, the voice was not understood.',
      copy_failed: 'Could not copy. Please copy it by hand.',
    },
  },
  ja: {
    moe: {
      title: 'Moe',
      dismiss: 'Moeを送り出す',
      toast_dismiss: '閉じる',
      hello: 'こんにちは！Moeです。記録を見てきました。',
      happy: '予算は大丈夫です。',
      worried: '予算を超える支出があります。見てみましょう。',
      shopkeeper: 'レジの準備ができました！何を入れますか？',
      detective: '一緒にレシートを読みましょう。',
      added_to_wishlist: '%sをウィッシュリストに追加しました。',
      moved_to_board: '%sを買い物ボードに追加しました。',
      saved: '保存しました。',
      save_failed: '保存できませんでした。',
      deleted: '削除しました。',
      delete_failed: '削除できませんでした。',
      moved: '移動しました。',
      move_failed: '移動できませんでした。',
      needs_account: '先に口座を選んでください。',
      needs_amount: '金額を入力してください。',
      invalid_amount: '金額がまだ正しくありません。',
      needs_category: '先にカテゴリを選んでください。',
      same_account: '出金元と同じ口座にはできません。',
      voice_failed: '申し訳ありません、声を聞き取れませんでした。',
      copy_failed: 'コピーできませんでした。手動でコピーしてください。',
    },
  },
};

export default batch10;
export { batch10 };
