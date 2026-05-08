-- Maintenance Reporting Setup for Room Status App
-- Run this in Supabase SQL Editor.
-- Matches the existing pattern: RLS enabled with a permissive "allow all" policy
-- (internal tool, login-gated client side, anon key in browser).

-- Step 1: Create roomstatus_maintenance table
CREATE TABLE IF NOT EXISTS roomstatus_maintenance (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_number  TEXT NOT NULL REFERENCES roomstatus_rooms(room_number) ON DELETE CASCADE,
  photo_url    TEXT,
  note         TEXT,
  urgency      TEXT NOT NULL CHECK (urgency IN ('not_urgent','urgent','most_urgent')),
  reported_by  TEXT NOT NULL,
  reported_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done')),
  fixed_by     TEXT,
  fixed_at     TIMESTAMPTZ,
  fix_note     TEXT
);

-- Step 2: Indexes
CREATE INDEX IF NOT EXISTS idx_roomstatus_maintenance_room_status
  ON roomstatus_maintenance(room_number, status);

CREATE INDEX IF NOT EXISTS idx_roomstatus_maintenance_status_reported_at
  ON roomstatus_maintenance(status, reported_at DESC);

-- Step 3: RLS — match existing pattern (enabled + permissive ALL policy).
ALTER TABLE roomstatus_maintenance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on roomstatus_maintenance"
  ON roomstatus_maintenance;
CREATE POLICY "Allow all operations on roomstatus_maintenance"
  ON roomstatus_maintenance
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Storage bucket for photos
-- ============================================================================
-- The bucket must be public so getPublicUrl() returns a working URL.

INSERT INTO storage.buckets (id, name, public)
VALUES ('maintenance-photos', 'maintenance-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage policies (storage.objects has its own RLS).
-- Public read so anyone with the URL can view the image.
DROP POLICY IF EXISTS "Public read maintenance-photos" ON storage.objects;
CREATE POLICY "Public read maintenance-photos"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'maintenance-photos');

-- Allow uploads with the anon key (the only auth this app uses in the browser).
DROP POLICY IF EXISTS "Allow upload to maintenance-photos" ON storage.objects;
CREATE POLICY "Allow upload to maintenance-photos"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'maintenance-photos');

-- Allow delete (so a user can ยกเลิก/replace a just-uploaded photo).
DROP POLICY IF EXISTS "Allow delete maintenance-photos" ON storage.objects;
CREATE POLICY "Allow delete maintenance-photos"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'maintenance-photos');

-- Verification
-- SELECT * FROM roomstatus_maintenance LIMIT 5;
-- SELECT id, name, public FROM storage.buckets WHERE id = 'maintenance-photos';
