-- Add missing columns to roomstatus_rooms table
-- Run this in Supabase SQL Editor

-- Add border column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'roomstatus_rooms' 
    AND column_name = 'border'
  ) THEN
    ALTER TABLE roomstatus_rooms ADD COLUMN border TEXT NOT NULL DEFAULT 'black';
    RAISE NOTICE 'Added border column';
  ELSE
    RAISE NOTICE 'border column already exists';
  END IF;
END $$;

-- Verify all required columns exist
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'roomstatus_rooms'
ORDER BY ordinal_position;
