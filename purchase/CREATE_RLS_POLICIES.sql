-- ============================================================================
-- RLS Policies for Purchase Tool
-- Run this in Supabase SQL Editor to allow real-time sync
-- ============================================================================

-- Enable RLS (if not already enabled)
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_history ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- purchase_items Policies
-- ============================================================================

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow anonymous select" ON purchase_items;
DROP POLICY IF EXISTS "Allow anonymous insert" ON purchase_items;
DROP POLICY IF EXISTS "Allow anonymous update" ON purchase_items;
DROP POLICY IF EXISTS "Allow anonymous delete" ON purchase_items;

-- Policy: Allow anyone to SELECT (read) items
-- This is needed for real-time subscriptions to work
CREATE POLICY "Allow anonymous select" ON purchase_items
FOR SELECT
USING (true);

-- Policy: Allow anyone to INSERT (add) items
CREATE POLICY "Allow anonymous insert" ON purchase_items
FOR INSERT
WITH CHECK (true);

-- Policy: Allow anyone to UPDATE (edit) items
CREATE POLICY "Allow anonymous update" ON purchase_items
FOR UPDATE
USING (true)
WITH CHECK (true);

-- Policy: Allow anyone to DELETE items
CREATE POLICY "Allow anonymous delete" ON purchase_items
FOR DELETE
USING (true);

-- ============================================================================
-- purchase_history Policies
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow anonymous select" ON purchase_history;
DROP POLICY IF EXISTS "Allow anonymous insert" ON purchase_history;

-- Policy: Allow anyone to SELECT (read) history
CREATE POLICY "Allow anonymous select" ON purchase_history
FOR SELECT
USING (true);

-- Policy: Allow anyone to INSERT (add) history records
CREATE POLICY "Allow anonymous insert" ON purchase_history
FOR INSERT
WITH CHECK (true);

-- ============================================================================
-- Verify Policies
-- ============================================================================

-- Check policies were created
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename IN ('purchase_items', 'purchase_history')
ORDER BY tablename, policyname;
