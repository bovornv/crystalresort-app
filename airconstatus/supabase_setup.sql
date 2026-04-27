-- Supabase Setup SQL Script for Air Conditioner Cleaning Status App
-- Run this in Supabase SQL Editor

-- Step 1: Create aircon_cleaning_status table
CREATE TABLE IF NOT EXISTS aircon_cleaning_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code TEXT UNIQUE NOT NULL,            -- e.g. "401", "601-B", "601-L"
  last_cleaned_date DATE,
  technician_name TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 2: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_aircon_cleaning_status_room_code
  ON aircon_cleaning_status(room_code);
CREATE INDEX IF NOT EXISTS idx_aircon_cleaning_status_updated_at
  ON aircon_cleaning_status(updated_at);

-- Step 3: Enable Row Level Security (RLS)
ALTER TABLE aircon_cleaning_status ENABLE ROW LEVEL SECURITY;

-- Step 4: Allow all operations (internal tool — matches roomstatus policy)
DROP POLICY IF EXISTS "Allow all operations on aircon_cleaning_status"
  ON aircon_cleaning_status;
CREATE POLICY "Allow all operations on aircon_cleaning_status"
  ON aircon_cleaning_status
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Step 5: Reuse the shared updated_at trigger function (created by roomstatus
-- setup). If you are running this script standalone, uncomment below.
-- CREATE OR REPLACE FUNCTION update_updated_at_column()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   NEW.updated_at = NOW();
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

-- Step 6: Trigger to auto-update updated_at on row changes
DROP TRIGGER IF EXISTS update_aircon_cleaning_status_updated_at
  ON aircon_cleaning_status;
CREATE TRIGGER update_aircon_cleaning_status_updated_at
  BEFORE UPDATE ON aircon_cleaning_status
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Step 7: Enable Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'aircon_cleaning_status'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE aircon_cleaning_status;
  END IF;
END $$;

-- Verification queries (optional)
-- SELECT * FROM aircon_cleaning_status ORDER BY room_code;
-- SELECT COUNT(*) FROM aircon_cleaning_status;
