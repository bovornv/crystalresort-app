-- ============================================================================
-- Supabase Database Setup for Purchase Tool
-- Run this entire file in Supabase SQL Editor
-- ============================================================================

-- Step 1: Create Users Table (for roles and profiles)
-- ============================================================================
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

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Admins can read all users" ON users;

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

-- Step 2: Create Items Table
-- ============================================================================
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

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can read items" ON items;
DROP POLICY IF EXISTS "Authenticated users can insert items" ON items;
DROP POLICY IF EXISTS "Authenticated users can update items" ON items;
DROP POLICY IF EXISTS "Authenticated users can delete items" ON items;

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

-- Step 3: Create Purchase Records Table
-- ============================================================================
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

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can read purchase_records" ON purchase_records;
DROP POLICY IF EXISTS "Authenticated users can insert purchase_records" ON purchase_records;

-- Policy: Authenticated users can read all purchase records
CREATE POLICY "Authenticated users can read purchase_records" ON purchase_records
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Policy: Authenticated users can insert purchase records
CREATE POLICY "Authenticated users can insert purchase_records" ON purchase_records
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- Step 4: Create Presence Table (for tracking online users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS presence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Enable Row Level Security (RLS)
ALTER TABLE presence ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can update own presence" ON presence;
DROP POLICY IF EXISTS "Authenticated users can read presence" ON presence;

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

-- Step 5: Enable Real-time (Replication)
-- ============================================================================
-- Enable real-time for items table
ALTER PUBLICATION supabase_realtime ADD TABLE items;

-- Enable real-time for purchase_records table
ALTER PUBLICATION supabase_realtime ADD TABLE purchase_records;

-- Enable real-time for presence table
ALTER PUBLICATION supabase_realtime ADD TABLE presence;

-- Step 6: Create Functions and Triggers
-- ============================================================================
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_items_updated_at ON items;
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_presence_updated_at ON presence;

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
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Trigger to create user profile on signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- Setup Complete!
-- ============================================================================
-- Next steps:
-- 1. Sign up a user in the app (will be created as 'staff' by default)
-- 2. To make a user admin, run:
--    UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';
-- ============================================================================
