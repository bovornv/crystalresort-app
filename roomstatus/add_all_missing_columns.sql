-- Add ALL missing columns to roomstatus_rooms table
-- Run this in Supabase SQL Editor to fix the table schema

-- Add border column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'roomstatus_rooms' 
    AND column_name = 'border'
  ) THEN
    ALTER TABLE roomstatus_rooms ADD COLUMN border TEXT NOT NULL DEFAULT 'black';
    RAISE NOTICE '✅ Added border column';
  ELSE
    RAISE NOTICE '✓ border column already exists';
  END IF;
END $$;

-- Add cleaned_today column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'roomstatus_rooms' 
    AND column_name = 'cleaned_today'
  ) THEN
    ALTER TABLE roomstatus_rooms ADD COLUMN cleaned_today BOOLEAN NOT NULL DEFAULT false;
    RAISE NOTICE '✅ Added cleaned_today column';
  ELSE
    RAISE NOTICE '✓ cleaned_today column already exists';
  END IF;
END $$;

-- Add vacant_since column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'roomstatus_rooms' 
    AND column_name = 'vacant_since'
  ) THEN
    ALTER TABLE roomstatus_rooms ADD COLUMN vacant_since TIMESTAMPTZ;
    RAISE NOTICE '✅ Added vacant_since column';
  ELSE
    RAISE NOTICE '✓ vacant_since column already exists';
  END IF;
END $$;

-- Add was_purple_before_cleaned column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'roomstatus_rooms' 
    AND column_name = 'was_purple_before_cleaned'
  ) THEN
    ALTER TABLE roomstatus_rooms ADD COLUMN was_purple_before_cleaned BOOLEAN NOT NULL DEFAULT false;
    RAISE NOTICE '✅ Added was_purple_before_cleaned column';
  ELSE
    RAISE NOTICE '✓ was_purple_before_cleaned column already exists';
  END IF;
END $$;

-- Add updated_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'roomstatus_rooms' 
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE roomstatus_rooms ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    RAISE NOTICE '✅ Added updated_at column';
  ELSE
    RAISE NOTICE '✓ updated_at column already exists';
  END IF;
END $$;

-- Verify all columns exist
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'roomstatus_rooms'
ORDER BY ordinal_position;

-- Expected columns after running this script:
-- 1. room_number (TEXT, PRIMARY KEY)
-- 2. type (TEXT)
-- 3. floor (INTEGER)
-- 4. status (TEXT)
-- 5. maid (TEXT)
-- 6. remark (TEXT)
-- 7. cleaned_today (BOOLEAN) ← Was missing
-- 8. border (TEXT) ← Was missing
-- 9. vacant_since (TIMESTAMPTZ)
-- 10. was_purple_before_cleaned (BOOLEAN)
-- 11. updated_at (TIMESTAMPTZ)
