# Common Areas Migration to Supabase

This document guides you through migrating common areas from Firebase to Supabase.

## Overview

Common areas (ส่วนกลาง) are now migrated to use Supabase as the real-time data source. This includes:
- ล็อบบี้ (Lobby)
- ห้องน้ำสวน (Garden Toilet)
- ลิฟต์ (Lift)
- ห้องทานข้าว (Dining Room)
- ห้องผ้าสต็อค (Linen Stock)
- ทางเดินชั้น X (Hallways)

## Step 1: Create Supabase Table

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the entire contents of `migrate_common_areas.sql`
4. Paste and run the SQL script
5. Verify the table was created:
   - Go to **Table Editor**
   - You should see `common_areas` table with columns: `id`, `area`, `time`, `status`, `maid`, `border`, `updated_at`, `updated_by`

## Step 2: Verify Realtime is Enabled

1. Go to **Database** → **Replication**
2. Find `common_areas` in the list
3. Ensure it's enabled (toggle should be ON)
4. If not enabled, click the toggle to enable it

## Step 3: Deploy Code Changes

The code changes have been committed. After deployment:

1. Push to Git (if not already done):
   ```bash
   git add src/components/Dashboard.jsx src/components/CommonAreaCard.jsx migrate_common_areas.sql COMMON_AREAS_MIGRATION.md
   git commit -m "Migrate common areas from Firebase to Supabase"
   git push
   ```

2. Wait for Vercel deployment to complete

## Step 4: Verify Migration

After deployment, check the browser console:

### Expected Console Output (Supabase configured):
```
✅ Supabase environment variables detected
✅ Initial load of common areas from Supabase completed
Common areas realtime connected
```

### Expected Console Output (Supabase NOT configured - Firebase fallback):
```
⚠️ Supabase not configured - common areas will use Firebase fallback
```

## Step 5: Test Functionality

1. **Mark an area as cleaned:**
   - Click on a common area card (e.g., "ล็อบบี้" → "เช้า")
   - Click "สะอาด" button
   - Verify the button turns green and shows your nickname
   - Check console: `✅ Successfully saved to Supabase`

2. **Select an area (red border):**
   - Click on a common area card
   - Click "เลือกพื้นที่นี้"
   - Verify the border turns red and shows your nickname
   - Check console: `✅ Successfully saved to Supabase`

3. **Real-time sync:**
   - Open the app in two different browsers/devices
   - Mark an area as cleaned in one device
   - Verify it updates immediately in the other device
   - Check console: `✅ Common areas updated from Supabase`

4. **Clear all data (FO only):**
   - Login as "FO"
   - Click "ลบข้อมูลทั้งหมด"
   - Confirm the action
   - Verify all common areas reset to "waiting" (red) state
   - Check console: `✅ Successfully cleared X common areas to waiting state`

## Migration Notes

- **Backward Compatibility:** The code includes Firebase fallback if Supabase environment variables are not configured
- **Data Structure:** Common areas use the same structure as before:
  - `id`: Document ID (e.g., "lobby-morning", "toilet-cafe-afternoon")
  - `area`: Thai name (e.g., "ล็อบบี้", "ห้องน้ำสวน")
  - `time`: "เช้า" or "บ่าย"
  - `status`: "waiting" or "cleaned"
  - `maid`: Nickname string
  - `border`: "black" or "red"
- **Real-time Updates:** Changes are synced in real-time across all devices via Supabase Realtime

## Troubleshooting

### Common areas not loading
- Check that `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in Vercel environment variables
- Verify the `common_areas` table exists in Supabase
- Check browser console for errors

### Real-time not working
- Verify Realtime is enabled for `common_areas` table in Supabase dashboard
- Check browser console for "Common areas realtime connected" message
- Ensure you're not blocking WebSocket connections

### Data not saving
- Check browser console for error messages
- Verify RLS policies allow INSERT/UPDATE operations
- Check that the `common_areas` table has all required columns

## Next Steps

After successful migration:
- Monitor console logs for any errors
- Test all common area functionality
- Consider migrating remaining Firebase features (report counts, unoccupied rooms) to Supabase
