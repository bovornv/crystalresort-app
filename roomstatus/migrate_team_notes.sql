-- Create team_notes table for Supabase
-- Run this in Supabase SQL Editor

-- Step 1: Create team_notes table
CREATE TABLE IF NOT EXISTS team_notes (
  id TEXT PRIMARY KEY DEFAULT 'today',
  text TEXT NOT NULL DEFAULT '',
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT NOT NULL DEFAULT ''
);

-- Step 2: Create index on id for faster lookups
CREATE INDEX IF NOT EXISTS idx_team_notes_id ON team_notes(id);

-- Step 3: Enable Row Level Security (RLS)
ALTER TABLE team_notes ENABLE ROW LEVEL SECURITY;

-- Step 4: Create policy to allow all operations (internal tool, no auth yet)
CREATE POLICY "Allow all operations on team_notes"
  ON team_notes
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Step 5: Create function to automatically update last_updated timestamp
CREATE OR REPLACE FUNCTION update_team_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create trigger to automatically update last_updated on row changes
DROP TRIGGER IF EXISTS update_team_notes_updated_at ON team_notes;
CREATE TRIGGER update_team_notes_updated_at
  BEFORE UPDATE ON team_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_team_notes_updated_at();

-- Step 7: Enable Realtime for team_notes table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'team_notes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE team_notes;
  END IF;
END $$;

-- Step 8: Initialize with default row if it doesn't exist
INSERT INTO team_notes (id, text, updated_by)
VALUES ('today', '', 'system')
ON CONFLICT (id) DO NOTHING;

-- Verification queries (optional - run to check setup)
-- SELECT * FROM team_notes;
-- SELECT COUNT(*) FROM team_notes;
