# FR-004: AI Update Transaction

## Metadata
- **Request ID:** FR-004
- **Date Created:** 2026-10-15
- **Requested By:** RyukoSan20
- **Priority:** Medium
- **Status:** Pending

## Request Summary
Extend AI Assistant to update existing transactions.

## Expected Behavior
User bisa ubah transaksi via AI: "ubah transaksi makan indomie jadi 20000"

## Acceptance Criteria
- [ ] Parse update intent
- [ ] Find transaction to update
- [ ] Update fields (amount, description, category, date)
- [ ] Save changes
- [ ] Confirm to user

## Technical Notes
- Extend /api/ai/execute
- Add update_transaction action
- Support partial updates
