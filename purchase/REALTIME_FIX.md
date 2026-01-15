# Real-time Sync Fix

## Problem
When entering data from one device, it doesn't appear on another device.

## Changes Made

### 1. Improved Error Handling in `saveItemToSupabase()`
- Now handles missing authentication gracefully (doesn't fail if user not authenticated)
- Added detailed logging to track save operations
- Better error messages with error codes and hints

### 2. Enhanced Real-time Subscription Logging
- Added emoji indicators for better visibility in console
- Logs when items are added/updated/deleted via real-time
- Shows subscription status changes

### 3. Better Save Operation Feedback
- Warns when Supabase is not configured
- Warns when save fails but item is added locally
- Logs successful saves

## Testing Steps

1. **Open browser console (F12)** on both devices
2. **Check for subscription messages:**
   - Should see: `✅ Subscribed to purchase_items realtime changes`
   - If you see errors, check the error message

3. **Add an item on Device 1:**
   - Check console for: `💾 Saving item to Supabase:`
   - Should see: `✅ Item saved to Supabase successfully`
   - Check console on Device 2 for: `🔄 Purchase items changed: INSERT`
   - Should see: `➕ Adding new item: [item name]`

4. **If real-time doesn't work, check:**

   a. **Real-time enabled in Supabase?**
      - Go to Supabase Dashboard → SQL Editor
      - Run:
      ```sql
      ALTER PUBLICATION supabase_realtime ADD TABLE purchase_items;
      ALTER PUBLICATION supabase_realtime ADD TABLE purchase_history;
      ```

   b. **RLS Policies allow access?**
      - Go to Supabase Dashboard → Authentication → Policies
      - Check `purchase_items` table policies
      - Should allow SELECT, INSERT, UPDATE, DELETE for authenticated OR anonymous users

   c. **Check browser console for errors:**
      - Look for `❌` error messages
      - Check network tab for WebSocket connections (should see `realtime` connection)

## Common Issues

### Issue: "Supabase not configured"
- **Fix:** Check `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `purchase.js` lines 7-8
- Make sure they're correct and start with `https://` and `eyJ` respectively

### Issue: "Error subscribing to purchase_items changes"
- **Fix:** Real-time not enabled - run SQL commands above
- Or RLS policies blocking access - check policies

### Issue: Data saves but doesn't sync
- **Fix:** Check if real-time subscription is active (look for `✅ Subscribed` message)
- Check if both devices are on the same Supabase project
- Check network tab for WebSocket connection

### Issue: "No authenticated user" warnings
- **This is OK** - the app works without authentication
- Data will still save and sync if RLS policies allow anonymous access

## Next Steps

If real-time still doesn't work after these fixes:
1. Check Supabase Dashboard → Database → Replication
2. Verify `purchase_items` is listed and enabled
3. Check RLS policies allow anonymous access if not using auth
4. Check browser console for specific error messages
