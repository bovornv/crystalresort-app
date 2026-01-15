-- Complete fix for roomstatus_rooms table
-- This ensures all columns exist AND room_number is PRIMARY KEY
-- Run this in Supabase SQL Editor

-- Step 1: Check current table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'roomstatus_rooms'
ORDER BY ordinal_position;

-- Step 2: Add all missing columns
ALTER TABLE roomstatus_rooms 
ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT '';

ALTER TABLE roomstatus_rooms 
ADD COLUMN IF NOT EXISTS floor INTEGER NOT NULL DEFAULT 1;

ALTER TABLE roomstatus_rooms 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'vacant';

ALTER TABLE roomstatus_rooms 
ADD COLUMN IF NOT EXISTS maid TEXT NOT NULL DEFAULT '';

ALTER TABLE roomstatus_rooms 
ADD COLUMN IF NOT EXISTS remark TEXT NOT NULL DEFAULT '';

ALTER TABLE roomstatus_rooms 
ADD COLUMN IF NOT EXISTS cleaned_today BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE roomstatus_rooms 
ADD COLUMN IF NOT EXISTS border TEXT NOT NULL DEFAULT 'black';

ALTER TABLE roomstatus_rooms 
ADD COLUMN IF NOT EXISTS vacant_since TIMESTAMPTZ;

ALTER TABLE roomstatus_rooms 
ADD COLUMN IF NOT EXISTS was_purple_before_cleaned BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE roomstatus_rooms 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Step 3: Ensure room_number is PRIMARY KEY
-- First, check if it's already a primary key
DO $$
BEGIN
  -- Check if room_number is already a primary key
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'roomstatus_rooms'
      AND tc.constraint_type = 'PRIMARY KEY'
      AND kcu.column_name = 'room_number'
  ) THEN
    -- If room_number column doesn't exist, add it first
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'roomstatus_rooms' 
      AND column_name = 'room_number'
    ) THEN
      ALTER TABLE roomstatus_rooms ADD COLUMN room_number TEXT;
    END IF;
    
    -- Drop existing primary key if it exists on a different column
    ALTER TABLE roomstatus_rooms DROP CONSTRAINT IF EXISTS roomstatus_rooms_pkey;
    
    -- Add primary key constraint
    ALTER TABLE roomstatus_rooms ADD PRIMARY KEY (room_number);
    
    RAISE NOTICE '✅ Added PRIMARY KEY constraint to room_number';
  ELSE
    RAISE NOTICE '✓ room_number already has PRIMARY KEY constraint';
  END IF;
END $$;

-- Step 4: Verify the fix
SELECT 
  tc.constraint_name, 
  tc.constraint_type,
  kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'roomstatus_rooms'
  AND tc.constraint_type = 'PRIMARY KEY';

-- Step 5: Verify all columns exist
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'roomstatus_rooms'
ORDER BY ordinal_position;

-- Expected result:
-- room_number should show as PRIMARY KEY
-- All 11 columns should exist
