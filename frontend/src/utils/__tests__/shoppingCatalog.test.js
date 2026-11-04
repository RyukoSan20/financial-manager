/**
 * The product catalog, and what it says about a price.
 *
 * A product card shows a price. Two kinds of price can end up on a
 * card: one that came from a live search, which is a price in a
 * shop, and one that came from the reader's own catalogue, which is
 * a reference price they set.
 *
 * The difference matters. A reader who sees a reference price and
 * thinks it is a price in a shop will decide to buy something they
 * cannot afford. So where the price came from travels with the
 * product all the way onto the board, and the card says which one it
 * is showing.
 *
 * Run with: node src/utils/__tests__/shoppingCatalog.test.js
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');

const { buildWishlistPayload, priceOf, isShopPrice } = await import(
  path.join(ROOT, 'src/utils/shoppingCatalog.js')
);

/* --- a price from a search -------------------------------------------- */

const searched = {
  title: 'Indomie Goreng',
  price_idr: 3500,
  merchant_source: 'Shopee',
  product_url: 'https://shopee.co.id/product/123',
  image_url: 'https://cdn.example/indomie.jpg',
  source: 'provider',
  description_snippet: 'Mi instan goreng',
};

const payload = buildWishlistPayload(searched);
assert.strictEqual(payload.name, 'Indomie Goreng');
assert.strictEqual(payload.price, 3500);
assert.strictEqual(payload.marketplace, 'Shopee');
assert.strictEqual(payload.stage, 'wishlist');
assert.strictEqual(payload.price_source, 'provider');
assert.ok(isShopPrice(searched), 'a price from a search is a price in a shop');

/* --- a price from the reader's own catalogue ---------------------------- */

const own = {
  title: 'Beras Premium',
  price_idr: 68000,
  merchant_source: 'Tokopedia',
  source: 'own_catalog',
};

const ownPayload = buildWishlistPayload(own);
assert.strictEqual(ownPayload.price_source, 'own_catalog');
assert.ok(!isShopPrice(own), 'a price from the catalogue is not a price in a shop');

// The price source travels with it. This is the whole point: once the
// thing is on the board, the two must not be confused.
assert.notStrictEqual(ownPayload.price_source, payload.price_source);

/* --- the price is read whichever way it was spelled --------------------- */

assert.strictEqual(priceOf({ price_idr: 3500 }), 3500);
assert.strictEqual(priceOf({ price: 3500 }), 3500);
assert.strictEqual(priceOf({ unit_price: 3500 }), 3500);
assert.strictEqual(priceOf({}), null);
assert.strictEqual(priceOf(null), null);

// The rupiah has no cents that anybody spends.
assert.strictEqual(priceOf({ price_idr: 3500.7 }), 3501);

/* --- nothing is invented ---------------------------------------------- */

// A product with no price has no price. It is not zero.
const bare = buildWishlistPayload({ title: 'Tanpa Harga' });
assert.strictEqual(bare.price, null);
assert.strictEqual(bare.marketplace, null);
assert.strictEqual(bare.price_source, null);

// A product with no title still has a name, so that the server does
// not refuse the whole request.
const nameless = buildWishlistPayload({ price_idr: 1000 });
assert.strictEqual(nameless.name, '');

/* --- the text is cut to what fits -------------------------------------- */

// The columns are finite. A name that is too long is shortened
// rather than the request being refused.
const long = buildWishlistPayload({
  title: 'x'.repeat(400),
  merchant_source: 'y'.repeat(200),
  product_url: `https://example.com/${'z'.repeat(900)}`,
  image_url: `https://example.com/${'w'.repeat(900)}`,
  description: 'q'.repeat(900),
});

assert.strictEqual(long.name.length, 255);
assert.strictEqual(long.marketplace.length, 50);
assert.strictEqual(long.product_url.length, 500);
assert.strictEqual(long.image_url.length, 500);
assert.strictEqual(long.notes.length, 500);

console.log('shopping catalog: all checks passed');
