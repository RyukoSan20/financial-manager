// Fungsi murni untuk state papan. Sengaja tidak mengimpor React agar mudah diuji.

const sumAmount = (items) => items.reduce((t, i) => t + (i.amount || 0), 0);

export const summarize = (items) => ({ count: items.length, total: sumAmount(items) });

// Letakkan `item` di kolom sesuai item.stage (dan cabut dari kolom lain), lalu hitung ulang
// jumlah & total. Dipakai untuk update optimistis maupun menerapkan respons server.
export function withItem(columns, item) {
  return columns.map((col) => {
    const kept = col.items.filter((i) => i.id !== item.id);
    const items = col.key === item.stage ? [...kept, item] : kept;
    return { ...col, items, ...summarize(items) };
  });
}

export function findItem(columns, id) {
  for (const col of columns) {
    const hit = col.items.find((i) => i.id === id);
    if (hit) return hit;
  }
  return null;
}
