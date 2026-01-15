-- Create common_areas table
CREATE TABLE IF NOT EXISTS common_areas (
  id TEXT PRIMARY KEY, -- Document ID like "lobby-morning", "toilet-cafe-afternoon", etc.
  area TEXT NOT NULL, -- Thai name like "ล็อบบี้", "ห้องน้ำสวน"
  time TEXT NOT NULL, -- "เช้า" or "บ่าย"
  status TEXT NOT NULL DEFAULT 'waiting', -- "waiting" or "cleaned"
  maid TEXT NOT NULL DEFAULT '', -- Nickname of the maid
  border TEXT NOT NULL DEFAULT 'black', -- "black" or "red"
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT NOT NULL DEFAULT 'system'
);

-- Create index on updated_at for sorting (optional)
CREATE INDEX IF NOT EXISTS idx_common_areas_updated_at ON common_areas(updated_at);

-- Create index on area and time for faster queries (optional)
CREATE INDEX IF NOT EXISTS idx_common_areas_area_time ON common_areas(area, time);

-- Enable Row Level Security (RLS) - Allow all operations for now (internal tool)
ALTER TABLE common_areas ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations on common_areas (since this is an internal tool without auth)
CREATE POLICY "Allow all operations on common_areas"
  ON common_areas
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_common_areas_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at on row changes
DROP TRIGGER IF EXISTS update_common_areas_updated_at ON common_areas;
CREATE TRIGGER update_common_areas_updated_at
  BEFORE UPDATE ON common_areas
  FOR EACH ROW
  EXECUTE FUNCTION update_common_areas_updated_at_column();

-- Enable Realtime for common_areas table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'common_areas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE common_areas;
  END IF;
END $$;
