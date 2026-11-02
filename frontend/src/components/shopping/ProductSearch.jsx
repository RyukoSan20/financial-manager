// The grid of things to look at.
//
// The search is the one place in the application where a picture
// matters more than a number. A reader who is looking for a laptop
// recognises the laptop by its shape and its colour, not by the name
// of a shop, so every result carries a picture and the grid is a grid
// of pictures.
//
// The one thing this screen must not do is lie about a price. A
// price that came from a live search is a price in a shop. A price
// that came from the reader's own catalogue is a reference price that
// the reader wrote down once. They look the same on a screen and they
// are not the same thing, so the answer says which one it is, and the
// card says it too.
import { useState, useCallback, useEffect } from 'react';
import { Search, ExternalLink, Star, Package, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import { formatRupiah } from '../../utils/money';
import { useTranslation } from '../../i18n';
import { batch11, fill } from '../../i18n/keys_batch11';
import { toast } from '../../contexts/ToastContext';

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
 * The picture of a result.
 *
 * A picture that cannot be loaded is not a broken card. It falls back
 * to a drawing of a box, and the reader still gets the name, the
 * price and the shop.
 */
const ResultPicture = ({ src, title }) => {
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

const ProductSearch = ({ onAddToBoard }) => {
  const { language } = useTranslation();
  const K = batch11[language]?.search || batch11.id.search;

  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  const search = useCallback(
    async (text) => {
      const needle = (text ?? '').trim();
      if (!needle) return;

      setSearching(true);
      setError('');
      try {
        const found = await api.request(
          `/shopping-search/search?q=${encodeURIComponent(needle)}&limit=24`
        );
        setAnswer(found);
      } catch (err) {
        console.error('The search failed:', err);
        setError(err.message || K.no_results);
        setAnswer(null);
      } finally {
        setSearching(false);
      }
    },
    [K.no_results]
  );

  // The search happens once the reader has stopped typing, so that
  // every keystroke does not ask the server the same question.
  useEffect(() => {
    const needle = query.trim();
    if (!needle) {
      setAnswer(null);
      return undefined;
    }
    const timer = setTimeout(() => search(needle), 350);
    return () => clearTimeout(timer);
  }, [query, search]);

  const saveToBoard = async (result) => {
    try {
      await api.request('/shopping/items', {
        method: 'POST',
        body: JSON.stringify({
          name: result.title,
          quantity: 1,
          price: result.price_idr || null,
          stage: 'wishlist',
          marketplace: result.merchant_source || null,
          product_url: result.product_url || null,
          image_url: result.image_url || null,
          price_source: result.source || null,
          notes: result.description_snippet || null,
        }),
      });
      toast.success(fill(K.added, result.title));
      if (onAddToBoard) onAddToBoard(result);
    } catch (err) {
      console.error('Saving to the board failed:', err);
      toast.error(K.add_failed);
    }
  };

  const results = answer?.results || [];
  const isLocal = answer?.source === 'local_catalog';

  return (
    <div className="space-y-4">
      {/* The box to type in */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') search(query);
          }}
          placeholder={K.placeholder}
          aria-label={K.title}
          className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
        />
      </div>

      {searching && (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-500 dark:text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          {K.searching}
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Where the prices came from. This is said once, at the top,
          because it applies to every card below it. */}
      {answer && !searching && (
        <div
          className={`p-2.5 rounded-lg text-xs border ${
            isLocal
              ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
              : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
          }`}
        >
          {isLocal ? K.source_hint : K.from_provider}
        </div>
      )}

      {/* The grid */}
      {answer && !searching && results.length > 0 && (
        <>
          <div className="flex items-baseline justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {fill(K.results_for, answer.query)} ·{' '}
              {fill(K.count, results.length)}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {results.map((result, index) => (
              <div
                key={`${result.title}-${index}`}
                className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col"
              >
                <div className="aspect-square overflow-hidden bg-gray-50 dark:bg-gray-800">
                  <ResultPicture src={result.image_url} title={result.title} />
                </div>

                <div className="p-2.5 flex-1 flex flex-col gap-1.5">
                  <div className="text-xs font-medium text-gray-900 dark:text-gray-100 line-clamp-2">
                    {result.title}
                  </div>

                  <div className="flex items-baseline gap-1.5">
                    <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
                      {formatRupiah(result.price_idr)}
                    </span>
                    {result.original_price > result.price_idr && (
                      <span className="text-[10px] text-gray-400 line-through">
                        {formatRupiah(result.original_price)}
                      </span>
                    )}
                  </div>

                  {result.discount_badge && (
                    <span className="self-start text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                      {result.discount_badge}
                    </span>
                  )}

                  <div className="flex items-center justify-between gap-1 mt-auto">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded ${marketStyle(
                        result.merchant_source
                      )}`}
                    >
                      {result.merchant_source || K.store}
                    </span>
                    {result.rating ? (
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-0.5">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" aria-hidden="true" />
                        {result.rating}
                      </span>
                    ) : null}
                  </div>

                  {result.description_snippet && (
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-2">
                      {result.description_snippet}
                    </p>
                  )}

                  <div className="flex gap-1.5 mt-1">
                    <button
                      onClick={() => saveToBoard(result)}
                      className="flex-1 px-2 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-[11px] font-medium"
                    >
                      {K.add_to_board}
                    </button>
                    {result.product_url && (
                      <a
                        href={result.product_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={K.open_shop}
                        aria-label={K.open_shop}
                        className="px-2 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-200"
                      >
                        <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Nothing found */}
      {answer && !searching && results.length === 0 && (
        <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-xl">
          <Package className="w-10 h-10 mx-auto text-gray-400 mb-3" aria-hidden="true" />
          <div className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {K.no_results}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {K.no_results_hint}
          </div>
        </div>
      )}

      {/* Nothing searched yet */}
      {!answer && !searching && (
        <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-xl">
          <Search className="w-10 h-10 mx-auto text-gray-400 mb-3" aria-hidden="true" />
          <div className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {K.empty}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {K.empty_hint}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * The price, in rupiah.
 *
 * The number that arrives is a number, and a number that is not whole
 * rupiahs is shown with the two decimals it has, because a price that
 * has been rounded on the way to the screen is a price that is no
 * longer the one that was worked out.
 */

export default ProductSearch;
export { ProductSearch, formatRupiah };
