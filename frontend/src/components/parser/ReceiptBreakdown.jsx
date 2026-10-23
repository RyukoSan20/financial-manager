/**
 * The itemised view of a scanned receipt.
 *
 * A receipt is not one number. It is a list of products, each with a
 * quantity and a price, and then a discount, and only then a total. This
 * component shows that structure so the user can see where the money
 * went, and so a wrong line can be spotted before it is saved.
 */
import { AlertTriangle, Package, Percent, Tag } from 'lucide-react';

const money = (value) => `Rp${Number(value || 0).toLocaleString('id-ID')}`;

export const ReceiptBreakdown = ({ breakdown, learning, compact = false }) => {
  if (!breakdown) return null;

  const items = breakdown.items || [];
  const hasDiscount = (breakdown.discount_total || 0) > 0;

  if (items.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
        <span className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
          <Package className="h-4 w-4" />
          Rincian Belanja
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {breakdown.item_count || items.length} item
          {breakdown.distinct_products &&
            breakdown.distinct_products !== (breakdown.item_count || items.length) &&
            ` · ${breakdown.distinct_products} produk`}
        </span>
      </div>

      <table className="w-full text-sm">
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {items.map((item, index) => (
            <tr key={`${item.name}-${index}`}>
              <td className="px-3 py-2">
                <span
                  className={`block font-medium ${
                    item.is_discount
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-800 dark:text-gray-200'
                  }`}
                >
                  {item.name}
                </span>
                {item.quantity > 1 && !item.is_discount && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {item.quantity} × {money(item.price_per_unit)}
                  </span>
                )}
                {item.is_known_product === false && (
                  <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                    <Tag className="h-3 w-3" />
                    Produk baru
                  </span>
                )}
              </td>
              <td
                className={`whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums ${
                  item.is_discount
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-gray-800 dark:text-gray-200'
                }`}
              >
                {item.is_discount ? '-' : ''}
                {money(item.total_price)}
              </td>
            </tr>
          ))}
        </tbody>

        <tfoot className="border-t border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
          {hasDiscount && (
            <tr>
              <td className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400">
                <span className="inline-flex items-center gap-1">
                  <Percent className="h-3 w-3" />
                  Diskon
                </span>
              </td>
              <td className="whitespace-nowrap px-3 py-1.5 text-right text-xs font-medium tabular-nums text-red-600 dark:text-red-400">
                -{money(breakdown.discount_total)}
              </td>
            </tr>
          )}
          {breakdown.tax > 0 && (
            <tr>
              <td className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400">
                Pajak
              </td>
              <td className="whitespace-nowrap px-3 py-1.5 text-right text-xs font-medium tabular-nums text-gray-600 dark:text-gray-400">
                {money(breakdown.tax)}
              </td>
            </tr>
          )}
          <tr>
            <td className="px-3 py-2 text-sm font-bold text-gray-900 dark:text-gray-100">
              Total
            </td>
            <td className="whitespace-nowrap px-3 py-2 text-right text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">
              {money(breakdown.total || breakdown.computed_total)}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* The arithmetic is shown so a wrong read is obvious. */}
      {breakdown.totals_match === false && (
        <div className="flex items-start gap-2 border-t border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Hasil hitung {money(breakdown.computed_total)} berbeda dengan total
            yang tercetak {money(breakdown.total)}. Periksa kembali item yang
            terbaca.
          </span>
        </div>
      )}

      {/* What the scanner had to learn from this receipt. */}
      {!compact && learning && (
        <div className="border-t border-gray-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 dark:border-gray-700 dark:bg-blue-900/30 dark:text-blue-200">
          {learning.merchant?.created && (
            <div>
              <span className="font-semibold">Merchant baru:</span>{' '}
              {learning.merchant.name} sudah masuk katalog.
            </div>
          )}
          {learning.new_products?.length > 0 && (
            <div className="mt-0.5">
              <span className="font-semibold">Produk baru dipelajari:</span>{' '}
              {learning.new_products.join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReceiptBreakdown;
