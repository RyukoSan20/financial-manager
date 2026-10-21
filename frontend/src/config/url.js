// Centralized API URL helpers.
//
// VITE_API_URL is expected to INCLUDE the `/api` prefix, e.g.
//   https://my-financial-manager.online/api
//
// Two helpers are exported:
//   apiUrl(path)  -> joins the API base (with /api) + path
//   siteUrl(path) -> joins the site origin (no /api) + path
//
// The siteUrl helper exists for endpoints that are mounted on the backend
// WITHOUT the /api prefix (e.g. /realtime/summary, /health) and for
// same-origin static assets. Previously several files hand-rolled
// `.replace(/\/api$/, '')` which silently produced /api/api/... URLs.

const RAW_BASE = import.meta.env.VITE_API_URL || 'https://my-financial-manager.online/api';

// Normalize: strip trailing slashes, ensure exactly one trailing /api
function normalizeBase(raw) {
  let base = String(raw).trim().replace(/\/+$/, '');
  if (!base.endsWith('/api')) {
    base = `${base}/api`;
  }
  return base;
}

/** API base URL including the /api prefix, no trailing slash. */
export const API_BASE_URL = normalizeBase(RAW_BASE);

/** Site origin without the /api prefix, no trailing slash. */
export const SITE_BASE_URL = API_BASE_URL.replace(/\/api$/, '');

/**
 * Build a full API URL from a path.
 * apiUrl('/me') -> https://my-financial-manager.online/api/me
 * apiUrl('me')  -> https://my-financial-manager.online/api/me
 */
export function apiUrl(path = '') {
  if (!path) return API_BASE_URL;
  const clean = String(path).replace(/^\/+/, '');
  return clean ? `${API_BASE_URL}/${clean}` : API_BASE_URL;
}

/**
 * Build a URL against the site origin (no /api prefix).
 * siteUrl('/realtime/summary') -> https://my-financial-manager.online/realtime/summary
 */
export function siteUrl(path = '') {
  if (!path) return SITE_BASE_URL;
  const clean = String(path).replace(/^\/+/, '');
  return clean ? `${SITE_BASE_URL}/${clean}` : SITE_BASE_URL;
}

export default API_BASE_URL;
