-- Create announcements table for shared announcement box
-- This table stores the single announcement that appears on the dashboard

CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY DEFAULT 'main', -- Single row with fixed ID
  text TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on updated_at for sorting
CREATE INDEX IF NOT EXISTS idx_announcements_updated_at ON announcements(updated_at);

-- Enable Row Level Security (RLS) - Allow all operations for internal tool
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations (read, insert, update, delete) for everyone
-- This is safe for an internal tool
CREATE POLICY "Allow all operations on announcements" ON announcements
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Enable Realtime for instant updates across devices
-- Use DO block to handle case where table is already in publication
DO $$
BEGIN
    -- Check if announcements is already in the publication
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'announcements'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE announcements;
        RAISE NOTICE 'Added announcements to real-time publication';
    ELSE
        RAISE NOTICE 'announcements is already in real-time publication';
    END IF;
END $$;

-- Insert initial empty row if it doesn't exist
INSERT INTO announcements (id, text, updated_at)
VALUES ('main', '', NOW())
ON CONFLICT (id) DO NOTHING;
