/**
 * The body of the request that saves a thing to the wishlist.
 *
 * A product card and a board item are not the same thing: the card
 * has a picture, a price, a shop and a link, and the board item has
 * four columns with fixed widths. So the card is turned into a board
 * item here, and the text is cut to what fits rather than being
 * refused by the server.
 *
 * The price source is carried across. A price that came from a live
 * search is a price in a shop; a price that came from the reader's
 * own catalogue is a reference price they set. Once the thing is on
 * the board, the two must not be confused, so the fact of which one
 * it is travels with it.
 *
 * It is written here, apart from the sending, so that it can be
 * checked without a server.
 */

/**
 * The body for saving a product to the wishlist stage.
 */
export function buildWishlistPayload(product) {
  const price = product.price_idr ?? product.price ?? product.unit_price ?? null;

  return {
    // The columns are finite, so the text is cut to what fits rather
    // than being refused by the server.
    name: String(product.title || product.name || '').slice(0, 255),
    quantity: 1,
    price: price ? Math.round(Number(price)) : null,
    stage: 'wishlist',
    // The shop name is capped, because the column it goes into is
    // fifty characters wide and a longer name would be refused by
    // the server rather than shortened here.
    marketplace: product.merchant_source
      ? String(product.merchant_source).slice(0, 50)
      : null,
    product_url: product.product_url
      ? String(product.product_url).slice(0, 500)
      : null,
    image_url: product.image_url
      ? String(product.image_url).slice(0, 500)
      : null,
    // Where the price came from, carried across so that a price
    // from the reader's own catalogue is never later shown as a
    // price in a shop.
    price_source: product.source ? String(product.source).slice(0, 30) : null,
    notes: (product.description_snippet || product.description || null)
      ? String(product.description_snippet || product.description).slice(0, 500)
      : null,
  };
}

/**
 * The price of a product, whichever way it was spelled.
 */
export function priceOf(product) {
  const price = product?.price_idr ?? product?.price ?? product?.unit_price ?? null;
  return price === null || price === undefined ? null : Math.round(Number(price));
}

// The places a price can come from.
//
// "provider" is a live search of a marketplace, so it is a price in
// a shop. "local_catalog" is the reader's own catalogue, so it is a
// reference price they set. "own_shop" is a price at a shop in the
// reader's own merchant module, which is a real price in a real
// shop.
const SHOP_PRICE_SOURCES = ['provider', 'own_shop', 'marketplace', 'search'];

/**
 * Whether a price is a price in a shop, or a reference price the
 * reader set.
 *
 * A price that came from a live search is a price in a shop. A price
 * that came from the reader's own catalogue is a reference price they
 * set. The card has to say which one it is showing, because a reader
 * who sees a reference price and thinks it is a price in a shop will
 * decide to buy something they cannot afford.
 */
export function isShopPrice(product) {
  const source = product?.price_source ?? product?.source;
  return SHOP_PRICE_SOURCES.includes(source);
}

/**
 * Whether a price is a reference price from the reader's own
 * catalogue.
 */
export function isReferencePrice(product) {
  const source = product?.price_source ?? product?.source;
  return source === 'local_catalog';
}
