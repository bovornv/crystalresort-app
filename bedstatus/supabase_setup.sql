-- Supabase Setup SQL Script for Bed Rotation Status App
-- Run this in Supabase SQL Editor

-- Step 1: Create bed_rotation_status table
CREATE TABLE IF NOT EXISTS bed_rotation_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code TEXT UNIQUE NOT NULL,            -- e.g. "401", "601", "503" (plain room number, no -B/-L suffix)
  last_rotation_date DATE,
  rotated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 2: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bed_rotation_status_room_code
  ON bed_rotation_status(room_code);
CREATE INDEX IF NOT EXISTS idx_bed_rotation_status_updated_at
  ON bed_rotation_status(updated_at);

-- Step 3: Enable Row Level Security (RLS)
ALTER TABLE bed_rotation_status ENABLE ROW LEVEL SECURITY;

-- Step 4: Allow all operations (internal tool — matches roomstatus / aircon policy)
DROP POLICY IF EXISTS "Allow all operations on bed_rotation_status"
  ON bed_rotation_status;
CREATE POLICY "Allow all operations on bed_rotation_status"
  ON bed_rotation_status
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
DROP TRIGGER IF EXISTS update_bed_rotation_status_updated_at
  ON bed_rotation_status;
CREATE TRIGGER update_bed_rotation_status_updated_at
  BEFORE UPDATE ON bed_rotation_status
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Step 7: Enable Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'bed_rotation_status'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE bed_rotation_status;
  END IF;
END $$;

-- Verification queries (optional)
-- SELECT * FROM bed_rotation_status ORDER BY room_code;
-- SELECT COUNT(*) FROM bed_rotation_status;
