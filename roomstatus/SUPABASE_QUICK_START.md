# Supabase Quick Start Checklist

Follow these steps to complete the Supabase setup:

## ✅ Step 1: Set Environment Variables in Vercel

**Location:** Vercel Dashboard → Your Project → Settings → Environment Variables

**Add these two variables:**
- `VITE_SUPABASE_URL` = Your Supabase project URL (from Settings → API)
- `VITE_SUPABASE_ANON_KEY` = Your Supabase anon/public key (from Settings → API)

**Important:**
- Add for Production, Preview, AND Development environments
- Click "Save" after adding each variable
- **Redeploy** your application after adding variables

**How to get values:**
1. Go to https://app.supabase.com/
2. Select your project
3. Settings → API
4. Copy "Project URL" and "anon public" key

---

## ✅ Step 2: Create Database Table

**Location:** Supabase Dashboard → SQL Editor

**Action:** Copy and paste the entire contents of `supabase_setup.sql` into SQL Editor and run it.

**What it does:**
- Creates `roomstatus_rooms` table with all required columns
- Sets up indexes for performance
- Enables Row Level Security (allows all operations for internal tool)
- Creates trigger to auto-update `updated_at` timestamp
- Enables Realtime replication

**Verify:** Go to Table Editor → `roomstatus_rooms` → Check that table exists with all columns

---

## ✅ Step 3: Enable Realtime

**Location:** Supabase Dashboard → Database → Replication

**Action:** 
1. Find `roomstatus_rooms` in the table list
2. Toggle **Realtime** switch to **ON** (green/enabled)
3. Verify it shows a checkmark ✓

**Alternative:** The SQL script already includes this step, but verify it's enabled in the UI.

---

## ✅ Step 4: Test

1. **Redeploy** your Vercel app (to pick up environment variables)
2. Open app: `https://crystalresort-app.vercel.app/roomstatus/`
3. Open browser console (F12)
4. **Look for:**
   - ✅ "Realtime connected"
   - ✅ "Initial load from Supabase completed"

5. **Test realtime sync:**
   - Open app in 2 browser tabs
   - Change a room status in Tab 1
   - Verify it updates instantly in Tab 2
   - Check console for: "Room updated from Supabase"

---

## 🆘 Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| No "Realtime connected" message | Check Realtime is enabled in Database → Replication |
| "Error loading from Supabase" | Verify environment variables are set correctly in Vercel |
| Changes not syncing | Ensure Realtime is ON for `roomstatus_rooms` table |
| Table doesn't exist | Run `supabase_setup.sql` script again |

---

## 📝 Files Created

- `SUPABASE_SETUP.md` - Detailed setup guide
- `supabase_setup.sql` - SQL script to create table and enable realtime
- `ENV_VARIABLES.md` - Environment variables reference
- `SUPABASE_QUICK_START.md` - This checklist
