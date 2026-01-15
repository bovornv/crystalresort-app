# Team Notes Migration to Supabase

## Summary

Team notes have been migrated from Firebase Firestore to Supabase with realtime sync.

## What Changed

### Code Changes:
- ✅ Replaced Firebase `onSnapshot` listener with Supabase realtime subscription
- ✅ Replaced Firebase `setDoc` save operation with Supabase `upsert`
- ✅ Added fallback to Firebase if Supabase is not configured
- ✅ Kept debouncing logic to prevent overwriting user edits
- ✅ Added console logs: "Team notes realtime connected" and "Team notes updated from Supabase"

### What's Preserved:
- ✅ All UI unchanged
- ✅ Debouncing logic (prevents overwriting user edits)
- ✅ localStorage backup
- ✅ Firebase fallback if Supabase not configured

## Database Setup

### Step 1: Create Supabase Table

Run `migrate_team_notes.sql` in Supabase SQL Editor:

1. Go to: Supabase Dashboard → SQL Editor
2. Copy entire contents of `migrate_team_notes.sql`
3. Paste and run in SQL Editor
4. Verify table exists: Table Editor → `team_notes`

### Step 2: Verify Realtime is Enabled

1. Go to: Supabase Dashboard → Database → Replication
2. Find `team_notes` table
3. Toggle Realtime to **ON** (green/enabled)
4. Verify checkmark appears ✓

## Table Structure

**Supabase Table:** `team_notes`

**Columns:**
- `id` (TEXT, PRIMARY KEY) - Always 'today'
- `text` (TEXT) - The team notes content
- `last_updated` (TIMESTAMPTZ) - Auto-updated timestamp
- `updated_by` (TEXT) - User nickname who updated

## How It Works

1. **On page load:**
   - Fetches team notes from Supabase (`team_notes` table, `id='today'`)
   - Sets up realtime subscription for changes

2. **When user saves:**
   - Updates Supabase row (`id='today'`)
   - Realtime subscription triggers update on all devices
   - Debouncing prevents overwriting user edits

3. **Realtime sync:**
   - All devices receive updates instantly
   - No refresh needed

## Testing

After setup:
1. Open app in browser
2. Check console for: `Team notes realtime connected`
3. Type in team notes textarea
4. Click "บันทึก" (Save)
5. Check console for: `✅ Team notes saved to Supabase`
6. Open app in another tab
7. Verify notes appear instantly (no refresh)

## Fallback Behavior

If Supabase is not configured:
- App falls back to Firebase automatically
- No errors, seamless transition
- Once Supabase is configured, it will use Supabase

## Notes

- Single row in table (`id='today'`)
- Realtime updates sync instantly across devices
- Debouncing prevents race conditions
- localStorage used as backup
- Firebase code kept for backward compatibility
