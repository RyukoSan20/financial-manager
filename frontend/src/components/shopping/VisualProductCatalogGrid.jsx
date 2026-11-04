/*
 * The visual product catalogue.
 *
 * The shopping page was a Kanban board: seven columns of cards that
 * each held a line of text. A reader looking for a laptop cannot tell
 * one laptop from another by the name of a shop, so the grid of
 * things to look at has to be a grid of pictures.
 *
 * This is that grid. Each card carries the picture, the name, the
 * description, the price in rupiah, and the shop it came from.
 *
 * The one thing this grid must not do is lie about a price.
 *
 * A price that came from a live search is a price in a shop. A price
 * that came from the reader's own catalogue is a reference price they
 * wrote down once. They look the same on a screen and they are not
 * the same thing, so the card says which one it is - and when the
 * answer came from the local catalogue, the card says so on its own
 * face rather than only in a note at the top of the page.
 */

import { useState } from 'react';
import { ExternalLink, Package, Star } from 'lucide-react';
import { formatRupiah } from '../../utils/money';
import { buildWishlistPayload, isReferencePrice, isShopPrice } from '../../utils/shoppingCatalog';
import { useTranslation } from '../../i18n';
import { api } from '../../services/api';

/**
 * The name of a marketplace, and the colour it wears.
 *
 * The colour is only ever a hint. A reader who cannot tell orange
 * from green still reads the name underneath it.
 */
const MARKET_STYLE = {
  shopee: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  tokopedia: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  lazada: 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  blibli: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  tiktok: 'bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
};

const marketStyle = (name) =>
  MARKET_STYLE[String(name || '').toLowerCase()] ||
  'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200';

/**
 * The picture of a product.
 *
 * A picture that cannot be loaded is not a broken card. It falls back
 * to a drawing of a box, and the reader still gets the name, the
 * price and the shop.
 */
const CatalogPicture = ({ src, title }) => {
  const [broken, setBroken] = useState(false);

  if (!src || broken) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800">
        <Package className="w-8 h-8 text-gray-400" aria-hidden="true" />
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
 * One card.
 *
 * `product` is one of the results the search returned. The `source`
 * says where the whole answer came from, and it is what tells the
 * card whether the price is a price in a shop or a reference price
 * of the reader's own.
 */
const ProductCard = ({ product, source, onSave, saving }) => {
  const { t } = useTranslation();

  // The card and the thing it saves to the board use the same rule,
  // so that what the reader was told and what is written down are
  // the same thing.
  const isLocal = isReferencePrice({ ...product, source: product.source ?? source });
  const price = product.price_idr ?? product.price ?? product.unit_price ?? null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col">
      <div className="aspect-square overflow-hidden bg-gray-50 dark:bg-gray-800">
        <CatalogPicture src={product.image_url} title={product.title || product.name} />
      </div>

      <div className="p-3 flex-1 flex flex-col gap-1.5">
        <div className="text-xs font-semibold text-gray-900 dark:text-gray-100 line-clamp-2">
          {product.title || product.name}
        </div>

        {product.description_snippet || product.description ? (
          <p className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-2">
            {product.description_snippet || product.description}
          </p>
        ) : null}

        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-bold text-primary-600 dark:text-primary-400 tabular-nums">
            {formatRupiah(price)}
          </span>
          {product.original_price > price ? (
            <span className="text-[10px] text-gray-400 line-through">
              {formatRupiah(product.original_price)}
            </span>
          ) : null}
        </div>

        {/* Where the price came from. It is said on the card, because a
            card can be looked at on its own. */}
        {isLocal ? (
          <span className="self-start text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
            {t('shopping_catalog.price_reference')}
          </span>
        ) : source === 'own_shop' ? (
          <span className="self-start text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200">
            {t('shopping_catalog.price_own_shop')}
          </span>
        ) : null}

        {product.discount_badge ? (
          <span className="self-start text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {product.discount_badge}
          </span>
        ) : null}

        <div className="flex items-center justify-between gap-1 mt-auto">
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${marketStyle(product.merchant_source)}`}>
            {product.store_name || product.merchant_source || t('shopping_catalog.shop')}
          </span>
          {product.rating ? (
            <span className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-0.5">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" aria-hidden="true" />
              {product.rating}
            </span>
          ) : null}
        </div>

        <div className="flex gap-1.5 mt-1">
          <button
            type="button"
            onClick={() => onSave(product)}
            disabled={saving}
            className="flex-1 px-2 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-[11px] font-medium"
          >
            {t('shopping_catalog.save_to_wishlist')}
          </button>
          {product.product_url ? (
            <a
              href={product.product_url}
              target="_blank"
              rel="noopener noreferrer"
              title={t('shopping_catalog.open')}
              className="px-2 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-[11px] font-medium inline-flex items-center gap-1"
            >
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              {t('shopping_catalog.open')}
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
};

/**
 * The grid.
 *
 * `products` are the results. `source` is where the answer came from:
 * `provider` for a live search, `local_catalog` for the reader's own
 * catalogue. `onSave` is what happens when the reader wants a thing
 * on their board.
 */
export default function VisualProductCatalogGrid({
  products = [],
  source = 'provider',
  onSave,
  saving = false,
  className = '',
}) {
  const { t } = useTranslation();

  if (!products || products.length === 0) return null;

  const isLocal = source === 'local_catalog';

  return (
    <section className={className}>
      {/* Where the prices came from, said once for the whole grid. */}
      <div
        className={`p-2.5 rounded-lg text-xs border ${
          isLocal
            ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
            : source === 'own_shop'
              ? 'bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-200'
              : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
        }`}
      >
        {isLocal
          ? t('shopping_catalog.local_source')
          : source === 'own_shop'
            ? t('shopping_catalog.own_shop_source')
            : t('shopping_catalog.live_source')}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-3">
        {products.map((product, index) => (
          <ProductCard
            key={`${product.title || product.name || 'product'}-${index}`}
            product={product}
            source={source}
            onSave={onSave}
            saving={saving}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * Save a thing to the board's wishlist stage.
 *
 * The board already knows how to take an item: `POST /shopping/items`
 * with the name, the price, the shop, the link and the picture. The
 * `price_source` is carried across, so a price from the reader's own
 * catalogue is never later shown as a price in a shop.
 */
export async function saveProductToWishlist(product) {
  await api.request('/shopping/items', {
    method: 'POST',
    body: JSON.stringify(buildWishlistPayload(product)),
  });
}

export { VisualProductCatalogGrid, ProductCard, CatalogPicture };
