-- Supabase Setup SQL Script for Room Status App
-- Run this in Supabase SQL Editor

-- Step 1: Create roomstatus_rooms table
CREATE TABLE IF NOT EXISTS roomstatus_rooms (
  room_number TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT '',
  floor INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'vacant',
  maid TEXT NOT NULL DEFAULT '',
  remark TEXT NOT NULL DEFAULT '',
  cleaned_today BOOLEAN NOT NULL DEFAULT false,
  border TEXT NOT NULL DEFAULT 'black',
  vacant_since TIMESTAMPTZ,
  was_purple_before_cleaned BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 2: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_roomstatus_rooms_room_number ON roomstatus_rooms(room_number);
CREATE INDEX IF NOT EXISTS idx_roomstatus_rooms_updated_at ON roomstatus_rooms(updated_at);

-- Step 3: Enable Row Level Security (RLS)
ALTER TABLE roomstatus_rooms ENABLE ROW LEVEL SECURITY;

-- Step 4: Create policy to allow all operations (internal tool, no auth yet)
CREATE POLICY "Allow all operations on roomstatus_rooms"
  ON roomstatus_rooms
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Step 5: Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create trigger to automatically update updated_at on row changes
DROP TRIGGER IF EXISTS update_roomstatus_rooms_updated_at ON roomstatus_rooms;
CREATE TRIGGER update_roomstatus_rooms_updated_at
  BEFORE UPDATE ON roomstatus_rooms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Step 7: Enable Realtime for roomstatus_rooms table
-- Note: This may show an error if table is already in publication - that's OK, it means Realtime is already enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'roomstatus_rooms'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE roomstatus_rooms;
  END IF;
END $$;

-- Verification queries (optional - run to check setup)
-- SELECT * FROM roomstatus_rooms LIMIT 5;
-- SELECT COUNT(*) FROM roomstatus_rooms;
