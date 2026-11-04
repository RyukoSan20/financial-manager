/**
 * The shared bill, over the wire.
 *
 * Every call the shared bill makes goes through here, so that the
 * one place that knows how to talk to the server is the one place
 * that is written down.
 *
 * The guest calls are in here too. A guest has no account, so they
 * carry a different pass: the claim token, in a header of its own.
 * It is scoped to one group and it is short-lived.
 */

import api from './api';

/** The header the guest's pass travels in. */
export const GUEST_TOKEN_HEADER = 'X-Split-Guest-Token';

/**
 * The groups the reader is in.
 */
export async function listGroups() {
  const result = await api.get('/split/groups');
  return result;
}

/**
 * One group.
 */
export async function getGroup(groupId) {
  const result = await api.get(`/split/groups/${groupId}`);
  return result;
}

/**
 * A new group.
 */
export async function createGroup(payload) {
  const result = await api.post('/split/groups', payload);
  return result;
}

/**
 * Somebody at the table.
 */
export async function addMember(groupId, payload) {
  const result = await api.post(`/split/groups/${groupId}/members`, payload);
  return result;
}

/**
 * What everybody owes the group, or is owed by it.
 */
export async function getBalances(groupId) {
  const result = await api.get(`/split/groups/${groupId}/balances`);
  return result;
}

/**
 * The fewest payments that clear the group.
 */
export async function getSettlementPlan(groupId) {
  const result = await api.get(`/split/groups/${groupId}/settlement-plan`);
  return result;
}

/**
 * The receipts the group has shared.
 */
export async function listExpenses(groupId) {
  const result = await api.get(`/split/groups/${groupId}/expenses`);
  return result;
}

/**
 * A receipt, read.
 *
 * Nothing is written down. The answer is a proposal: the dishes on
 * the receipt and what they add up to.
 */
export async function decomposeReceipt(payload) {
  const result = await api.post('/split/decompose', payload);
  return result;
}

/**
 * A receipt, shared.
 */
export async function createExpense(groupId, payload) {
  const result = await api.post(`/split/groups/${groupId}/expenses`, payload);
  return result;
}

/**
 * The reader's recent transactions that can be brought into a bill.
 *
 * Only the ones that came from a receipt: a bill is made of lines,
 * and a transaction without a receipt has only one line.
 */
export async function listImportableTransactions(limit = 20) {
  const result = await api.get(`/split/importable-transactions?limit=${limit}`);
  return result;
}

/**
 * One of those transactions, as the payload of a new bill.
 *
 * Nothing is written down. It gives back the lines, the tax, the
 * discount and the total, so that the reader can look at it first.
 */
export async function importTransaction(transactionId, payload = {}) {
  const result = await api.post(`/split/import-transaction/${transactionId}`, payload);
  return result;
}

/**
 * Say who had what, all at once.
 *
 * The keys of the map are the ids of the lines, and the values are
 * the ids of the people at the table.
 */
export async function assignItems(groupId, expenseId, assignments) {
  const result = await api.post(
    `/split/groups/${groupId}/expenses/${expenseId}/assign`,
    { assignments },
  );
  return result;
}

/**
 * One receipt.
 */
export async function getExpense(expenseId) {
  const result = await api.get(`/split/expenses/${expenseId}`);
  return result;
}

/**
 * The host saying who had what.
 */
export async function claimForMember(expenseId, payload) {
  const result = await api.post(`/split/expenses/${expenseId}/claims`, payload);
  return result;
}

/**
 * A claim taken back.
 */
export async function releaseClaim(expenseId, claimId) {
  const result = await api.delete(
    `/split/expenses/${expenseId}/claims/${claimId}`,
  );
  return result;
}

/**
 * The bill becomes real.
 */
export async function publishExpense(expenseId) {
  const result = await api.post(`/split/expenses/${expenseId}/publish`);
  return result;
}

/**
 * The payments between the people in the group.
 */
export async function listSettlements(groupId) {
  const result = await api.get(`/split/groups/${groupId}/settlements`);
  return result;
}

/**
 * Somebody paid somebody back.
 */
export async function createSettlement(groupId, payload) {
  const result = await api.post(`/split/groups/${groupId}/settlements`, payload);
  return result;
}

/**
 * The money has arrived.
 */
export async function confirmSettlement(settlementId) {
  const result = await api.post(`/split/settlements/${settlementId}/confirm`);
  return result;
}

// --- the guest -------------------------------------------------------------

/**
 * What the link points at.
 */
export async function peekGroup(code) {
  const result = await api.get(`/split/claim/${code}`);
  return result;
}

/**
 * Giving a name and getting in.
 */
export async function joinGroup(code, displayName) {
  const result = await api.post(`/split/claim/${code}/join`, {
    display_name: displayName,
  });
  return result;
}

/**
 * The receipts the group has shared, and which one is live.
 */
export async function listGuestExpenses(code, token) {
  const result = await api.get(`/split/claim/${code}/expenses`, {
    headers: { [GUEST_TOKEN_HEADER]: token },
  });
  return result;
}

/**
 * The receipt, as it changes.
 */
export async function getLiveReceipt(expenseId, token) {
  const result = await api.get(`/split/expenses/${expenseId}/live`, {
    headers: { [GUEST_TOKEN_HEADER]: token },
  });
  return result;
}

/**
 * Tapping a plate.
 */
export async function claimItem(expenseId, token, itemId, quantity = 1) {
  const result = await api.post(
    `/split/expenses/${expenseId}/claim`,
    { item_id: itemId, quantity },
    { headers: { [GUEST_TOKEN_HEADER]: token } },
  );
  return result;
}

/**
 * Taking a claim back.
 */
export async function releaseItem(expenseId, token, itemId) {
  const result = await api.delete(
    `/split/expenses/${expenseId}/claim/${itemId}`,
    { headers: { [GUEST_TOKEN_HEADER]: token } },
  );
  return result;
}

export default {
  listGroups,
  getGroup,
  createGroup,
  addMember,
  getBalances,
  getSettlementPlan,
  listExpenses,
  createExpense,
  decomposeReceipt,
  listImportableTransactions,
  importTransaction,
  assignItems,
  getExpense,
  claimForMember,
  releaseClaim,
  publishExpense,
  listSettlements,
  createSettlement,
  confirmSettlement,
  peekGroup,
  joinGroup,
  listGuestExpenses,
  getLiveReceipt,
  claimItem,
  releaseItem,
};
