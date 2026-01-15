# Supabase Setup Guide for Room Status App

This guide will help you set up Supabase as the realtime data source for the Room Status tool.

## Step 1: Set Environment Variables in Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project: `crystalresort-app`
3. Go to **Settings** → **Environment Variables**
4. Add the following variables:

### Required Variables:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**How to get these values:**
1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your project (or create a new one)
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL** → Use as `VITE_SUPABASE_URL`
   - **anon/public key** → Use as `VITE_SUPABASE_ANON_KEY`

5. **Important:** Make sure to add these variables for:
   - ✅ Production
   - ✅ Preview
   - ✅ Development

6. After adding variables, **redeploy** your application for changes to take effect.

## Step 2: Create Supabase Table Structure

Run the following SQL in your Supabase SQL Editor:

1. Go to Supabase Dashboard → **SQL Editor**
2. Click **New query**
3. Paste and run the SQL script below:

```sql
-- Create roomstatus_rooms table
CREATE TABLE IF NOT EXISTS roomstatus_rooms (
  room_number TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT '',
  floor INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'vacant',
  maid TEXT NOT NULL DEFAULT '',
  remark TEXT NOT NULL DEFAULT '',
  cleaned_today BOOLEAN NOT NULL DEFAULT false,
  border TEXT NOT NULL DEFAULT 'black',
  vacant_since TIMESTAMPTZ,
  was_purple_before_cleaned BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on room_number for faster lookups
CREATE INDEX IF NOT EXISTS idx_roomstatus_rooms_room_number ON roomstatus_rooms(room_number);

-- Create index on updated_at for sorting
CREATE INDEX IF NOT EXISTS idx_roomstatus_rooms_updated_at ON roomstatus_rooms(updated_at);

-- Enable Row Level Security (RLS) - Allow all operations for now (internal tool)
ALTER TABLE roomstatus_rooms ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (since this is an internal tool without auth)
CREATE POLICY "Allow all operations on roomstatus_rooms"
  ON roomstatus_rooms
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at on row changes
CREATE TRIGGER update_roomstatus_rooms_updated_at
  BEFORE UPDATE ON roomstatus_rooms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

## Step 3: Enable Realtime for roomstatus_rooms Table

1. Go to Supabase Dashboard → **Database** → **Replication**
2. Find `roomstatus_rooms` in the table list
3. Toggle **Realtime** to **ON** (enabled)
4. Ensure it shows a green checkmark ✓

**Alternative method (SQL):**
```sql
-- Enable Realtime for roomstatus_rooms table
ALTER PUBLICATION supabase_realtime ADD TABLE roomstatus_rooms;
```

## Step 4: Verify Setup

After completing steps 1-3:

1. **Redeploy your Vercel application** (to pick up environment variables)
2. Open your app at `https://crystalresort-app.vercel.app/roomstatus/`
3. Open browser console (F12)
4. Look for these console messages:
   - ✅ "Realtime connected"
   - ✅ "Initial load from Supabase completed" (or "Initialized Supabase with default rooms")

5. **Test realtime sync:**
   - Open the app in two browser tabs/windows
   - Change a room status in one tab
   - Verify it updates instantly in the other tab
   - Check console for: "Room updated from Supabase"

## Troubleshooting

### "Realtime connected" not appearing
- Check that Realtime is enabled in Supabase Dashboard → Database → Replication
- Verify environment variables are set correctly in Vercel
- Check browser console for connection errors

### "Error loading from Supabase"
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are correct
- Check Supabase Dashboard → Settings → API for correct values
- Ensure table `roomstatus_rooms` exists and has correct structure

### Changes not syncing between devices
- Verify Realtime is enabled for `roomstatus_rooms` table
- Check browser console for "Room updated from Supabase" messages
- Ensure both devices have the latest deployment

### Table structure issues
- Run the SQL script again to ensure all columns exist
- Check Supabase Dashboard → Table Editor → `roomstatus_rooms` to verify columns

## Notes

- The app will automatically initialize with default rooms if the table is empty
- All room updates update the `updated_at` timestamp automatically
- Last write wins: If two users update the same room simultaneously, the latest update takes precedence
- Firebase code is kept for backward compatibility but Supabase is now the primary data source
