# Supabase Setup Guide

This guide will help you set up Supabase for real-time multi-device synchronization of your Procurement Board.

## Step 1: Create a Supabase Account

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up for a free account (or log in if you already have one)
3. Create a new project
4. Wait for the project to finish setting up (takes 1-2 minutes)

## Step 2: Get Your Project Credentials

1. In your Supabase project dashboard, go to **Settings** → **API**
2. Copy your **Project URL** (looks like: `https://xxxxx.supabase.co`)
3. Copy your **anon/public key** (long string starting with `eyJ...`)

## Step 3: Create Database Tables

In your Supabase project, go to **SQL Editor** and run these SQL commands:

### Create Items Table

```sql
CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    quantity NUMERIC NOT NULL,
    unit TEXT NOT NULL,
    supplier TEXT NOT NULL,
    status TEXT NOT NULL,
    requested_qty NUMERIC DEFAULT 0,
    received_qty NUMERIC DEFAULT 0,
    urgency TEXT DEFAULT 'normal',
    notes TEXT,
    issue_type TEXT,
    issue_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (you can restrict this later)
CREATE POLICY "Allow all operations" ON items
    FOR ALL
    USING (true)
    WITH CHECK (true);
```

### Create Purchase Records Table

```sql
CREATE TABLE IF NOT EXISTS purchase_records (
    id TEXT PRIMARY KEY,
    date TIMESTAMPTZ NOT NULL,
    item_name TEXT NOT NULL,
    supplier TEXT NOT NULL,
    quantity NUMERIC NOT NULL,
    unit TEXT NOT NULL,
    status TEXT NOT NULL,
    receiver JSONB,
    issue_type TEXT,
    issue_reason TEXT,
    item_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE purchase_records ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations
CREATE POLICY "Allow all operations" ON purchase_records
    FOR ALL
    USING (true)
    WITH CHECK (true);
```

### Enable Real-time (Replication)

```sql
-- Enable real-time for items table
ALTER PUBLICATION supabase_realtime ADD TABLE items;

-- Enable real-time for purchase_records table
ALTER PUBLICATION supabase_realtime ADD TABLE purchase_records;
```

## Step 4: Configure Your App

1. Open `purchase.js` in your code editor
2. Find these lines near the top of the file:

```javascript
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

3. Replace `YOUR_SUPABASE_URL` with your Project URL from Step 2
4. Replace `YOUR_SUPABASE_ANON_KEY` with your anon key from Step 2

Example:
```javascript
const SUPABASE_URL = 'https://abcdefghijklmnop.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

## Step 5: Test the Setup

1. Open your app in a browser
2. Open the browser console (F12 → Console tab)
3. You should see no errors related to Supabase
4. Add an item - it should sync to Supabase
5. Open the same app on another device/browser - changes should appear in real-time

## Troubleshooting

### "Supabase not configured" warning
- Make sure you've replaced both `YOUR_SUPABASE_URL` and `YOUR_SUPABASE_ANON_KEY`
- Check that there are no extra spaces or quotes

### Real-time updates not working
- Verify that you ran the `ALTER PUBLICATION` commands in Step 3
- Check the Supabase dashboard → Database → Replication to see if tables are enabled

### Data not syncing
- Check browser console for errors
- Verify your Supabase project is active (not paused)
- Check that Row Level Security policies are set correctly

### Still using localStorage
- The app will automatically fall back to localStorage if Supabase is not configured
- Check that your credentials are correct and the Supabase client initialized successfully

## Security Notes

- The current setup uses public access (anyone with the URL can read/write)
- For production, you should:
  1. Set up proper authentication
  2. Create more restrictive Row Level Security policies
  3. Consider using Supabase Auth for user management

## Need Help?

- Supabase Docs: https://supabase.com/docs
- Supabase Discord: https://discord.supabase.com
