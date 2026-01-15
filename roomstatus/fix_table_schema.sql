-- Fix roomstatus_rooms table schema - Add missing columns
-- Run this in Supabase SQL Editor

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

-- Verify all columns exist (run this to check)
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'roomstatus_rooms'
ORDER BY ordinal_position;

-- Expected columns:
-- room_number (TEXT, PRIMARY KEY)
-- type (TEXT)
-- floor (INTEGER)
-- status (TEXT)
-- maid (TEXT)
-- remark (TEXT)
-- cleaned_today (BOOLEAN)
-- border (TEXT) ← This was missing
-- vacant_since (TIMESTAMPTZ)
-- was_purple_before_cleaned (BOOLEAN)
-- updated_at (TIMESTAMPTZ)
