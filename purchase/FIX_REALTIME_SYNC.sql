-- ============================================
-- Fix Real-time Sync Across Devices
-- ============================================
-- Run this SQL in Supabase SQL Editor to enable real-time sync
-- This allows changes on one device to appear on other devices instantly
-- ============================================

-- Step 1: Enable Real-time Replication for purchase_items table
-- This allows Supabase to send real-time updates via WebSocket
-- Use DO block to handle case where table is already in publication
DO $$
BEGIN
    -- Check if purchase_items is already in the publication
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'purchase_items'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE purchase_items;
        RAISE NOTICE 'Added purchase_items to real-time publication';
    ELSE
        RAISE NOTICE 'purchase_items is already in real-time publication';
    END IF;
END $$;

-- Step 2: Enable Real-time Replication for purchase_history table (optional)
DO $$
BEGIN
    -- Check if purchase_history is already in the publication
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'purchase_history'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE purchase_history;
        RAISE NOTICE 'Added purchase_history to real-time publication';
    ELSE
        RAISE NOTICE 'purchase_history is already in real-time publication';
    END IF;
END $$;

-- Step 3: Verify Real-time is Enabled
-- Run this to check if tables are enabled for real-time:
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- ============================================
-- Step 4: Fix RLS Policies for Real-time
-- ============================================
-- Real-time subscriptions need SELECT permission
-- If RLS is enabled, we need policies that allow anonymous access
-- (since the app uses nickname-based login, not Supabase Auth)

-- Drop existing policies if they exist (optional - only if you want to recreate)
-- DROP POLICY IF EXISTS "Allow anonymous select" ON purchase_items;
-- DROP POLICY IF EXISTS "Allow anonymous insert" ON purchase_items;
-- DROP POLICY IF EXISTS "Allow anonymous update" ON purchase_items;
-- DROP POLICY IF EXISTS "Allow anonymous delete" ON purchase_items;

-- Create policies that allow anonymous access (for real-time subscriptions)
-- This allows any user (even without Supabase Auth) to read/write data
-- Since the app uses nickname-based login, we need anonymous policies

-- Drop existing policies first (to avoid conflicts)
DROP POLICY IF EXISTS "Allow anonymous select" ON purchase_items;
DROP POLICY IF EXISTS "Allow anonymous insert" ON purchase_items;
DROP POLICY IF EXISTS "Allow anonymous update" ON purchase_items;
DROP POLICY IF EXISTS "Allow anonymous delete" ON purchase_items;
DROP POLICY IF EXISTS "Allow anonymous select history" ON purchase_history;
DROP POLICY IF EXISTS "Allow anonymous insert history" ON purchase_history;

-- Allow SELECT (required for real-time subscriptions)
CREATE POLICY "Allow anonymous select" ON purchase_items
FOR SELECT USING (true);

-- Allow INSERT (for adding items)
CREATE POLICY "Allow anonymous insert" ON purchase_items
FOR INSERT WITH CHECK (true);

-- Allow UPDATE (for editing/moving items)
CREATE POLICY "Allow anonymous update" ON purchase_items
FOR UPDATE USING (true) WITH CHECK (true);

-- Allow DELETE (for deleting items)
CREATE POLICY "Allow anonymous delete" ON purchase_items
FOR DELETE USING (true);

-- Same policies for purchase_history table
CREATE POLICY "Allow anonymous select history" ON purchase_history
FOR SELECT USING (true);

CREATE POLICY "Allow anonymous insert history" ON purchase_history
FOR INSERT WITH CHECK (true);

-- ============================================
-- Step 5: Verify RLS is Enabled
-- ============================================
-- Check if RLS is enabled on tables:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('purchase_items', 'purchase_history');

-- Enable RLS if not already enabled (optional - only if needed)
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_history ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Verification Queries
-- ============================================

-- Check if real-time is enabled:
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- Check RLS policies:
-- SELECT * FROM pg_policies WHERE tablename IN ('purchase_items', 'purchase_history');

-- Check if tables exist:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('purchase_items', 'purchase_history');
