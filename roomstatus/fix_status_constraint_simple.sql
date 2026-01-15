-- Simple fix: Remove restrictive CHECK constraint on status column
-- This allows any status value (more flexible)
-- Run this in Supabase SQL Editor

-- Step 1: Drop the existing status CHECK constraint
ALTER TABLE roomstatus_rooms 
DROP CONSTRAINT IF EXISTS roomstatus_rooms_status_check;

-- Step 2: Verify it was dropped
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'roomstatus_rooms'::regclass
  AND contype = 'c'
  AND conname LIKE '%status%';

-- If the query returns no rows, the constraint was successfully removed!

-- Note: The status column will still have NOT NULL constraint from the column definition,
-- but it can now accept any text value, which gives the app flexibility.
