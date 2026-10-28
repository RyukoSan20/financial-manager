/**
 * Writing an amount as an expression.
 *
 * A reader adding up several things at once has to add them up in
 * their head first, or add them one at a time with the quick amount
 * buttons. Both are work.
 *
 * So the amount field takes an expression: "25000+15000" is forty
 * thousand, and "45000*2" is ninety thousand.
 *
 * Two rules, and both of them matter:
 *
 * - **Only what a reader could type.** Addition, subtraction,
 *   multiplication and division, with the digits and the dot. No
 *   brackets, no percentages, no functions, no variables. Anything
 *   else is not read as an expression and is not run as one.
 * - **A reader's expression is never run as code.** The expression is
 *   parsed into a tree of operations, and the tree is walked. There is
 *   no `eval` anywhere in this file, and there is nothing to escape
 *   into, because the only things the parser knows about are numbers
 *   and four operators.
 *
 * This file holds the arithmetic, with no React in it, so it can be
 * checked by a script.
 */

/**
 * The operators, and how much they bind.
 *
 * `*` and `/` bind tighter than `+` and `-`, so "2+3*4" is fourteen
 * and not twenty. This is the same order every other calculator uses,
 * so the reader does not have to learn a new one.
 */
const PRECEDENCE = {
  '+': 1,
  '-': 1,
  '*': 2,
  '/': 2,
};

const OPERATOR_CHARS = Object.keys(PRECEDENCE);

/**
 * Is this character part of a number?
 */
function isDigit(ch) {
  return ch >= '0' && ch <= '9';
}

/**
 * Is this an operator?
 */
function isOperator(ch) {
  return Object.prototype.hasOwnProperty.call(PRECEDENCE, ch);
}

/**
 * The tokens of an expression.
 *
 * A number, an operator, or nothing. Anything else is not a token,
 * and the expression is refused rather than half understood.
 */
function tokenize(text) {
  const tokens = [];
  const source = String(text ?? '');
  let index = 0;

  while (index < source.length) {
    const ch = source[index];

    if (ch === ' ' || ch === '\t') {
      index += 1;
      continue;
    }

    if (isDigit(ch) || ch === '.') {
      const start = index;
      let seenPoint = false;
      while (index < source.length && (isDigit(source[index]) || source[index] === '.')) {
        // Two points in one number is not a number.
        if (source[index] === '.') {
          if (seenPoint) return null;
          seenPoint = true;
        }
        index += 1;
      }
      const raw = source.slice(start, index);
      // A number that is only a point is not a number.
      if (raw === '.') return null;
      const value = Number(raw);
      if (!Number.isFinite(value)) return null;
      tokens.push({ type: 'number', value });
      continue;
    }

    if (isOperator(ch)) {
      tokens.push({ type: 'operator', value: ch });
      index += 1;
      continue;
    }

    // Anything else: a letter, a bracket, a currency symbol. The
    // expression is not one of ours.
    return null;
  }

  return tokens;
}

/**
 * The tree of operations.
 *
 * This is a shift-reduce parser. It keeps two things: the operators
 * it has seen and is not finished with, and the values it has worked
 * out. When a new operator turns up and binds tighter than the one on
 * top of the stack, the one on top is worked out first.
 *
 * The result is a tree, not a number. The number comes from walking
 * the tree, which is in `evaluate`.
 */
function parse(tokens) {
  const values = [];
  const operators = [];

  const reduceTop = () => {
    const operator = operators.pop();
    const right = values.pop();
    const left = values.pop();
    if (operator === undefined || right === undefined || left === undefined) return false;
    // The operator is pushed as a token, so the character is taken out
    // of it here.
    values.push({ type: 'value', op: operator.value, left, right });
    return true;
  };

  for (const token of tokens) {
    if (token.type === 'number') {
      values.push(token);
      continue;
    }

    // An operator.
    while (
      operators.length > 0 &&
      PRECEDENCE[operators[operators.length - 1].value] >= PRECEDENCE[token.value]
    ) {
      if (!reduceTop()) return null;
    }
    operators.push(token);
  }

  while (operators.length > 0) {
    if (!reduceTop()) return null;
  }

  if (values.length !== 1) return null;
  return values[0];
}

