# Supabase Diagnostics Guide

## Current Status: Supabase NOT Working ❌

Your console shows Firebase logs, which means Supabase is not active yet.

## Quick Diagnosis

### Check 1: Environment Variables

**In Browser Console, look for:**
- ❌ `❌ Supabase environment variables not set or invalid!` = Variables missing
- ✅ `✅ Supabase environment variables detected` = Variables are set

**If variables are missing:**
1. Go to Vercel Dashboard → Settings → Environment Variables
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
3. **Redeploy** your application

### Check 2: Supabase Connection

**In Browser Console, look for:**
- `🔄 Attempting to load from Supabase...` = Code is trying to connect
- `❌ Error loading from Supabase:` = Connection failed (check error details)
- `✅ Initial load from Supabase completed` = Success!

**Common errors:**
- `relation "roomstatus_rooms" does not exist` = Table not created yet
- `permission denied` = RLS policy issue
- `Invalid API key` = Wrong environment variable value

### Check 3: Realtime Connection

**In Browser Console, look for:**
- `Realtime connected` = Realtime is working ✅
- `❌ Error subscribing to Supabase realtime` = Realtime not enabled

## Step-by-Step Fix

### If you see "Supabase environment variables not set":

1. **Get Supabase credentials:**
   - Go to https://app.supabase.com/
   - Select your project
   - Settings → API
   - Copy Project URL and anon key

2. **Add to Vercel:**
   - Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add `VITE_SUPABASE_URL` = Your project URL
   - Add `VITE_SUPABASE_ANON_KEY` = Your anon key
   - Add for Production, Preview, Development
   - Save

3. **Redeploy:**
   - Go to Deployments tab
   - Click "Redeploy" on latest deployment
   - Wait for deployment to complete

4. **Refresh browser and check console again**

### If you see "Error loading from Supabase":

**Error: "relation does not exist"**
- Run `supabase_setup.sql` in Supabase SQL Editor
- Verify table exists: Table Editor → `roomstatus_rooms`

**Error: "permission denied"**
- Check RLS policy exists (SQL script creates it)
- Verify policy allows all operations

**Error: "Invalid API key"**
- Double-check environment variable values
- Make sure no extra spaces or quotes
- Redeploy after fixing

### If you see Firebase logs but no Supabase logs:

- **Code not deployed:** Redeploy your Vercel app
- **Environment variables missing:** Add them and redeploy
- **Check browser cache:** Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

## Expected Console Output (When Working)

When Supabase is working correctly, you should see:

```
✅ Supabase environment variables detected
🔄 Attempting to load from Supabase...
✅ Initial load from Supabase completed
Realtime connected
```

**NOT:**
```
✅ Initial load from Firestore completed  ← This means Firebase is still being used
```

## Next Steps

1. **Check environment variables** in Vercel
2. **Redeploy** your application
3. **Check browser console** for Supabase messages
4. **Run SQL script** if table doesn't exist
5. **Enable Realtime** in Supabase Dashboard

## Still Having Issues?

Check these files for detailed instructions:
- `SUPABASE_SETUP.md` - Complete setup guide
- `SUPABASE_QUICK_START.md` - Quick checklist
- `supabase_setup.sql` - SQL script to create table
