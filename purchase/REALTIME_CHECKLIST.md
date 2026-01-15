# Real-time Sync Checklist

## ✅ Yes, it's possible! Here's how to verify it's working:

### Step 1: Check Real-time is Enabled in Supabase

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Run this to verify:
```sql
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
```
3. Should see `purchase_items` and `purchase_history` in the results

### Step 2: Check RLS Policies Allow Access

Real-time subscriptions need **SELECT** permission. Check:

1. Go to **Supabase Dashboard** → **Authentication** → **Policies**
2. Find `purchase_items` table
3. Should have a policy allowing SELECT

**If no policy exists, create one:**
```sql
-- Allow anonymous SELECT (for real-time subscriptions)
CREATE POLICY "Allow anonymous select" ON purchase_items
FOR SELECT USING (true);

-- Allow anonymous INSERT/UPDATE/DELETE (for all users)
CREATE POLICY "Allow anonymous insert" ON purchase_items
FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anonymous update" ON purchase_items
FOR UPDATE USING (true);

CREATE POLICY "Allow anonymous delete" ON purchase_items
FOR DELETE USING (true);
```

### Step 3: Test on Device 2 Console

**On Device 2, open browser console (F12) and look for:**

✅ **Good signs:**
- `🔄 setupRealtimeSubscriptions() called`
- `✅ Supabase configured, setting up real-time subscriptions...`
- `📡 purchase_items subscription status: SUBSCRIBED`
- `✅ Successfully subscribed to purchase_items realtime changes`

❌ **Bad signs:**
- `⚠️ Supabase not configured` → Check SUPABASE_URL and SUPABASE_ANON_KEY
- `⏱️ Subscription timed out` → Real-time not enabled or RLS blocking
- `❌ Error subscribing` → Check RLS policies

### Step 4: Test Real-time Sync

1. **Device 1**: Add a new item
   - Check console: Should see `💾 Saving item to Supabase:` → `✅ Item saved successfully`

2. **Device 2**: Watch console
   - Should see: `🔄 Purchase items changed: INSERT`
   - Should see: `➕ Adding new item: [item name]`
   - **Item should appear automatically** (no refresh needed!)

### Step 5: Check WebSocket Connection

1. Open **Network tab** in browser DevTools (F12)
2. Filter by **WS** (WebSocket)
3. Should see connection to: `wss://[your-project].supabase.co/realtime/v1/websocket`
4. Status should be **101 Switching Protocols** (connected)

### Common Issues & Fixes

#### Issue: "Subscription timed out"
**Fix:** Real-time not enabled
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE purchase_items;
ALTER PUBLICATION supabase_realtime ADD TABLE purchase_history;
```

#### Issue: "Error subscribing"
**Fix:** RLS policies blocking access - create policies (see Step 2)

#### Issue: Data saves but doesn't sync
**Fix:** 
- Check subscription status shows "SUBSCRIBED"
- Verify WebSocket connection in Network tab
- Check both devices use same Supabase project URL

#### Issue: Works locally but not on Vercel
**Fix:**
- Verify SUPABASE_URL and SUPABASE_ANON_KEY are correct in deployed version
- Check Vercel environment variables (if using them)
- Hard refresh both devices (Cmd+Shift+R)

### Expected Behavior

When working correctly:
- **Device 1 adds item** → Saved to Supabase → Real-time event fired
- **Device 2 receives event** → Item appears automatically (1-2 seconds)
- **No page refresh needed** on Device 2
- **Works for**: Add, Edit, Move, Delete operations

### Current Status

✅ Real-time subscriptions code is implemented
✅ Enhanced logging added for debugging
✅ Error handling improved
⏳ **Need to verify**: RLS policies and WebSocket connection

**Next step:** Check Device 2 console messages to see what's happening!