/**
 * Walk the tree and work out the number.
 *
 * The tree has three kinds of node: a number, an operator with a left
 * and a right. There is nothing else, so there is nothing to run.
 */
function evaluate(node) {
  if (!node) return null;
  if (node.type === 'number') return node.value;

  const left = evaluate(node.left);
  const right = evaluate(node.right);
  if (left === null || right === null) return null;

  switch (node.op) {
    case '+': return left + right;
    case '-': return left - right;
    case '*': return left * right;
    case '/':
      // A division by zero is not a number. The whole expression is
      // refused, rather than the reader being shown a zero that came
      // from nothing.
      if (right === 0) return null;
      return left / right;
    default:
      return null;
  }
}

/**
 * Does this text look like an expression rather than a plain number?
 *
 * A plain number is not an expression, and does not need the parser.
 * The check is cheap and it keeps the common case on the fast path.
 */
export function isExpression(text) {
  const source = String(text ?? '');
  for (const ch of source) {
    if (isOperator(ch)) return true;
  }
  return false;
}

/**
 * The value of an expression.
 *
 * Returns null when the text is not an expression this module can
 * read. A null means "leave the text alone", not "the amount is
 * zero": a reader who types something that cannot be read should see
 * what they typed, not a silent zero.
 */
export function evaluateExpression(text) {
  const source = String(text ?? '').trim();
  if (!source) return null;
  if (!isExpression(source)) return null;

  const tokens = tokenize(source);
  if (!tokens) return null;

  const tree = parse(tokens);
  if (!tree) return null;

  const value = evaluate(tree);
  if (value === null || !Number.isFinite(value)) return null;

  return value;
}

/**
 * Clean up what the reader typed into the amount field.
 *
 * The field accepts an expression, so the operators have to survive
 * being typed. Everything else does not: a letter is not part of an
 * amount, and a second point is not part of a number.
 *
 * The result is the reader's own text, tidied. It is not the value,
 * because the value cannot be worked out until the reader has
 * finished typing: "25000+" is not a number yet, and turning it into
 * a zero would lose what they were in the middle of writing.
 */
export function sanitizeExpression(text) {
  const source = String(text ?? '');
  let kept = '';
  // Whether the number being typed has already had its point. This
  // belongs to one number, so it is reset by an operator.
  let seenPoint = false;

  for (const ch of source) {
    if (isDigit(ch)) {
      kept += ch;
      continue;
    }

    if (ch === '.') {
      // A number has one point. A second one is not part of it.
      if (seenPoint) continue;
      seenPoint = true;
      kept += ch;
      continue;
    }

    if (isOperator(ch)) {
      // Two operators in a row are not something the reader can
      // finish, so the second one is dropped rather than left there
      // to be worked out later. An operator with nothing before it
      // is dropped for the same reason.
      const previous = kept[kept.length - 1];
      if (previous === undefined || isOperator(previous)) continue;
      kept += ch;
      // The next number starts fresh, so it can have its own point.
      seenPoint = false;
      continue;
    }

    // A space is dropped. The tokenizer ignores spaces anyway, so
    // keeping them would only make the number the reader sees longer
    // than the number they typed.
    if (ch === ' ') continue;
  }

  return kept;
}

/**
 * The text as a plain number, whatever it was written as.
 *
 * This is what the amount field reads back when the reader has typed
 * an expression: "25000+15000" is 40000, and the field shows that.
 * A text that cannot be read is returned as it was, so the reader sees
 * their own words rather than a zero.
 */
export function resolveAmountText(text) {
  const source = String(text ?? '').trim();
  if (!source) return '';

  if (!isExpression(source)) return source;

  const value = evaluateExpression(source);
  if (value === null) return source;

  // The number is written without a tail, because a rupiah amount has
  // no cents and a long tail is what the reader was trying to avoid.
  const rounded = Math.round(value * 1e6) / 1e6;
  return String(rounded);
}

export default {
  isExpression,
  evaluateExpression,
  resolveAmountText,
  sanitizeExpression,
};
