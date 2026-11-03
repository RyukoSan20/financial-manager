/**
 * The four columns of the board.
 *
 * The board in the books has seven stages, because a thing that is on
 * its way and a thing that is on its way but late are not the same
 * thing. But the reader does not think in seven. The reader thinks:
 *
 *   I want it.            -> Incaran
 *   I am saving for it.   -> Ditabung
 *   We can buy it now.    -> Siap Checkout
 *   It is bought.         -> Sudah Dibeli
 *
 * So the seven stages are gathered into four columns here, and
 * nothing in the database is changed. A thing that was cancelled is
 * not in any column. It is not wanted and it was not bought, and
 * showing it in either place would be a lie.
 */

/**
 * The four columns, in the order they are read.
 *
 * `stages` is the stages of the books that make up the column, and
 * `paid` says whether a thing in this column has already cost money.
 */
export const BOARD_COLUMNS = [
  {
    key: 'wishlist',
    stages: ['wishlist'],
    paid: false,
    labelKey: 'shopping_board.column_wishlist',
    hintKey: 'shopping_board.column_wishlist_hint',
  },
  {
    key: 'saving',
    stages: ['to_buy'],
    paid: false,
    labelKey: 'shopping_board.column_saving',
    hintKey: 'shopping_board.column_saving_hint',
  },
  {
    key: 'ready',
    stages: ['ready'],
    paid: false,
    labelKey: 'shopping_board.column_ready',
    hintKey: 'shopping_board.column_ready_hint',
  },
  {
    key: 'bought',
    stages: ['ordered', 'shipped', 'received'],
    paid: true,
    labelKey: 'shopping_board.column_bought',
    hintKey: 'shopping_board.column_bought_hint',
  },
];

/**
 * The column a stage belongs to, or nothing when the stage is not on
 * the board at all (a cancelled thing).
 *
 * @param {string} stage
 * @returns {string|null}
 */
export function columnFor(stage) {
  const found = BOARD_COLUMNS.find((column) => column.stages.includes(stage));
  return found ? found.key : null;
}

/**
 * The four columns, each with the things in it.
 *
 * The columns that come from the server are used as they are, so that
 * the board the reader sees is the board the server has. The four
 * columns are then gathered out of them.
 *
 * @param {Array<{stage?: string, items?: Array<object>}>} columns
 * @returns {Array<{key: string, paid: boolean, items: Array<object>, count: number, total: number}>}
 */
export function gatherColumns(columns) {
  const items = [];
  for (const column of columns || []) {
    for (const item of column.items || []) {
      items.push(item);
    }
  }

  return BOARD_COLUMNS.map((definition) => {
    const held = items.filter((item) => definition.stages.includes(item.stage));
    return {
      key: definition.key,
      stages: definition.stages,
      paid: definition.paid,
      items: held,
      count: held.length,
      total: held.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
    };
  });
}

/**
 * The stage a thing is put in when it is dropped into a column.
 *
 * A column is a bucket of stages. The first stage of the bucket is
 * the one a thing is put in, because that is the honest place for it:
 * a thing moved to "ready" has been decided on but not yet bought.
 *
 * @param {string} columnKey
 * @returns {string|null}
 */
export function stageFor(columnKey) {
  const found = BOARD_COLUMNS.find((column) => column.key === columnKey);
  return found ? found.stages[0] : null;
}

/**
 * What happens when a thing is dropped into a column.
 *
 * `purchase` means money has to change hands, and that is done by
 * writing the purchase down, not by dragging a card. `move` is a
 * plain move. `null` means the drop is not allowed.
 *
 * @param {object} item
 * @param {string} columnKey
 * @returns {'purchase'|'move'|null}
 */
export function dropAction(item, columnKey) {
  const target = BOARD_COLUMNS.find((column) => column.key === columnKey);
  if (!target) return null;

  const current = columnFor(item?.stage);
  if (!current) return null;
  if (current === columnKey) return null;

  const from = BOARD_COLUMNS.find((column) => column.key === current);

  // Moving into a column of things that cost money means money has to
  // change hands, and that is done by the purchase.
  if (target.paid && !from.paid) return 'purchase';

  // A bought thing cannot go back to a column of things that have not
  // been bought. A return is written down by hand as a transaction.
  if (from.paid && !target.paid) return null;

  return 'move';
}

/**
 * Can a thing be dropped into this column?
 *
 * @param {object} item
 * @param {string} columnKey
 * @returns {boolean}
 */
export function canDrop(item, columnKey) {
  return dropAction(item, columnKey) !== null;
}
