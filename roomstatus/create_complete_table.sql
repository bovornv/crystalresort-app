-- Complete table schema fix for roomstatus_rooms
-- This script ensures ALL required columns exist
-- Run this in Supabase SQL Editor

-- First, let's see what columns currently exist
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'roomstatus_rooms'
ORDER BY ordinal_position;

-- Add ALL required columns (safe to run multiple times)
ALTER TABLE roomstatus_rooms 
ADD COLUMN IF NOT EXISTS room_number TEXT PRIMARY KEY,
ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS floor INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'vacant',
ADD COLUMN IF NOT EXISTS maid TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS remark TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS cleaned_today BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS border TEXT NOT NULL DEFAULT 'black',
ADD COLUMN IF NOT EXISTS vacant_since TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS was_purple_before_cleaned BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Note: The above might fail if room_number is already PRIMARY KEY
-- So let's do it column by column instead:

-- Add type column if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'roomstatus_rooms' AND column_name = 'type') THEN
    ALTER TABLE roomstatus_rooms ADD COLUMN type TEXT NOT NULL DEFAULT '';
  END IF;
END $$;

-- Add floor column if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'roomstatus_rooms' AND column_name = 'floor') THEN
    ALTER TABLE roomstatus_rooms ADD COLUMN floor INTEGER NOT NULL DEFAULT 1;
  END IF;
END $$;

-- Add status column if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'roomstatus_rooms' AND column_name = 'status') THEN
    ALTER TABLE roomstatus_rooms ADD COLUMN status TEXT NOT NULL DEFAULT 'vacant';
  END IF;
END $$;

-- Add maid column if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'roomstatus_rooms' AND column_name = 'maid') THEN
    ALTER TABLE roomstatus_rooms ADD COLUMN maid TEXT NOT NULL DEFAULT '';
  END IF;
END $$;

-- Add remark column if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'roomstatus_rooms' AND column_name = 'remark') THEN
    ALTER TABLE roomstatus_rooms ADD COLUMN remark TEXT NOT NULL DEFAULT '';
  END IF;
END $$;

-- Add cleaned_today column if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'roomstatus_rooms' AND column_name = 'cleaned_today') THEN
    ALTER TABLE roomstatus_rooms ADD COLUMN cleaned_today BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- Add border column if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'roomstatus_rooms' AND column_name = 'border') THEN
    ALTER TABLE roomstatus_rooms ADD COLUMN border TEXT NOT NULL DEFAULT 'black';
  END IF;
END $$;

-- Add vacant_since column if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'roomstatus_rooms' AND column_name = 'vacant_since') THEN
    ALTER TABLE roomstatus_rooms ADD COLUMN vacant_since TIMESTAMPTZ;
  END IF;
END $$;

-- Add was_purple_before_cleaned column if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'roomstatus_rooms' AND column_name = 'was_purple_before_cleaned') THEN
    ALTER TABLE roomstatus_rooms ADD COLUMN was_purple_before_cleaned BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- Add updated_at column if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'roomstatus_rooms' AND column_name = 'updated_at') THEN
    ALTER TABLE roomstatus_rooms ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
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

-- Expected result: 11 columns total
-- 1. room_number (TEXT, PRIMARY KEY)
-- 2. type (TEXT)
-- 3. floor (INTEGER) ← This was missing!
-- 4. status (TEXT)
-- 5. maid (TEXT)
-- 6. remark (TEXT)
-- 7. cleaned_today (BOOLEAN)
-- 8. border (TEXT)
-- 9. vacant_since (TIMESTAMPTZ)
-- 10. was_purple_before_cleaned (BOOLEAN)
-- 11. updated_at (TIMESTAMPTZ)
