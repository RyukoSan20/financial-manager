// The catalogue of the shops and products the user buys at.
//
// The receipt scanner learns these on its own: the name of the shop,
// what it sells, and a guess at the category. The guess is often right
// and sometimes wrong, and when it is wrong the user can change it.
//
// The icon is the part the user cares about most, so it is a picker
// rather than a text field. The picker has 168 icons in ten groups, and
// it searches as the user types.
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, Store, Package, ChevronRight, X, Check, Sparkles, Plus,
} from 'lucide-react';
import { api } from '../services/api';
import { formatCurrency } from '../utils/format';

const MERCHANT_TYPES = [
  { value: '', label: 'Semua jenis' },
  { value: 'minimarket', label: 'Minimarket' },
  { value: 'supermarket', label: 'Supermarket' },
  { value: 'apotek', label: 'Apotek' },
  { value: 'restoran', label: 'Restoran' },
  { value: 'cafe', label: 'Kafe' },
  { value: 'elektronik', label: 'Elektronik' },
  { value: 'rumah tangga', label: 'Rumah tangga' },
  { value: 'lainnya', label: 'Lainnya' },
];

const DEFAULT_MERCHANT_ICON = '🏪';
const DEFAULT_PRODUCT_ICON = '📦';

export const CatalogPage = () => {
  const [tab, setTab] = useState('merchants');
  const [merchants, setMerchants] = useState([]);
  const [products, setProducts] = useState([]);
  const [iconGroups, setIconGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [groups, shopList, productList] = await Promise.all([
        api.request('/catalog/icons'),
        api.request('/catalog/merchants'),
        api.request('/catalog/products'),
      ]);
      setIconGroups(groups || []);
      setMerchants(shopList || []);
      setProducts(productList || []);
    } catch (e) {
      setError(e.message || 'Gagal memuat katalog');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredMerchants = useMemo(() => {
    const needle = search.toLowerCase();
    return merchants.filter((m) => {
      if (typeFilter && m.merchant_type !== typeFilter) return false;
      if (!needle) return true;
      return (
        (m.name || '').toLowerCase().includes(needle) ||
        (m.merchant_type || '').toLowerCase().includes(needle)
      );
    });
  }, [merchants, search, typeFilter]);

  const filteredProducts = useMemo(() => {
    const needle = search.toLowerCase();
    if (!needle) return products;
    return products.filter(
      (p) =>
        (p.name || '').toLowerCase().includes(needle) ||
        (p.canonical_name || '').toLowerCase().includes(needle) ||
        (p.category || '').toLowerCase().includes(needle)
    );
  }, [products, search]);

  const saveMerchant = async (id, changes) => {
    try {
      const updated = await api.request(`/catalog/merchants/${id}`, {
        method: 'PUT',
        body: JSON.stringify(changes),
      });
      setMerchants((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...updated } : m))
      );
      setEditing(null);
    } catch (e) {
      setError(e.message || 'Gagal menyimpan toko');
    }
  };

  const saveProduct = async (id, changes) => {
    try {
      const updated = await api.request(`/catalog/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify(changes),
      });
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...updated } : p))
      );
      setEditing(null);
    } catch (e) {
      setError(e.message || 'Gagal menyimpan produk');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      <div className="bg-accent text-white p-4 sticky top-0 z-10">
        <h1 className="text-xl font-bold">📦 Katalog</h1>
        <p className="text-xs opacity-90 mt-1">
          Toko dan produk yang dipelajari dari struk. Ikon dan kategori bisa
          Anda pilih sendiri.
        </p>
      </div>

      <div className="p-4 max-w-3xl mx-auto space-y-4">
        {error && (
          <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* The two kinds */}
        <div className="flex gap-2">
          <button
            onClick={() => setTab('merchants')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition ${
              tab === 'merchants'
                ? 'bg-accent text-white'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'
            }`}
          >
            <Store className="w-4 h-4" />
            Toko ({merchants.length})
          </button>
          <button
            onClick={() => setTab('products')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition ${
              tab === 'products'
                ? 'bg-accent text-white'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'
            }`}
          >
            <Package className="w-4 h-4" />
            Produk ({products.length})
          </button>
        </div>

        {/* The search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === 'merchants' ? 'Cari toko...' : 'Cari produk...'}
            className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
          />
        </div>

        {/* The type filter, only for the shops */}
        {tab === 'merchants' && (
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
          >
            {MERCHANT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        )}

        {loading ? (
          <div className="text-center py-10 text-gray-400 text-sm">Memuat...</div>
        ) : tab === 'merchants' ? (
          <div className="space-y-2">
            {filteredMerchants.length === 0 && (
              <EmptyState
                title="Belum ada toko"
                text="Toko muncul otomatis setelah struk pertama Anda discan."
              />
            )}
            {filteredMerchants.map((merchant) => (
              <MerchantRow
                key={merchant.id}
                merchant={merchant}
                iconGroups={iconGroups}
                onSave={(changes) => saveMerchant(merchant.id, changes)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredProducts.length === 0 && (
              <EmptyState
                title="Belum ada produk"
                text="Produk muncul otomatis setelah struk pertama Anda discan."
              />
            )}
            {filteredProducts.map((product) => (
              <ProductRow
                key={product.id}
                product={product}
                iconGroups={iconGroups}
                onSave={(changes) => saveProduct(product.id, changes)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const EmptyState = ({ title, text }) => (
  <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-xl">
    <div className="text-3xl mb-2">📭</div>
    <div className="text-sm font-medium text-gray-700 dark:text-gray-200">
      {title}
    </div>
    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{text}</div>
  </div>
);

const MerchantRow = ({ merchant, iconGroups, onSave }) => {
  const [open, setOpen] = useState(false);
  const [icon, setIcon] = useState(merchant.icon || DEFAULT_MERCHANT_ICON);
  const [type, setType] = useState(merchant.merchant_type || '');

  useEffect(() => {
    setIcon(merchant.icon || DEFAULT_MERCHANT_ICON);
    setType(merchant.merchant_type || '');
  }, [merchant.id, merchant.icon, merchant.merchant_type]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-3 text-left"
      >
        <span className="text-2xl w-10 text-center">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {merchant.name}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {merchant.merchant_type || 'Tanpa kategori'} · {merchant.product_count}{' '}
            produk · {merchant.scan_count} kali
          </div>
        </div>
        <ChevronRight
          className={`w-4 h-4 text-gray-400 transition-transform ${
            open ? 'rotate-90' : ''
          }`}
        />
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3 border-t border-gray-100 dark:border-gray-700 pt-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">
              Kategori toko
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
            >
              {MERCHANT_TYPES.filter((t) => t.value).map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <IconPicker
            groups={iconGroups}
            value={icon}
            onChange={setIcon}
            suggestSource={merchant.name}
          />

          <button
            onClick={() => onSave({ icon, merchant_type: type || null })}
            className="w-full py-2 rounded-lg bg-accent text-white text-sm font-medium"
          >
            Simpan
          </button>
        </div>
      )}
    </div>
  );
};

const ProductRow = ({ product, iconGroups, onSave }) => {
  const [open, setOpen] = useState(false);
  const [icon, setIcon] = useState(product.icon || DEFAULT_PRODUCT_ICON);
  const [name, setName] = useState(product.canonical_name || product.name);
  const [category, setCategory] = useState(product.category || '');

  useEffect(() => {
    setIcon(product.icon || DEFAULT_PRODUCT_ICON);
    setName(product.canonical_name || product.name);
    setCategory(product.category || '');
  }, [product.id, product.icon, product.canonical_name, product.name, product.category]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-3 text-left"
      >
        <span className="text-2xl w-10 text-center">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {product.canonical_name || product.name}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {product.category || 'Tanpa kategori'}
            {product.typical_price
              ? ` · ${formatCurrency(product.typical_price)}`
              : ''}
            {product.purchase_count > 0
              ? ` · ${product.purchase_count}x dibeli`
              : ''}
          </div>
        </div>
        <ChevronRight
          className={`w-4 h-4 text-gray-400 transition-transform ${
            open ? 'rotate-90' : ''
          }`}
        />
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3 border-t border-gray-100 dark:border-gray-700 pt-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">
              Nama yang ditampilkan
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">
              Kategori
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Contoh: Minuman, Makanan, Kebutuhan Rumah"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
            />
          </div>

          <IconPicker
            groups={iconGroups}
            value={icon}
            onChange={setIcon}
            suggestSource={product.name}
          />

          <button
            onClick={() =>
              onSave({
                icon,
                canonical_name: name,
                category: category || null,
              })
            }
            className="w-full py-2 rounded-lg bg-accent text-white text-sm font-medium"
          >
            Simpan
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * The icon picker.
 *
 * The whole list is fetched once and searched in the browser, so the
 * picker works without another round trip. The list comes from the
 * backend, so the web app and the scanner describe things the same way.
 */
const IconPicker = ({ groups, value, onChange, suggestSource }) => {
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  // The icons that fit the name, asked of the backend because it knows
  // the keyword list.
  useEffect(() => {
    if (!suggestSource) return;
    let cancelled = false;
    api
      .request('/catalog/icons/suggest', {
        method: 'POST',
        body: JSON.stringify({ text: suggestSource }),
      })
      .then((data) => {
        if (!cancelled && data?.suggestions) {
          setSuggestions(data.suggestions.slice(0, 6));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [suggestSource]);

  const filtered = useMemo(() => {
    const needle = search.toLowerCase().trim();
    const flat = groups.flatMap((g) => g.icons || []);
    if (!needle) return flat;
    return flat.filter(
      (icon) =>
        icon.label.toLowerCase().includes(needle) ||
        icon.value === needle ||
        (icon.keywords || []).some((k) => k.includes(needle))
    );
  }, [groups, search]);

  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">
        Ikon
      </label>

      {suggestions.length > 0 && !search && (
        <div className="mb-2">
          <div className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400 mb-1">
            <Sparkles className="w-3 h-3" />
            Disarankan
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {suggestions.map((icon) => (
              <button
                key={icon.value}
                onClick={() => onChange(icon.value)}
                title={icon.label}
                className={`w-9 h-9 rounded-lg text-xl flex items-center justify-center border-2 ${
                  value === icon.value
                    ? 'border-accent bg-accent-soft'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                {icon.value}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="relative mb-2">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari ikon..."
          className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs"
        />
      </div>

      <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 p-2">
        {filtered.length === 0 ? (
          <div className="text-xs text-gray-400 text-center py-3">
            Tidak ada ikon yang cocok
          </div>
        ) : (
          <div className="flex gap-1.5 flex-wrap">
            {filtered.map((icon) => (
              <button
                key={`${icon.group}-${icon.value}`}
                onClick={() => onChange(icon.value)}
                title={`${icon.label} (${icon.group_label})`}
                className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center border transition ${
                  value === icon.value
                    ? 'border-accent bg-accent-soft'
                    : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                {icon.value}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CatalogPage;
