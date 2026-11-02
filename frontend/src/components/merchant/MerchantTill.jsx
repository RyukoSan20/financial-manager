// The till of a shop.
//
// A shop that sells things has a shelf of things, and a till that
// takes the money. Before this, the merchant page was a list of shop
// names with a few numbers on it: there was no shelf, and the money
// that came in was a single amount that nobody could explain.
//
// What is here is the shelf and the till.
//
// The rule of the whole screen is that the client does not compute
// the money. The server works out the total, and the screen asks the
// server what it would come to before the sale is made. So the number
// that is shown is the number that would be written down, and there
// is only one number.
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Package, Plus, Trash2, ShoppingCart, Calculator, X, ImageOff,
} from 'lucide-react';
import { api } from '../../services/api';
import { useTranslation } from '../../i18n';
import { batch11, fill } from '../../i18n/keys_batch11';
import { toast } from '../../contexts/ToastContext';
import { ask } from '../../contexts/ConfirmContext';

/**
 * The picture of a product on the shelf.
 *
 * A picture that cannot be loaded is not a broken shelf. It falls
 * back to a drawing of a box, and the reader still gets the name and
 * the price.
 */
const ShelfPicture = ({ src, title }) => {
  const [broken, setBroken] = useState(false);

  if (!src || broken) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800">
        <Package className="w-7 h-7 text-gray-400" aria-hidden="true" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={title || ''}
      loading="lazy"
      onError={() => setBroken(true)}
      className="w-full h-full object-cover"
    />
  );
};

/**
 * One line of the basket.
 *
 * The line says what the thing is, how many there are, and what the
 * line comes to. The tax is not on the line, because a tax is on the
 * sale and not on the thing: the same thing can be taxed differently
 * depending on who is buying it and where they are.
 */
