import { useCallback, useEffect, useRef, useState } from 'react';
import { shoppingApi } from './api';
import { withItem } from './boardState';

/**
 * State papan belanja.
 * - Perpindahan tahap bersifat optimistis (terasa instan); jika gagal, papan dimuat ulang dari server.
 * - Pencatatan pembelian TIDAK optimistis karena menyangkut uang: UI menunggu respons server.
 * - Respons usang diabaikan (mis. mengetik pencarian cepat) lewat nomor tiket.
 */
export function useShoppingBoard({ month, q }) {
  const [columns, setColumns] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [error, setError] = useState(null);
  const latest = useRef(0);

  const load = useCallback(async () => {
    const ticket = ++latest.current;
    try {
      const data = await shoppingApi.board({ month, q });
      if (ticket !== latest.current) return;
      setColumns(data.columns);
      setError(null);
      setStatus('ready');
    } catch (e) {
      if (ticket !== latest.current) return;
      setError(e?.message || 'Papan belanja gagal dimuat. Periksa koneksi lalu coba lagi.');
      setStatus('error');
    }
  }, [month, q]);

  useEffect(() => {
    load();
  }, [load]);

  const moveItem = useCallback(
    async (item, stage, extra = {}) => {
      setColumns((cols) => withItem(cols, { ...item, stage, allowed_next: [] }));
      try {
        const updated = await shoppingApi.move(item.id, { stage, ...extra });
        setColumns((cols) => withItem(cols, updated));
        return { ok: true };
      } catch (e) {
        load(); // kembalikan ke kondisi server
        return { ok: false, error: e?.message || 'Item gagal dipindahkan. Coba lagi.' };
      }
    },
    [load],
  );

  const purchaseItem = useCallback(async (id, body) => {
    const res = await shoppingApi.purchase(id, body); // error dilempar ke pemanggil
    setColumns((cols) => withItem(cols, res.item));
    return res;
  }, []);

  return { columns, status, error, reload: load, moveItem, purchaseItem };
}
