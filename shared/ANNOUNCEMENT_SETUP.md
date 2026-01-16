# Announcement Box Setup Guide

The announcement box now uses Supabase for cross-device synchronization. Follow these steps to complete the setup.

## Step 1: Create Supabase Table

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Go to **SQL Editor**
4. Click **New query**
5. Copy and paste the entire contents of `create_announcements_table.sql`
6. Click **Run** (or press Cmd/Ctrl + Enter)

This will create:
- `announcements` table with a single row (id = 'main')
- Row Level Security policies (allows all operations for internal tool)
- Realtime subscription enabled

## Step 2: Verify Table Creation

1. Go to **Table Editor** in Supabase Dashboard
2. Find `announcements` table
3. Verify it exists with columns:
   - `id` (text, primary key)
   - `text` (text)
   - `updated_at` (timestamptz)

## Step 3: Verify Realtime is Enabled

1. Go to **Database** → **Replication** in Supabase Dashboard
2. Find `announcements` table
3. Verify **Realtime** toggle is **ON** (green/enabled)
4. If not enabled, toggle it ON

## Step 4: Test

1. Open the dashboard page (`/` or `/dashboard/`)
2. Enter text in the announcement box and click "บันทึก"
3. Open the same page on a different device/browser
4. The announcement should appear automatically (via realtime) or after a page refresh

## How It Works

- **React Component** (`roomstatus/src/shared/AnnouncementBox.jsx`): Uses Supabase client from `../services/supabase`
- **Static JavaScript** (`shared/shared-announcement.js`): Uses Supabase from CDN (same credentials as purchase.js)
- **Fallback**: If Supabase fails, falls back to localStorage (for offline/development)

## Troubleshooting

- **Announcement not syncing**: Check browser console for errors
- **"relation does not exist"**: Run the SQL script in Step 1
- **Realtime not working**: Verify Realtime is enabled in Step 3
- **Still using localStorage**: Check Supabase credentials in `shared/shared-announcement.js` match your project
