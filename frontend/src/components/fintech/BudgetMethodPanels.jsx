/**
 * The panels on the budgets page.
 *
 * Three things sit above the budget list, and which of them appear
 * depends on the way the reader has chosen to run their money:
 *
 * - the choice itself, always;
 * - the three groups of money, in the two methods that group;
 * - the transfer between envelopes, in the method that allows it.
 *
 * They are gathered here so the budgets page stays a page about
 * budgets rather than a page about panels.
 */

import { BudgetMethodPicker } from './BudgetMethodPicker';
import { FlexBudgetPanel, EnvelopeTransfer } from './FlexBudgetPanel';

export function BudgetMethodPanels({
  method = 'flex',
  onMethodChange,
  budgets = [],
  carry = {},
  onCarryChange,
  onMove,
}) {
  // The choice of way is offered before there is anything to divide
  // up, because the reader picks the way first and then makes their
  // budgets in it. The panels that need budgets wait for the first
  // one.
  const hasBudgets = (budgets || []).length > 0;
  return (
    <div className="flex flex-col gap-4">
      <BudgetMethodPicker method={method} onChange={onMethodChange} />

      {/* The three groups are not the zero-based way of looking at the
          money, so they are not shown there. They also need budgets to
          divide up, so they wait for the first one. */}
      {method !== 'zero' && hasBudgets && (
        <FlexBudgetPanel
          budgets={budgets}
          carry={carry}
          onCarryChange={onCarryChange}
        />
      )}

      {/* Moving money between envelopes is the envelope method's
          own thing. */}
      {method === 'envelope' && hasBudgets && (
        <EnvelopeTransfer budgets={budgets} onMove={onMove} />
      )}
    </div>
  );
}

export default BudgetMethodPanels;