const BasketLine = ({ line, onChange, onRemove }) => {
  const { language } = useTranslation();
  const K = batch11[language]?.till || batch11.id.till;

  return (
    <div className="flex items-center gap-2 py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="text-sm text-gray-900 dark:text-gray-100 truncate">
          {line.item_name}
        </div>
        <div className="text-[11px] text-gray-500 dark:text-gray-400">
          {formatRupiah(line.unit_price)} × {line.quantity}
        </div>
      </div>

      <input
        type="number"
        min="1"
        value={line.quantity}
        onChange={(e) => onChange(Math.max(1, parseInt(e.target.value, 10) || 1))}
        aria-label={K.quantity}
        className="w-16 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-center"
      />

      <div className="text-sm font-medium w-24 text-right text-gray-900 dark:text-gray-100">
        {formatRupiah(Number(line.gross_amount || 0))}
      </div>

      <button
        onClick={onRemove}
        aria-label={K.remove}
        title={K.remove}
        className="p-1 text-gray-400 hover:text-red-500"
      >
        <Trash2 className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
};

const MerchantTill = ({ merchant, onSold }) => {
  const { language } = useTranslation();
  const K = batch11[language]?.till || batch11.id.till;

  const [products, setProducts] = useState([]);
  const [basket, setBasket] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [estimate, setEstimate] = useState(null);
  const [estimateError, setEstimateError] = useState('');
  const [workingOut, setWorkingOut] = useState(false);
  const [taxRule, setTaxRule] = useState('PPN');

  const [draft, setDraft] = useState({
    name: '',
    sku: '',
    category: '',
    unit_price: '',
    stock_quantity: '',
    unit_of_measure: 'pcs',
    image_url: '',
  });

  const loadProducts = useCallback(async () => {
    if (!merchant?.id) return;
    setLoading(true);
    try {
      const found = await api.request(
        `/business/merchants/${merchant.id}/products?include_inactive=true`
      );
      // A thing that was taken off the shelf is still in the books,
      // because a receipt that names it is a record of what happened.
      // The shelf only shows the things that are still sold.
      setProducts((found || []).filter((product) => product.is_active !== false));
    } catch (err) {
      console.error('The shelf could not be loaded:', err);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [merchant?.id]);

  useEffect(() => {
    loadProducts();
    setBasket([]);
    setEstimate(null);
  }, [loadProducts]);

  // The lines of the basket, in the shape the server wants.
  const lines = useMemo(
    () =>
      basket.map((line) => ({
        item_name: line.name,
        sku: line.sku || null,
        product_id: line.id,
        quantity: String(line.quantity),
        unit_of_measure: line.unit_of_measure || 'pcs',
        unit_price: String(line.unit_price),
      })),
    [basket]
  );

  const addToBasket = (product) => {
    const stock = Number(product.stock_quantity || 0);
    if (stock <= 0) {
      toast.warning(K.out_of_stock);
      return;
    }
    setBasket((prev) => {
      const already = prev.find((line) => line.id === product.id);
      if (already) {
        if (already.quantity + 1 > stock) {
          toast.warning(fill(K.stock_left, stock));
          return prev;
        }
        return prev.map((line) =>
          line.id === product.id ? { ...line, quantity: line.quantity + 1 } : line
        );
      }
      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          sku: product.sku,
          unit_price: product.unit_price,
          unit_of_measure: product.unit_of_measure,
          quantity: 1,
        },
      ];
    });
  };

  const changeQuantity = (id, quantity) => {
    setBasket((prev) =>
      prev.map((line) => (line.id === id ? { ...line, quantity } : line))
    );
  };

  const removeLine = (id) => {
    setBasket((prev) => prev.filter((line) => line.id !== id));
  };

  /**
   * Ask the server what the sale would come to.
   *
   * Nothing is saved. This is the same engine that decides the total
   * of a real sale, so the number on the screen is the number that
   * would be written down.
   */
  const workItOut = async () => {
    if (basket.length === 0) {
      toast.warning(K.empty_basket);
      return;
    }
    setWorkingOut(true);
    setEstimateError('');
    try {
      const answer = await api.request('/business/simulate', {
        method: 'POST',
        body: JSON.stringify({
          merchant_id: merchant.id,
          items: lines,
          taxes: [
            {
              tax_code: taxRule,
              tax_type: taxRule,
              tax_behavior: 'ADDITIVE',
              tax_inclusion: 'EXCLUSIVE',
              tax_category: 'STANDARD',
              country_code: 'ID',
            },
          ],
        }),
      });
      setEstimate(answer);
    } catch (err) {
      console.error('The sale could not be worked out:', err);
      setEstimateError(err.message || K.simulate_failed);
      setEstimate(null);
    } finally {
      setWorkingOut(false);
    }
  };

  const sell = async () => {
    if (basket.length === 0) {
      toast.warning(K.empty_basket);
      return;
    }
    setSaving(true);
    try {
      const sold = await api.request('/business/transactions', {
        method: 'POST',
        body: JSON.stringify({
          merchant_id: merchant.id,
          invoice_type: 'POS_RECEIPT',
          seller_country: 'ID',
          items: lines,
          taxes: [
            {
              tax_code: taxRule,
              tax_type: taxRule,
              tax_behavior: 'ADDITIVE',
              tax_inclusion: 'EXCLUSIVE',
              tax_category: 'STANDARD',
              country_code: 'ID',
            },
          ],
        }),
      });
      toast.success(fill(K.sold, formatRupiah(sold.grand_total)));
      setBasket([]);
      setEstimate(null);
      loadProducts();
      // The day at the top of the page is a different number now. It
      // is told, rather than waiting for the reader to reload the
      // page to find out.
      onSold?.(sold);
    } catch (err) {
      console.error('The sale could not be saved:', err);
      toast.error(K.sell_failed);
    } finally {
      setSaving(false);
    }
  };

  const saveProduct = async () => {
    if (!draft.name.trim()) {
      toast.warning(K.product_name);
      return;
    }
    setSaving(true);
    try {
      await api.request(`/business/merchants/${merchant.id}/products`, {
        method: 'POST',
        body: JSON.stringify({
          name: draft.name.trim(),
          sku: draft.sku || null,
          category: draft.category || null,
          unit_price: draft.unit_price || '0',
          stock_quantity: draft.stock_quantity || '0',
          unit_of_measure: draft.unit_of_measure,
          image_url: draft.image_url || null,
          is_active: true,
        }),
      });
      toast.success(K.saved);
      setShowAdd(false);
      setDraft({
        name: '',
        sku: '',
        category: '',
        unit_price: '',
        stock_quantity: '',
        unit_of_measure: 'pcs',
        image_url: '',
      });
      loadProducts();
    } catch (err) {
      console.error('The thing could not be saved:', err);
      toast.error(K.save_failed);
    } finally {
      setSaving(false);
    }
  };

  const removeProduct = async (product) => {
    const confirmed = await ask({
      message: `${K.remove}: ${product.name}?`,
      tone: 'danger',
    });
    if (!confirmed) return;
    // The route that deletes a thing of a till is not written yet, so
    // the thing is taken off the shelf rather than removed from the
    // books: a receipt that names it is a record of what happened.
    try {
      await api.request(
        `/business/merchants/${merchant.id}/products/${product.id}`,
        {
          method: 'PUT',
          body: JSON.stringify({ is_active: false }),
        }
      );
      toast.success(K.removed);
      loadProducts();
    } catch (err) {
      console.error('The thing could not be removed:', err);
      toast.error(K.remove_failed);
    }
  };

  if (!merchant) {
    return (
      <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
        {K.empty_products_hint}
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-5 gap-4">
      {/* The shelf */}
      <div className="lg:col-span-3 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {K.products}
          </h3>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            {K.add_product}
          </button>
        </div>

        {loading ? (
          <div className="text-sm text-gray-400 py-6 text-center">{K.products}...</div>
        ) : products.length === 0 ? (
          <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-xl">
            <Package className="w-10 h-10 mx-auto text-gray-400 mb-3" aria-hidden="true" />
            <div className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {K.empty_products}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {K.empty_products_hint}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {products.map((product) => {
              const stock = Number(product.stock_quantity || 0);
              return (
                <div
                  key={product.id}
                  className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col"
                >
                  <button
                    onClick={() => addToBasket(product)}
                    className="aspect-square overflow-hidden bg-gray-50 dark:bg-gray-800"
                    title={K.add_to_basket}
                  >
                    <ShelfPicture src={product.image_url} title={product.name} />
                  </button>

                  <div className="p-2 flex-1 flex flex-col gap-1">
                    <div className="text-xs font-medium text-gray-900 dark:text-gray-100 line-clamp-2">
                      {product.name}
                    </div>
                    <div className="text-sm font-bold text-primary-600 dark:text-primary-400">
                      {formatRupiah(product.unit_price)}
                    </div>

                    <div className="flex items-center justify-between mt-auto">
                      <span
                        className={`text-[10px] ${
                          stock <= 0
                            ? 'text-red-500'
                            : stock <= 5
                              ? 'text-amber-500'
                              : 'text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {stock <= 0
                          ? K.out_of_stock
                          : fill(K.stock_left, stock)}
                      </span>
                      <button
                        onClick={() => removeProduct(product)}
                        aria-label={K.remove}
                        className="p-0.5 text-gray-300 hover:text-red-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* The till */}
      <div className="lg:col-span-2 space-y-3">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-3">
            <ShoppingCart className="w-4 h-4 text-primary-600" aria-hidden="true" />
            <h3 className="font-semibold text-gray-900 dark:text-white">{K.basket}</h3>
          </div>

          {basket.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingCart className="w-8 h-8 mx-auto text-gray-300 mb-2" aria-hidden="true" />
              <div className="text-sm text-gray-500 dark:text-gray-400">{K.empty_basket}</div>
              <div className="text-xs text-gray-400 mt-1">{K.empty_basket_hint}</div>
            </div>
          ) : (
            <>
              <div className="max-h-64 overflow-y-auto">
                {basket.map((line) => (
                  <BasketLine
                    key={line.id}
                    line={line}
                    onChange={(quantity) => changeQuantity(line.id, quantity)}
                    onRemove={() => removeLine(line.id)}
                  />
                ))}
              </div>

              {/* The tax that will be charged */}
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                  {K.tax}
                </label>
                <select
                  value={taxRule}
                  onChange={(e) => {
                    setTaxRule(e.target.value);
                    setEstimate(null);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                >
                  <option value="">{K.tax_none}</option>
                  <option value="PPN">{K.tax_ppn} (PPN)</option>
                  <option value="PPNBM">PPNBM</option>
                  <option value="PBJT">PBJT</option>
                </select>
              </div>

              {/* What the server says it would come to */}
              <button
                onClick={workItOut}
                disabled={workingOut}
                className="w-full mt-3 flex items-center justify-center gap-2 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 disabled:opacity-50"
              >
                <Calculator className="w-4 h-4" aria-hidden="true" />
                {workingOut ? '...' : K.simulate}
              </button>

              {estimateError && (
                <div className="mt-2 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-xs">
                  {estimateError}
                </div>
              )}

              {estimate && (
                <div className="mt-3 space-y-1.5 text-sm">
                  {estimate.taxes?.map((tax, index) => (
                    <div key={index} className="flex justify-between text-xs text-gray-600 dark:text-gray-300">
                      <span>
                        {tax.tax_code} ({tax.tax_rate}%)
                      </span>
                      <span>{formatRupiah(tax.tax_amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
                    <span className="text-gray-600 dark:text-gray-300">{K.customer_pays}</span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      {formatRupiah(estimate.totals?.grand_total)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">{K.you_receive}</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatRupiah(estimate.totals?.net_receivable_amount)}
                    </span>
                  </div>
                </div>
              )}

              <button
                onClick={sell}
                disabled={saving}
                className="w-full mt-3 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold disabled:opacity-50"
              >
                {saving ? '...' : K.sell}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Adding a thing */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-primary-600 text-white">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5" aria-hidden="true" />
                <span className="font-semibold">{K.new_product}</span>
              </div>
              <button onClick={() => setShowAdd(false)} className="p-1 hover:bg-white/20 rounded">
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">{K.product_name}</label>
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder={K.product_name_placeholder}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">{K.price}</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={draft.unit_price}
                    onChange={(e) =>
                      setDraft({ ...draft, unit_price: e.target.value.replace(/[^0-9.]/g, '') })
                    }
                    placeholder="0"
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{K.stock}</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={draft.stock_quantity}
                    onChange={(e) =>
                      setDraft({ ...draft, stock_quantity: e.target.value.replace(/[^0-9.]/g, '') })
                    }
                    placeholder="0"
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">{K.sku}</label>
                  <input
                    type="text"
                    value={draft.sku}
                    onChange={(e) => setDraft({ ...draft, sku: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{K.unit}</label>
                  <select
                    value={draft.unit_of_measure}
                    onChange={(e) => setDraft({ ...draft, unit_of_measure: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  >
                    <option value="pcs">pcs</option>
                    <option value="kg">kg</option>
                    <option value="liter">liter</option>
                    <option value="box">box</option>
                    <option value="renceng">renceng</option>
                    <option value="jam">jam</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">{K.image_url}</label>
                <input
                  type="url"
                  value={draft.image_url}
                  onChange={(e) => setDraft({ ...draft, image_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                />
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                  {K.image_hint}
                </p>
              </div>

              <button
                onClick={saveProduct}
                disabled={saving}
                className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium disabled:opacity-50"
              >
                {saving ? '...' : K.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * The price, in rupiah.
 *
 * The number that arrives is a string of decimals from the server, and
 * it is shown with the two places it has, because a price that was
 * rounded on the way to the screen is a price that is no longer the
 * one that was worked out.
 */
const formatRupiah = (value) => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return 'Rp 0';
  const whole = Math.floor(amount);
  const cents = Math.round((amount - whole) * 100);
  const grouped = whole.toLocaleString('id-ID');
  return cents ? `Rp ${grouped},${String(cents).padStart(2, '0')}` : `Rp ${grouped}`;
};

export default MerchantTill;
export { MerchantTill, formatRupiah, ShelfPicture };
