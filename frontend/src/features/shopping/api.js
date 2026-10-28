// Klien API fitur belanja. Memakai klien pusat yang sudah ada.
//
// Klien pusat sudah menambahkan awalan /api (dari VITE_API_URL), jadi
// setiap path di sini ditulis TANPA /api. Jika path-nya diawali /api,
// alamatnya menjadi /api/api/... dan server menjawab 404.
//
// Kelaimat ini hanya menambahkan awalan /api; jadi:
//  - board      -> /api/kanban/board
//  - accounts   -> /api/accounts
//  - categories -> /api/categories
//
// The account and category lists live at the paths with a trailing
// slash. Without it the server answers a redirect, and a redirect that
// the browser follows counts as a second request against the rate
// limit.
import { api } from '../../services/api';

const BASE = '/kanban';
const BASE_ACCOUNTS = '/accounts/';
const BASE_CATEGORIES = '/categories/';

const qs = (params = {}) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== '' && v != null) p.set(k, v);
  });
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const shoppingApi = {
  board: (params) => api.request(`${BASE}/board${qs(params)}`),
  move: (id, body) => api.request(`${BASE}/items/${id}/stage`, { method: 'PATCH', body }),
  purchase: (id, body) => api.request(`${BASE}/items/${id}/purchase`, { method: 'POST', body }),
  report: (params) => api.request(`${BASE}/report${qs(params)}`),
  accounts: () => api.request(BASE_ACCOUNTS),
  categories: () => api.request(BASE_CATEGORIES),
};

export default shoppingApi;
