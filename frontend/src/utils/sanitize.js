/**
 * Payload sanitising.
 *
 * The forms in this app keep their state as strings, because that is
 * what an input element gives you. When the form is submitted, the empty
 * optional fields are still empty strings, and the backend rejects them:
 *
 *     "Input should be a valid date or datetime, input is too short"
 *
 * That happens for every optional date, and for a number it means
 * "not a number" instead of "leave it alone".
 *
 * These helpers turn the form state into a payload the backend accepts:
 * an empty optional field is dropped, a date is sent as `YYYY-MM-DD`,
 * and a number that cannot be parsed is dropped as well.
 */

// The keys that hold a date. The values of these are normalised to the
// ISO date format, and dropped when they are empty.
const DATE_KEYS = new Set([
  'date',
  'start_date',
  'end_date',
  'due_date',
  'next_occurrence',
  'next_payment_date',
  'target_date',
  'last_payment_date',
  'first_payment_date',
  'payment_date',
  'transaction_date',
  'reminder_date',
  'completed_at',
]);

// The keys that hold a number.
const NUMBER_KEYS = new Set([
  'amount',
  'price',
  'price_per_unit',
  'total_price',
  'quantity',
  'qty',
  'percent',
  'percentage',
  'value',
  'budget',
  'limit',
  'target_amount',
  'current_amount',
  'limit_amount',
  'min_price',
  'max_price',
  'typical_price',
  'salary',
  'monthly_salary',
  'interest_rate',
  'principal',
  'monthly_payment',
  'installment',
  'reminder_days_before',
  'interval_value',
  'day_of_month',
  'day_of_week',
  'credit_limit',
  'initial_balance',
]);

// The keys that hold a boolean.
const BOOLEAN_KEYS = new Set([
  'is_active',
  'auto_generate',
  'rollover',
  'auto_allocate',
  'is_completed',
  'is_credit',
  'has_reminder',
  'is_recurring',
  'is_deleted',
]);

const isEmpty = (value) =>
  value === undefined ||
  value === null ||
  (typeof value === 'string' && value.trim() === '');

// A value that is explicitly null means "clear this field", which is
// different from a field the user left empty.
const isBlank = (value) =>
  value === undefined || (typeof value === 'string' && value.trim() === '');

/**
 * Normalise one date value to `YYYY-MM-DD`.
 *
 * The browser gives a date input `YYYY-MM-DD` already, but a value that
 * came from the API can be a full timestamp. Anything that cannot be
 * read as a date returns null, so the field is dropped instead of
 * breaking the request.
 */
export const normalizeDate = (value) => {
  if (isEmpty(value)) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().split('T')[0];
  }

  const text = String(value).trim();
  // Already the right format.
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  // A timestamp with a time part.
  if (/^\d{4}-\d{2}-\d{2}[T ]/.test(text)) return text.split(/[T ]/)[0];

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().split('T')[0];
};

/**
 * Turn a form state into a payload the backend accepts.
 *
 * Empty optional fields are removed instead of being sent as an empty
 * string. A field the user did not touch keeps the value it had.
 */
export const sanitizePayload = (payload) => {
  if (!payload || typeof payload !== 'object') return payload;
  if (Array.isArray(payload)) return payload.map(sanitizePayload);

  const out = {};

  Object.entries(payload).forEach(([key, value]) => {
    // An explicit null means "clear this field", so it is sent as it is.
    if (value === null) {
      out[key] = null;
      return;
    }

    // An empty optional value is not sent at all. The backend then keeps
    // the value it already has.
    if (isBlank(value)) return;

    if (DATE_KEYS.has(key)) {
      const date = normalizeDate(value);
      if (date) out[key] = date;
      return;
    }

    if (NUMBER_KEYS.has(key)) {
      const number = typeof value === 'number' ? value : Number(value);
      if (Number.isFinite(number)) {
        out[key] = number;
      }
      return;
    }

    if (BOOLEAN_KEYS.has(key)) {
      out[key] = Boolean(value);
      return;
    }

    // An object or an array is sent as it is.
    if (typeof value === 'object') {
      out[key] = sanitizePayload(value);
      return;
    }

    out[key] = value;
  });

  return out;
};

/**
 * The same, but the empty optional fields are sent as null instead of
 * being dropped. Use it when the backend has to clear a value.
 */
export const sanitizePayloadWithNulls = (payload) => {
  if (!payload || typeof payload !== 'object') return payload;

  const out = {};

  Object.entries(payload).forEach(([key, value]) => {
    if (isEmpty(value)) {
      if (DATE_KEYS.has(key) || NUMBER_KEYS.has(key)) {
        out[key] = null;
      }
      return;
    }
    if (DATE_KEYS.has(key)) {
      const date = normalizeDate(value);
      out[key] = date;
      return;
    }
    if (NUMBER_KEYS.has(key)) {
      const number = typeof value === 'number' ? value : Number(value);
      out[key] = Number.isFinite(number) ? number : null;
      return;
    }
    out[key] = value;
  });

  return out;
};

export default sanitizePayload;
