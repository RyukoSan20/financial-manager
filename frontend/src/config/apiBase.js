/**
 * The address of the backend.
 *
 * The base is read from the build. When the module is loaded outside a
 * bundler, as the tests do, there is no build to read it from, and the
 * address falls back to the one that is written here.
 *
 * The rules are the same in both cases:
 *
 * - the base always ends in exactly one "/api", because the backend
 *   serves its routes under that prefix,
 * - a path that already starts with "/api" is not given a second one.
 */

/**
 * The base address, without a trailing slash.
 */
export function normalizeBase(raw) {
  let base = String(raw || '').trim().replace(/\/+$/, '');
  if (!base) return '';
  if (!base.endsWith('/api')) {
    base = `${base}/api`;
  }
  return base;
}

/**
 * The address of a path on the backend.
 */
export function buildApiUrl(base, path) {
  const clean = String(path || '').replace(/^\/+/, '');
  return `${normalizeBase(base)}/${clean}`;
}
