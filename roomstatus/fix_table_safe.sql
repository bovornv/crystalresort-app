-- Safe fix for roomstatus_rooms table
-- Handles foreign key dependencies properly
-- Run this in Supabase SQL Editor

-- Step 1: Check current primary key
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

-- Step 2: Check foreign key dependencies
SELECT
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND ccu.table_name = 'roomstatus_rooms';

-- Step 3: Add all missing columns first
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

ALTER TABLE roomstatus_rooms 
ADD COLUMN IF NOT EXISTS room_number TEXT;

-- Step 4: Check if room_number is already the primary key
DO $$
DECLARE
  pk_column TEXT;
BEGIN
  -- Get the current primary key column
  SELECT kcu.column_name INTO pk_column
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'roomstatus_rooms'
    AND tc.constraint_type = 'PRIMARY KEY'
  LIMIT 1;
  
  -- If room_number is already the primary key, we're done!
  IF pk_column = 'room_number' THEN
    RAISE NOTICE '✅ room_number is already the PRIMARY KEY - no changes needed!';
  ELSE
    RAISE NOTICE '⚠️ Current PRIMARY KEY is on column: %', pk_column;
    RAISE NOTICE '⚠️ Cannot change PRIMARY KEY because foreign key constraint exists';
    RAISE NOTICE '⚠️ Please ensure room_number values match the current primary key column';
  END IF;
END $$;

-- Step 5: If primary key is NOT on room_number, we need to:
-- Option A: Drop foreign key, change primary key, recreate foreign key
-- Option B: Keep existing primary key and ensure room_number has unique constraint

-- Let's try Option B first (safer): Add UNIQUE constraint to room_number
DO $$
BEGIN
  -- Check if room_number already has a unique constraint
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'roomstatus_rooms'
      AND tc.constraint_type = 'UNIQUE'
      AND kcu.column_name = 'room_number'
  ) THEN
    -- Add unique constraint to room_number
    ALTER TABLE roomstatus_rooms 
    ADD CONSTRAINT roomstatus_rooms_room_number_unique UNIQUE (room_number);
    
    RAISE NOTICE '✅ Added UNIQUE constraint to room_number';
  ELSE
    RAISE NOTICE '✓ room_number already has UNIQUE constraint';
  END IF;
END $$;

-- Step 6: Verify final state
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'roomstatus_rooms'
ORDER BY ordinal_position;

-- Check constraints
SELECT 
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'roomstatus_rooms'
  AND (tc.constraint_type = 'PRIMARY KEY' OR tc.constraint_type = 'UNIQUE')
ORDER BY tc.constraint_type, kcu.column_name;
