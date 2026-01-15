# Debug Real-time Sync Issues

## Step 1: Check Console Messages

Open browser console (F12) on **Device 2** and look for these messages:

### Expected Messages (if working):
- `🔄 setupRealtimeSubscriptions() called`
- `✅ Supabase configured, setting up real-time subscriptions...`
- `📡 purchase_items subscription status: SUBSCRIBED`
- `✅ Successfully subscribed to purchase_items realtime changes`

### Error Messages (if not working):
- `⚠️ Supabase not configured` - Check SUPABASE_URL and SUPABASE_ANON_KEY
- `❌ Error subscribing` - Real-time not enabled or RLS blocking
- `⏱️ Subscription timed out` - Real-time not enabled in Supabase

## Step 2: Verify Supabase Configuration

Check `purchase.js` lines 7-8:
```javascript
const SUPABASE_URL = 'https://kfyjuzmruutgltpytrqm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

Both should be set and valid.

## Step 3: Enable Real-time in Supabase

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Run these commands:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE purchase_items;
ALTER PUBLICATION supabase_realtime ADD TABLE purchase_history;
```
3. Click **Run**
4. Should see "Success" message

## Step 4: Check RLS Policies

Real-time subscriptions need SELECT permission. Check:

1. Go to **Supabase Dashboard** → **Authentication** → **Policies**
2. Find `purchase_items` table
3. Should have a policy allowing SELECT for:
   - Authenticated users, OR
   - Anonymous users (if not using auth)

If no policy exists, create one:
```sql
-- Allow anonymous SELECT (for real-time subscriptions)
CREATE POLICY "Allow anonymous select" ON purchase_items
FOR SELECT USING (true);
```

## Step 5: Test Real-time

1. **Device 1**: Add an item
   - Check console for: `💾 Saving item to Supabase:`
   - Should see: `✅ Item saved to Supabase successfully`

2. **Device 2**: Watch console
   - Should see: `🔄 Purchase items changed: INSERT`
   - Should see: `➕ Adding new item: [item name]`
   - Item should appear in UI automatically

## Step 6: Check Network Tab

1. Open **Network tab** in browser DevTools
2. Filter by "WS" (WebSocket)
3. Should see connection to `wss://[your-project].supabase.co/realtime/v1/websocket`
4. Status should be "101 Switching Protocols" (connected)

## Common Issues

### Issue: "Supabase not configured"
**Fix:** Check SUPABASE_URL and SUPABASE_ANON_KEY are correct

### Issue: "Subscription timed out"
**Fix:** Real-time not enabled - run SQL commands in Step 3

### Issue: "Error subscribing"
**Fix:** Check RLS policies allow SELECT (Step 4)

### Issue: Data saves but doesn't sync
**Fix:** 
- Check subscription status shows "SUBSCRIBED"
- Verify WebSocket connection in Network tab
- Check both devices use same Supabase project

### Issue: Solana extension errors
**Fix:** Ignore these - they're from browser extension, not our code

## Still Not Working?

1. Check Supabase project is **active** (not paused)
2. Verify **both devices** are using the same Supabase URL
3. Check browser console for **specific error messages**
4. Try **hard refresh** (Cmd+Shift+R / Ctrl+Shift+R)
5. Check if **WebSocket connections** are blocked by firewall/proxy
