-- Fix status CHECK constraint to allow all room statuses
-- Run this in Supabase SQL Editor

-- Step 1: Check current CHECK constraints on status column
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'roomstatus_rooms'::regclass
  AND contype = 'c'
  AND conname LIKE '%status%';

-- Step 2: Drop the existing status CHECK constraint if it exists
ALTER TABLE roomstatus_rooms 
DROP CONSTRAINT IF EXISTS roomstatus_rooms_status_check;

-- Step 3: Add a new CHECK constraint that allows all valid room statuses
-- Based on the app, valid statuses include:
-- vacant, cleaned, stay_clean, checked_out, moved_out (migrated to checked_out), etc.
ALTER TABLE roomstatus_rooms 
ADD CONSTRAINT roomstatus_rooms_status_check 
CHECK (status IN (
  'vacant',
  'cleaned',
  'stay_clean',
  'checked_out',
  'moved_out',  -- Keep for backward compatibility, will be migrated to checked_out
  'occupied',
  'dirty',
  'out_of_order',
  'maintenance'
) OR status IS NULL);

-- Alternative: If you want to allow ANY text value (more flexible)
-- Uncomment this and comment out the above:
-- ALTER TABLE roomstatus_rooms 
-- ADD CONSTRAINT roomstatus_rooms_status_check 
-- CHECK (status IS NOT NULL AND status != '');

-- Step 4: Verify the constraint was added
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'roomstatus_rooms'::regclass
  AND contype = 'c'
  AND conname LIKE '%status%';
