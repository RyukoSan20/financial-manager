/**
 * One reading of the health numbers.
 *
 * The analytics page shows the same facts in two places: a strip of
 * four numbers at the top, and a card further down with the same four
 * numbers. They were read from two different places in the answer, and
 * only one of those places was where the numbers actually were.
 *
 * The server puts the balance, the saving rate, the debt and the goal
 * count under `metrics`. The strip read them from the top level, where
 * there is nothing, so the strip said the balance was zero while the
 * card further down said it was five million rupiah. Both were right
 * about their own reading, and the page contradicted itself.
 *
 * So there is one function here, and both places call it.
 */

/**
 * The numbers the health answer carries.
 *
 * Everything is read from `metrics`, which is where the server puts
 * them. A missing number is zero rather than undefined, so the page
 * has something to show.
 */
export function healthMetrics(health) {
  const metrics = health?.metrics || {};
  return {
    totalBalance: Number(metrics.total_balance ?? 0),
    savingRate: Number(metrics.saving_rate ?? 0),
    totalDebt: Number(metrics.total_debt ?? 0),
    activeGoals: Number(metrics.active_goals ?? 0),
  };
}

/**
 * The score, and whether it is worth showing.
 *
 * The score is out of 100. With one transaction the server cannot
 * measure most of it, and the answer is 0 out of 100, which reads as
 * a bad result rather than as an empty measurement.
 *
 * So the score is only shown when the server says there was enough to
 * judge, or when there are enough transactions to judge for
 * ourselves. Below that the page says what is missing instead of
 * putting a zero on the screen.
 */
export const MIN_TRANSACTIONS_FOR_SCORE = 3;

/**
 * Should the score be shown at all?
 */
export function canShowHealthScore(health, transactionCount) {
  // The server knows how much of the score it could measure. If it
  // says there was enough, that is the answer.
  if (health?.has_enough_data === true) return true;

  // Otherwise the transaction count decides. A reader with three
  // transactions has enough to have an opinion, and the server will
  // agree once it has the same data.
  const count = Number(transactionCount ?? 0);
  if (count >= MIN_TRANSACTIONS_FOR_SCORE) return true;

  return false;
}

/**
 * How many transactions the reader has recorded.
 *
 * The server sends this in the metrics. If an older server does not,
 * the count is unknown rather than zero, and the score is then left
 * to the server's own judgement.
 */
export function transactionCount(health) {
  const raw = health?.metrics?.transaction_count;
  if (raw === undefined || raw === null) return null;
  const count = Number(raw);
  return Number.isFinite(count) ? count : null;
}

export default {
  healthMetrics,
  canShowHealthScore,
  transactionCount,
  MIN_TRANSACTIONS_FOR_SCORE,
};
