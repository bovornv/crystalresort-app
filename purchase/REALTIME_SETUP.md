# Real-time Supabase Integration - Purchase Board

## Summary
The Purchase Board is now connected to Supabase with real-time updates. Multiple users on different devices will see changes instantly (within 1-2 seconds) without page refresh.

## Changes Made

### 1. Table Names Updated
- `items` → `purchase_items` (active board items)
- `purchase_records` → `purchase_history` (immutable records)

### 2. Database Functions Updated
All database operations now use the correct table names:
- `loadItemsFromSupabase()` - loads from `purchase_items`
- `saveItemToSupabase()` - saves to `purchase_items` and creates history snapshot
- `deleteItemFromSupabase()` - deletes from `purchase_items`
- `loadPurchaseRecordsFromSupabase()` - loads from `purchase_history`
- `savePurchaseRecordToSupabase()` - saves to `purchase_history`

### 3. Real-time Subscriptions
- Subscribes to `purchase_items` table for INSERT/UPDATE/DELETE events
- Subscribes to `purchase_history` table for INSERT events
- Updates UI automatically when changes occur (no refresh needed)

### 4. Purchase History Logic
When an item status changes to `'received'`:
- A snapshot is automatically inserted into `purchase_history` table
- Prevents duplicate entries (checks for recent records)
- Item remains in `purchase_items` for active tracking

## How It Works

### Real-time Updates Flow
1. User A adds/edits/moves an item → Saved to `purchase_items`
2. Supabase Realtime triggers → All subscribed clients receive update
3. User B's browser receives update → UI updates automatically (1-2 seconds)
4. No page refresh needed

### Purchase History Flow
1. Item status changes to `'received'` → `saveItemToSupabase()` is called
2. Item saved to `purchase_items` → Status updated
3. `insertPurchaseHistory()` called → Creates immutable snapshot in `purchase_history`
4. History record includes: item details, receiver, quality status, issues

## Testing Checklist

### Basic Connection
- [ ] Open app in browser
- [ ] Check browser console (F12) - should see "Subscribed to purchase_items realtime changes"
- [ ] No errors related to Supabase connection

### Real-time Updates (Two Devices Test)
- [ ] Open app in Browser Window 1 (Device A)
- [ ] Open app in Browser Window 2 (Device B) - or different device
- [ ] In Window 1: Add a new item
- [ ] In Window 2: Item should appear within 1-2 seconds (no refresh)
- [ ] In Window 1: Edit item name/quantity
- [ ] In Window 2: Changes should appear within 1-2 seconds
- [ ] In Window 1: Move item to next stage
- [ ] In Window 2: Status change should appear within 1-2 seconds
- [ ] In Window 1: Delete an item
- [ ] In Window 2: Item should disappear within 1-2 seconds

### Purchase History
- [ ] Receive an item (status → 'received')
- [ ] Check Supabase dashboard → `purchase_history` table should have new record
- [ ] Verify record includes: item_name, supplier, quantity, receiver, status
- [ ] Item should still be in `purchase_items` table

### Mobile/Tablet/Desktop
- [ ] Test on mobile device - real-time updates work
- [ ] Test on tablet - real-time updates work
- [ ] Test on desktop - real-time updates work

## Database Schema Requirements

Your Supabase tables should have these columns:

### `purchase_items` table
- `id` (TEXT PRIMARY KEY)
- `name` (TEXT)
- `quantity` (NUMERIC)
- `unit` (TEXT)
- `supplier` (TEXT)
- `status` (TEXT) - 'need-to-buy', 'ordered', 'bought', 'received', 'verified'
- `requested_qty` (NUMERIC)
- `received_qty` (NUMERIC)
- `urgency` (TEXT)
- `notes` (TEXT)
- `issue_type` (TEXT)
- `issue_reason` (TEXT)
- `created_by` (UUID)
- `updated_by` (UUID)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

### `purchase_history` table
- `id` (TEXT PRIMARY KEY)
- `item_id` (TEXT) - references purchase_items.id
- `item_name` (TEXT)
- `supplier` (TEXT)
- `quantity` (NUMERIC)
- `unit` (TEXT)
- `status` (TEXT) - 'OK' or 'Issue'
- `receiver` (JSONB) - user info
- `issue_type` (TEXT)
- `issue_reason` (TEXT)
- `created_by` (UUID)
- `created_at` (TIMESTAMPTZ)

## Real-time Setup

Ensure real-time is enabled in Supabase:
1. Go to Supabase Dashboard → Database → Replication
2. Verify `purchase_items` is enabled for replication
3. Verify `purchase_history` is enabled (optional, for history updates)

Or run in SQL Editor:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE purchase_items;
ALTER PUBLICATION supabase_realtime ADD TABLE purchase_history;
```

## Troubleshooting

### Updates not appearing in real-time
- Check browser console for subscription errors
- Verify real-time is enabled in Supabase Dashboard → Database → Replication
- Check network tab for WebSocket connections
- Ensure both users are logged in (if auth is required)

### Purchase history not being created
- Check browser console for errors
- Verify `purchase_history` table exists and has correct columns
- Check RLS policies allow INSERT operations
- Verify item status is exactly `'received'` (case-sensitive)

### Connection errors
- Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` are correct in `purchase.js`
- Check Supabase project is active (not paused)
- Verify RLS policies allow SELECT/INSERT/UPDATE/DELETE for authenticated users

## Notes

- Real-time updates work across all devices (mobile, tablet, desktop)
- No page refresh required - changes appear automatically
- Purchase history is immutable - once created, records don't change
- Active items stay in `purchase_items` until deleted or archived
- Duplicate history entries are prevented (checks for recent records)
