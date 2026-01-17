# Fix Announcement Box Realtime Sync

## Problem
The announcement box realtime subscription shows `✅ Announcement realtime subscribed` but then immediately closes with `⚠️ Announcement realtime subscription error: CLOSED undefined`.

## Root Cause
The `announcements` table is not enabled for Supabase Realtime, or RLS policies are blocking the subscription.

## Solution

### Step 1: Enable Realtime on the Table

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Click **"New Query"**
3. Run this SQL:

```sql
-- Enable Realtime for announcements table
DO $$
BEGIN
    -- Check if announcements is already in the publication
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'announcements'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE announcements;
        RAISE NOTICE 'Added announcements to real-time publication';
    ELSE
        RAISE NOTICE 'announcements is already in real-time publication';
    END IF;
END $$;
```

### Step 2: Verify Realtime is Enabled

Run this query to check:

```sql
SELECT * FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename = 'announcements';
```

You should see one row with `announcements` in the results.

### Step 3: Verify RLS Policies

Make sure RLS policies allow SELECT (required for realtime subscriptions):

```sql
-- Check existing policies
SELECT * FROM pg_policies 
WHERE tablename = 'announcements';

-- If no policy exists, create one:
CREATE POLICY "Allow all operations on announcements" ON announcements
  FOR ALL
  USING (true)
  WITH CHECK (true);
```

### Step 4: Test

1. Refresh your browser
2. Open browser console (F12)
3. You should see: `✅ Announcement realtime subscribed` (without the CLOSED error)
4. Test sync: Edit announcement on desktop → Should appear on mobile within 1-2 seconds

## Alternative: Use the Complete Setup Script

Run the updated `create_announcements_table.sql` file which includes the proper Realtime setup with error handling.
