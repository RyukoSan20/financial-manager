// Klien API fitur belanja. Memakai klien pusat yang sudah ada.
//
// SESUAIKAN dengan services/api.js milikmu:
//  - cara impor ({ api } atau default)
//  - signature api.request(path, { method, body }); jika klienmu mengharapkan string,
//    bungkus body dengan JSON.stringify
//  - BASE: kalau api.request sudah menambahkan '/api' (dari VITE_API_URL), ubah jadi '/shopping'
//    dan '/accounts', '/categories' — jangan sampai jadi /api/api/...
import { api } from '../../services/api';

const BASE = '/api/kanban';

// VITE_API_URL already includes /api, so use paths without /api prefix
const BASE_ACCOUNTS = '/accounts';
const BASE_CATEGORIES = '/categories';

const qs = (params = {}) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== '' && v != null) p.set(k, v);
  });
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const shoppingApi = {
  board: (params) => api.request(`/api/kanban/board${qs(params)}`),
  move: (id, body) => api.request(`/api/kanban/items/${id}/stage`, { method: 'PATCH', body }),
  purchase: (id, body) => api.request(`/api/kanban/items/${id}/purchase`, { method: 'POST', body }),
  report: (params) => api.request(`/api/kanban/report${qs(params)}`),
  accounts: () => api.request('/accounts'),
  categories: () => api.request('/categories'),
};
