import { useState, useEffect, useCallback, useRef } from 'react';
import { Package, Plus, Search, Upload, Trash2, AlertTriangle } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { batch12 } from '../../i18n/keys_batch12';
import { toast } from '../../contexts/ToastContext';
import merchantApi from '../../services/merchantApi';
import { formatCurrency } from '../../utils/format';
import MascotCompanion from '../common/MascotCompanion';
import MerchantCapturePanel from './MerchantCapturePanel';

/**
 * The shelf.
 *
 * A warung owner knows their goods by heart, but a freelance studio
 * has forty lines of consulting work and a company that sells across
 * borders has a thousand. So the shelf is a list of things, each with
 * its photograph, its price, how much of it is left, and the unit it
 * is counted in.
 *
 * The unit matters. One dozen eggs is not twelve eggs when the price
 * is per dozen. The shelf says which unit a thing is counted in, and
 * says so out loud, because a reader who guesses wrong will sell a
 * thing at the wrong price.
 */

const EMPTY = {
  name: '',
  sku: '',
  category: '',
  unit_of_measure: 'pcs',
  unit_price: '',
  stock_quantity: '',
  image_url: '',
};

const UNITS = ['pcs', 'pcs', 'renceng', 'lusin', 'dus', 'box', 'sak', 'kg', 'gram', 'liter', 'botol'];

