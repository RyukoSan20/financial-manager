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
  const response = await api.get('/split/groups');
  return response.data;
}

/**
 * One group.
 */
export async function getGroup(groupId) {
  const response = await api.get(`/split/groups/${groupId}`);
  return response.data;
}

/**
 * A new group.
 */
export async function createGroup(payload) {
  const response = await api.post('/split/groups', payload);
  return response.data;
}

/**
 * Somebody at the table.
 */
export async function addMember(groupId, payload) {
  const response = await api.post(`/split/groups/${groupId}/members`, payload);
  return response.data;
}

/**
 * What everybody owes the group, or is owed by it.
 */
export async function getBalances(groupId) {
  const response = await api.get(`/split/groups/${groupId}/balances`);
  return response.data;
}

/**
 * The fewest payments that clear the group.
 */
export async function getSettlementPlan(groupId) {
  const response = await api.get(`/split/groups/${groupId}/settlement-plan`);
  return response.data;
}

/**
 * The receipts the group has shared.
 */
export async function listExpenses(groupId) {
  const response = await api.get(`/split/groups/${groupId}/expenses`);
  return response.data;
}

/**
 * A receipt, shared.
 */
export async function createExpense(groupId, payload) {
  const response = await api.post(`/split/groups/${groupId}/expenses`, payload);
  return response.data;
}

/**
 * One receipt.
 */
export async function getExpense(expenseId) {
  const response = await api.get(`/split/expenses/${expenseId}`);
  return response.data;
}

/**
 * The host saying who had what.
 */
export async function claimForMember(expenseId, payload) {
  const response = await api.post(`/split/expenses/${expenseId}/claims`, payload);
  return response.data;
}

/**
 * A claim taken back.
 */
export async function releaseClaim(expenseId, claimId) {
  const response = await api.delete(
    `/split/expenses/${expenseId}/claims/${claimId}`,
  );
  return response.data;
}

/**
 * The bill becomes real.
 */
export async function publishExpense(expenseId) {
  const response = await api.post(`/split/expenses/${expenseId}/publish`);
  return response.data;
}

/**
 * The payments between the people in the group.
 */
export async function listSettlements(groupId) {
  const response = await api.get(`/split/groups/${groupId}/settlements`);
  return response.data;
}

/**
 * Somebody paid somebody back.
 */
export async function createSettlement(groupId, payload) {
  const response = await api.post(`/split/groups/${groupId}/settlements`, payload);
  return response.data;
}

/**
 * The money has arrived.
 */
export async function confirmSettlement(settlementId) {
  const response = await api.post(`/split/settlements/${settlementId}/confirm`);
  return response.data;
}

// --- the guest -------------------------------------------------------------

/**
 * What the link points at.
 */
export async function peekGroup(code) {
  const response = await api.get(`/split/claim/${code}`);
  return response.data;
}

/**
 * Giving a name and getting in.
 */
export async function joinGroup(code, displayName) {
  const response = await api.post(`/split/claim/${code}/join`, {
    display_name: displayName,
  });
  return response.data;
}

/**
 * The receipts the group has shared, and which one is live.
 */
export async function listGuestExpenses(code, token) {
  const response = await api.get(`/split/claim/${code}/expenses`, {
    headers: { [GUEST_TOKEN_HEADER]: token },
  });
  return response.data;
}

/**
 * The receipt, as it changes.
 */
export async function getLiveReceipt(expenseId, token) {
  const response = await api.get(`/split/expenses/${expenseId}/live`, {
    headers: { [GUEST_TOKEN_HEADER]: token },
  });
  return response.data;
}

/**
 * Tapping a plate.
 */
export async function claimItem(expenseId, token, itemId, quantity = 1) {
  const response = await api.post(
    `/split/expenses/${expenseId}/claim`,
    { item_id: itemId, quantity },
    { headers: { [GUEST_TOKEN_HEADER]: token } },
  );
  return response.data;
}

/**
 * Taking a claim back.
 */
export async function releaseItem(expenseId, token, itemId) {
  const response = await api.delete(
    `/split/expenses/${expenseId}/claim/${itemId}`,
    { headers: { [GUEST_TOKEN_HEADER]: token } },
  );
  return response.data;
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
