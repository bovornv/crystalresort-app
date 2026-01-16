# Troubleshooting Real-time Sync Across Devices

## Problem: Different users on different devices see different data

If two users (e.g., one on desktop, one on mobile) see different data, real-time sync is not working.

## Step-by-Step Diagnosis

### Step 1: Check Browser Console on Both Devices

**On Desktop:**
1. Open Purchase tool
2. Press F12 (or right-click → Inspect)
3. Go to Console tab
4. Look for these messages:

**✅ Good signs:**
- `✅ Supabase configured - real-time sync should work`
- `✅ Real-time subscribed: purchase_items`
- `✅ Real-time subscribed: purchase_history`
- `📊 Current items count: X` (should match on both devices)

**❌ Bad signs:**
- `⚠️ Supabase not configured - using localStorage (no sync across devices)`
- `⚠️ Real-time subscriptions not active - sync may not work`
- `❌ Real-time subscription error: CHANNEL_ERROR`
- `⚠️ Failed to save item to Supabase - sync may not work`

**On Mobile:**
1. Open Purchase tool
2. Open browser developer tools (or use remote debugging)
3. Check console for same messages

### Step 2: Verify Supabase Configuration

**Check `purchase.js` lines 7-8:**
```javascript
const SUPABASE_URL = 'https://kfyjuzmruutgltpytrqm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGci...';
```

Both should be set and valid.

### Step 3: Verify Real-time is Enabled in Supabase

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Run this query:
```sql
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
```

**Should see:**
- `purchase_items` in the results
- `purchase_history` in the results

**If NOT enabled, run:**
```sql
-- Run FIX_REALTIME_SYNC.sql in Supabase SQL Editor
ALTER PUBLICATION supabase_realtime ADD TABLE purchase_items;
ALTER PUBLICATION supabase_realtime ADD TABLE purchase_history;
```

### Step 4: Verify RLS Policies Allow Access

1. Go to **Supabase Dashboard** → **Authentication** → **Policies**
2. Find `purchase_items` table
3. Should have policies allowing SELECT/INSERT/UPDATE/DELETE

**If missing, run:**
```sql
-- Run FIX_REALTIME_SYNC.sql in Supabase SQL Editor
-- This creates the necessary RLS policies
```

### Step 5: Test Real-time Sync

**On Device 1 (Desktop):**
1. Log in with username A
2. Add a new item
3. Check console: Should see `✅ Saved item to Supabase: ...`
4. Wait 1-2 seconds

**On Device 2 (Mobile):**
1. Log in with username B
2. Check console: Should see `✅ Real-time INSERT received: ...`
3. The item should appear automatically (no refresh needed)

**If item doesn't appear:**
- Check console for errors on Device 2
- Verify both devices show `✅ Real-time subscribed: purchase_items`
- Check Network tab → WebSocket connections (should see `websocket?apikey=...`)

### Step 6: Check Data Source

**On both devices, check console:**
```javascript
// Check if using Supabase or localStorage
checkSupabaseConfig()  // Should return true

// Check current items
items.length  // Should be same on both devices

// Check if real-time is active
realtimeSubscribed  // Should be true
```

## Common Issues and Fixes

### Issue 1: "Supabase not configured"
**Fix:** Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` are correct in `purchase.js`

### Issue 2: "Real-time subscriptions not active"
**Fix:** 
1. Check Supabase Dashboard → Database → Replication
2. Verify `purchase_items` is enabled
3. Run `FIX_REALTIME_SYNC.sql` if needed

### Issue 3: "CHANNEL_ERROR" in console
**Fix:**
1. Check RLS policies allow SELECT
2. Verify real-time is enabled in Supabase
3. Check browser console for specific error details

### Issue 4: Data saves but doesn't sync
**Symptoms:** 
- Console shows `✅ Saved item to Supabase`
- But other device doesn't receive update

**Fix:**
1. Check both devices show `✅ Real-time subscribed: purchase_items`
2. Verify WebSocket connections in Network tab
3. Check if `lastLocalUpdateIds` is blocking updates (should clear after 1 second)

### Issue 5: Different data on each device
**Symptoms:**
- Each device shows different items
- Changes on one device don't appear on the other

**Fix:**
1. Verify both devices are using Supabase (not localStorage)
2. Check console: Should NOT see `⚠️ Supabase not configured`
3. Both devices should load from same Supabase database
4. Clear localStorage and reload: `localStorage.clear(); location.reload();`

## Quick Test Script

Run this in browser console on both devices:

```javascript
// Test real-time sync
console.log('=== Real-time Sync Test ===');
console.log('Supabase configured:', checkSupabaseConfig());
console.log('Real-time subscribed:', realtimeSubscribed);
console.log('Items count:', items.length);
console.log('Current user:', currentUser?.nickname);
console.log('User role:', userRole);

// Check WebSocket connections
const wsConnections = performance.getEntriesByType('resource')
    .filter(r => r.name.includes('websocket'));
console.log('WebSocket connections:', wsConnections.length);

// Test: Add an item and watch for sync
console.log('💡 Add an item on this device, then check other device');
```

## Expected Behavior

**When working correctly:**
1. User A adds item on Desktop → Saved to Supabase → Real-time event sent
2. User B on Mobile receives real-time event → Item appears automatically (1-2 seconds)
3. Both devices show same data
4. Changes sync in both directions

**When NOT working:**
1. Each device uses its own localStorage
2. Changes don't sync
3. Different data on each device
4. Console shows errors or warnings

## Still Not Working?

1. **Check Supabase project status:**
   - Go to Supabase Dashboard
   - Verify project is active (not paused)

2. **Check network connectivity:**
   - Both devices need internet connection
   - Check firewall/proxy settings

3. **Clear cache and reload:**
   ```javascript
   localStorage.clear();
   location.reload();
   ```

4. **Verify table exists:**
   ```sql
   SELECT COUNT(*) FROM purchase_items;
   ```

5. **Check for errors in Supabase logs:**
   - Go to Supabase Dashboard → Logs
   - Look for errors related to `purchase_items`

## Contact Support

If still not working after following all steps:
1. Screenshot console errors from both devices
2. Screenshot Network tab showing WebSocket connections
3. Note which step failed in diagnosis
4. Check Supabase Dashboard for any error messages