function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number(String(value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function MerchantProductCatalog({ merchant }) {
  const { language } = useTranslation();
  const K = batch12[language]?.merchant || batch12.id.merchant;

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [query, setQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef(null);

  const load = useCallback(async () => {
    if (!merchant?.id) return;
    try {
      const data = await merchantApi.listProducts(merchant.id);
      setProducts(Array.isArray(data) ? data : []);
    } catch {
      toast.error(K.catalog.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [merchant?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const startNew = () => {
    setEditing('new');
    setForm(EMPTY);
  };

  const startEdit = (product) => {
    setEditing(product.id);
    setForm({
      name: product.name || '',
      sku: product.sku || '',
      category: product.category || '',
      unit_of_measure: product.unit_of_measure || 'pcs',
      unit_price: String(product.unit_price ?? ''),
      stock_quantity: String(product.stock_quantity ?? ''),
      image_url: product.image_url || '',
    });
  };

  const cancel = () => {
    setEditing(null);
    setForm(EMPTY);
  };

  const pickPicture = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !merchant?.id) return;

    setUploading(true);
    try {
      const result = await merchantApi.uploadProductImage(merchant.id, file);
      setForm((current) => ({ ...current, image_url: result.image_url }));
      toast.success(K.catalog.pictureSaved);
    } catch (error) {
      toast.error(error?.message || K.catalog.pictureFailed);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error(K.catalog.nameRequired);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim() || null,
        category: form.category.trim() || null,
        unit_of_measure: form.unit_of_measure || 'pcs',
        unit_price: toNumber(form.unit_price),
        stock_quantity: toNumber(form.stock_quantity),
        image_url: form.image_url.trim() || null,
        is_active: true,
      };

      if (editing === 'new') {
        await merchantApi.createProduct(merchant.id, payload);
        toast.success(K.catalog.saved);
      } else {
        await merchantApi.updateProduct(merchant.id, editing, payload);
        toast.success(K.catalog.saved);
      }
      cancel();
      await load();
    } catch (error) {
      toast.error(error?.message || K.catalog.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (product) => {
    try {
      await merchantApi.retireProduct(merchant.id, product.id);
      toast.success(K.catalog.removed);
      await load();
    } catch (error) {
      toast.error(error?.message || K.catalog.removeFailed);
    }
  };

  const shown = products.filter((product) => {
    if (!query.trim()) return true;
    const needle = query.trim().toLowerCase();
    return (
      (product.name || '').toLowerCase().includes(needle) ||
      (product.sku || '').toLowerCase().includes(needle) ||
      (product.category || '').toLowerCase().includes(needle)
    );
  });

  return (
    <section className="merchant-catalog">
      <header className="merchant-catalog__bar">
        <div className="merchant-catalog__search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={K.catalog.searchPlaceholder}
            aria-label={K.catalog.searchPlaceholder}
          />
        </div>
        <button
          type="button"
          className="merchant-catalog__add"
          onClick={startNew}
          disabled={editing !== null}
        >
          <Plus size={16} aria-hidden="true" />
          <span>{K.catalog.addProduct}</span>
        </button>
      </header>

      {/* Taking a product off a photograph. It sits above the form
          because it is the quicker way to get a product in, and the
          form is the slower one that is always there. */}
      <MerchantCapturePanel merchant={merchant} onSaved={load} />

      {editing !== null && (
        <div className="merchant-catalog__form">
          <div className="merchant-catalog__picture">
            {form.image_url ? (
              <img src={form.image_url} alt={form.name || K.catalog.pictureOf} />
            ) : (
              <span className="merchant-catalog__picture-empty">
                <Package size={22} aria-hidden="true" />
              </span>
            )}
            <button
              type="button"
              className="merchant-catalog__upload"
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
            >
              <Upload size={14} aria-hidden="true" />
              <span>{uploading ? K.catalog.uploading : K.catalog.choosePicture}</span>
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={pickPicture}
              hidden
            />
          </div>

          <div className="merchant-catalog__fields">
            <label>
              <span>{K.catalog.name}</span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              <span>{K.catalog.sku}</span>
              <input
                type="text"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
              />
            </label>
            <label>
              <span>{K.catalog.category}</span>
              <input
                type="text"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
            </label>
            <label>
              <span>{K.catalog.unit}</span>
              <select
                value={form.unit_of_measure}
                onChange={(e) => setForm({ ...form, unit_of_measure: e.target.value })}
              >
                {[...new Set(UNITS)].map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{K.catalog.price}</span>
              <input
                type="number"
                min="0"
                step="1"
                value={form.unit_price}
                onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
              />
            </label>
            <label>
              <span>{K.catalog.stock}</span>
              <input
                type="number"
                min="0"
                step="1"
                value={form.stock_quantity}
                onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
              />
            </label>
          </div>

          <div className="merchant-catalog__actions">
            <button type="button" onClick={cancel} disabled={saving}>
              {K.catalog.cancel}
            </button>
            <button type="button" onClick={save} disabled={saving} className="is-primary">
              {saving ? K.catalog.saving : K.catalog.save}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="merchant-catalog__note">{K.catalog.loading}</p>
      ) : shown.length === 0 ? (
        <div className="merchant-catalog__empty">
          <MascotCompanion mood="shopkeeper" size={56} message={K.catalog.emptyShelf} />
          <p>{query.trim() ? K.catalog.noMatch : K.catalog.emptyShelf}</p>
          {!query.trim() && (
            <button type="button" onClick={startNew}>
              {K.catalog.addProduct}
            </button>
          )}
        </div>
      ) : (
        <ul className="merchant-catalog__grid">
          {shown.map((product) => {
            const out = toNumber(product.stock_quantity) <= 0;
            return (
              <li key={product.id} className="merchant-catalog__item">
                <div className="merchant-catalog__thumb">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} loading="lazy" />
                  ) : (
                    <Package size={20} aria-hidden="true" />
                  )}
                </div>
                <div className="merchant-catalog__body">
                  <h4>{product.name}</h4>
                  <p className="merchant-catalog__price">
                    {formatCurrency(toNumber(product.unit_price))}
                    <span className="merchant-catalog__unit">/{product.unit_of_measure}</span>
                  </p>
                  <p className={`merchant-catalog__stock${out ? ' is-out' : ''}`}>
                    {out ? (
                      <>
                        <AlertTriangle size={12} aria-hidden="true" />
                        <span>{K.catalog.outOfStock}</span>
                      </>
                    ) : (
                      <span>
                        {K.catalog.stockLeft}: {toNumber(product.stock_quantity)} {product.unit_of_measure}
                      </span>
                    )}
                  </p>
                </div>
                <div className="merchant-catalog__row-actions">
                  <button type="button" onClick={() => startEdit(product)}>
                    {K.catalog.edit}
                  </button>
                  <button type="button" onClick={() => remove(product)} aria-label={K.catalog.remove}>
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
