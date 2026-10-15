# FR-002: Maps Integration

## Metadata
- **Request ID:** FR-002
- **Date Created:** 2026-10-15
- **Requested By:** RyukoSan20
- **Priority:** Medium
- **Status:** Pending

## Request Summary
Integrate Maps API for transaction location tracking - currently only showing placeholder UI.

## Problem Statement
Fitur location masih pajangan/tidak berfungsi. User ingin bisa lihat lokasi transaksi di map.

## Expected Behavior
- Transaction bisa include lokasi (latitude, longitude)
- Lihat transaksi di map/daftar
- Filter transaksi berdasarkan lokasi

## User Story
As a user, I want to see transaction locations on a map so that I can track where I spend money.

## Acceptance Criteria
- [ ] Integrate OpenStreetMap/Google Maps API
- [ ] Save location with transactions
- [ ] Display map with transaction markers
- [ ] Filter by location radius

## Technical Notes
- Use OpenStreetMap (free) or Google Maps API
- Store lat/lng in transaction
- Frontend: react-leaflet or similar

## Related Issues
- Related to: Transaction location feature
