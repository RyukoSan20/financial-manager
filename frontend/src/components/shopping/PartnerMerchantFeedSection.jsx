/*
 * The shops of the reader.
 *
 * A reader who runs a shop is also a reader who buys things, and the
 * two halves of the application have been kept apart: the shelf of
 * the shop lives under `/merchant`, and the board of what to buy
 * lives under `/shopping`. So a reader cannot see their own products
 * among the things they are thinking of buying.
 *
 * This is that: the products of the reader's own shops, in the same
 * grid as everything else, drawn from the shelf that already exists.
 * Nothing is copied and nothing is kept in a second place - the grid
 * reads the shelf, so a thing that is taken off the shelf stops being
 * offered here too.
 *
 * The price shown is the price the reader set for their own goods. It
 * is their price, not a market price, and the card says so.
 */

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Store } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { toast } from '../../contexts/ToastContext';
import merchantApi from '../../services/merchantApi';
import VisualProductCatalogGrid, { saveProductToWishlist } from './VisualProductCatalogGrid';

/**
 * The products of a shop, in the shape the catalogue grid reads.
 *
 * The shelf calls a price a `unit_price`, and the grid calls it a
 * price. The shop's name is the source of the card, because a reader
 * looking at their own shelf wants to know which shop each thing is
 * from.
 */
const toCatalogProduct = (product, shop, describe) => ({
  title: product.name,
  image_url: product.image_url || null,
  price_idr: product.unit_price ?? null,
  merchant_source: shop?.store_name || null,
  store_name: shop?.store_name || null,
  // The shelf says what a thing is and what a selling unit is. That
  // is the description of a thing on a shelf: there is no copy.
  description_snippet: describe(product),
  product_url: null,
  source: 'own_shop',
});

export default function PartnerMerchantFeedSection({ onSaved, limit = 24 }) {
  const { t } = useTranslation();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  /* What the shelf says about a thing.
   *
   * A product on a shelf has a category and a selling unit, and no
   * copy. The description is written from those two, so it is said in
   * the language of the reader. */
  const describe = useCallback(
    (product) => {
      const parts = [];
      if (product.category) parts.push(product.category);
      if (product.unit_of_measure) {
        parts.push(
          t('shopping_catalog.unit', '', { unit: product.unit_of_measure })
        );
      }
      if (product.sku) parts.push(`SKU ${product.sku}`);
      return parts.length > 0 ? parts.join(' · ') : null;
    },
    [t]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const shops = await merchantApi.listMerchants();
      const list = Array.isArray(shops) ? shops : shops?.data || [];

      // The shelf of each shop is asked for in turn, because the shelf
      // is per shop. A shop that cannot be read is skipped rather than
      // taking the whole section down with it.
      const collected = [];
      for (const shop of list) {
        if (!shop?.id) continue;
        try {
          const shelf = await merchantApi.listProducts(shop.id, false);
          const things = Array.isArray(shelf) ? shelf : shelf?.data || [];
          things.forEach((thing) => collected.push(toCatalogProduct(thing, shop, describe)));
        } catch (err) {
          console.error('The shelf of a shop could not be read:', err);
        }
      }

      setProducts(collected.slice(0, limit));
    } catch (err) {
      console.error('The shops could not be read:', err);
      setError(err.message || t('shopping_catalog.partner_error'));
    } finally {
      setLoading(false);
    }
  }, [describe, limit, t]);

  useEffect(() => {
    load();
  }, [load]);

  const saveToBoard = async (product) => {
    setSaving(true);
    try {
      await saveProductToWishlist({ ...product, source: 'own_shop' });
      toast.success(t('shopping_catalog.saved_to_wishlist'));
      if (onSaved) onSaved(product);
    } catch (err) {
      console.error('Saving to the board failed:', err);
      toast.error(t('shopping_catalog.save_failed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-500 dark:text-gray-400">
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        {t('shopping_catalog.partner_loading')}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-300">
        {error}
      </div>
    );
  }

  if (products.length === 0) return null;

  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <Store className="w-4 h-4 text-gray-500 dark:text-gray-400" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {t('shopping_catalog.partner_title')}
        </h2>
      </div>

      <VisualProductCatalogGrid
        products={products}
        source="own_shop"
        onSave={saveToBoard}
        saving={saving}
      />
    </section>
  );
}

export { PartnerMerchantFeedSection, toCatalogProduct };
