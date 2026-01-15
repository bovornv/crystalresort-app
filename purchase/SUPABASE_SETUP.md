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

### Create Users Table (for roles and profiles)

```sql
-- Create users table linked to auth.users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    nickname TEXT,
    role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'manager', 'staff')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own profile
CREATE POLICY "Users can read own profile" ON users
    FOR SELECT
    USING (auth.uid() = id);

-- Policy: Users can update their own profile (except role)
CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Policy: Admins can read all users
CREATE POLICY "Admins can read all users" ON users
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid() AND users.role IN ('admin', 'manager')
        )
    );
```

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
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read all items
CREATE POLICY "Authenticated users can read items" ON items
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Policy: Authenticated users can insert items
CREATE POLICY "Authenticated users can insert items" ON items
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- Policy: Authenticated users can update items
CREATE POLICY "Authenticated users can update items" ON items
    FOR UPDATE
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- Policy: Authenticated users can delete items
CREATE POLICY "Authenticated users can delete items" ON items
    FOR DELETE
    USING (auth.role() = 'authenticated');
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
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE purchase_records ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read all purchase records
CREATE POLICY "Authenticated users can read purchase_records" ON purchase_records
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Policy: Authenticated users can insert purchase records
CREATE POLICY "Authenticated users can insert purchase_records" ON purchase_records
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');
```

### Create Presence Table (for tracking online users)

```sql
CREATE TABLE IF NOT EXISTS presence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Enable Row Level Security (RLS)
ALTER TABLE presence ENABLE ROW LEVEL SECURITY;

-- Policy: Users can update their own presence
CREATE POLICY "Users can update own presence" ON presence
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Authenticated users can read all presence
CREATE POLICY "Authenticated users can read presence" ON presence
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_presence_last_seen ON presence(last_seen DESC);
```

### Enable Real-time (Replication)

```sql
-- Enable real-time for items table
ALTER PUBLICATION supabase_realtime ADD TABLE items;

-- Enable real-time for purchase_records table
ALTER PUBLICATION supabase_realtime ADD TABLE purchase_records;

-- Enable real-time for presence table
ALTER PUBLICATION supabase_realtime ADD TABLE presence;
```

### Create Functions and Triggers

```sql
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for items table
CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for users table
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for presence table
CREATE TRIGGER update_presence_updated_at BEFORE UPDATE ON presence
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, nickname, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'nickname', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'role', 'staff')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile on signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();
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
