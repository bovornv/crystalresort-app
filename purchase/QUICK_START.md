# Quick Start Guide - Crystal Resort Procurement Board

## ✅ Setup Complete!

All files have been renamed and the application is ready to use.

## 🚀 Getting Started

### Option 1: Use with Local Storage (No Setup Required)

The app works immediately with browser localStorage:

1. **Open the app:**
   - Open `index.html` in your web browser
   - Or use a local server: `python3 -m http.server 8000` then visit `http://localhost:8000`

2. **Login:**
   - Enter any nickname (no password needed)
   - Click login

3. **Start using:**
   - Add items to the "ต้องซื้อ" (Need to Buy) section
   - Move items through the workflow
   - View purchase history
   - Check weekly review

**Note:** Data is stored locally in your browser. It won't sync across devices.

### Option 2: Enable Multi-Device Sync (Requires Supabase Setup)

Follow these steps to enable real-time sync across multiple devices:

#### Step 1: Create Supabase Account
1. Go to https://supabase.com
2. Sign up for a free account
3. Create a new project (choose a name and database password)

#### Step 2: Get Your Credentials
1. In your Supabase project dashboard, go to **Settings** → **API**
2. Copy your **Project URL** (looks like: `https://xxxxx.supabase.co`)
3. Copy your **anon/public key** (long string starting with `eyJ...`)

#### Step 3: Create Database Tables
1. In Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy and paste the SQL from `SUPABASE_SETUP.md` (sections 1-3)
4. Click **Run** to execute

#### Step 4: Configure the App
1. Open `purchase.js` in your code editor
2. Find lines 7-8:
   ```javascript
   const SUPABASE_URL = 'YOUR_SUPABASE_URL';
   const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
   ```
3. Replace with your actual credentials:
   ```javascript
   const SUPABASE_URL = 'https://your-project.supabase.co';
   const SUPABASE_ANON_KEY = 'your-anon-key-here';
   ```
4. Save the file

#### Step 5: Enable Real-time Updates
1. In Supabase SQL Editor, run the real-time commands from `SUPABASE_SETUP.md`
2. This enables live updates across devices

#### Step 6: Test Multi-Device Sync
1. Open the app in two different browsers/devices
2. Login on both
3. Add an item on device 1
4. It should appear on device 2 within seconds! ✨

## 🧪 Testing Checklist

### Basic Functionality
- [ ] App loads without errors
- [ ] Login works with nickname
- [ ] Can add new items
- [ ] Can edit items
- [ ] Can delete items
- [ ] Can move items between columns
- [ ] Purchase history shows records
- [ ] Weekly review displays correctly

### Mobile View
- [ ] All sections visible on mobile
- [ ] Can scroll through sections
- [ ] Quick receive buttons work
- [ ] Quick issue sheet appears (mobile only)
- [ ] Cards expand when clicked

### Multi-Device Sync (if Supabase configured)
- [ ] Items sync across devices
- [ ] Changes appear in real-time
- [ ] No duplicate items created
- [ ] Purchase records sync

## 🐛 Troubleshooting

### App Won't Load
- Check browser console for errors (F12)
- Verify `purchase.css` and `purchase.js` exist
- Try clearing browser cache

### Supabase Not Working
- Verify credentials are correct (no extra spaces)
- Check browser console for errors
- Verify tables exist in Supabase dashboard
- Check RLS policies are set (see SUPABASE_SETUP.md)

### Mobile View Issues
- Clear browser cache
- Check console for JavaScript errors
- Verify CSS file is loading

## 📚 Documentation

- **Full Setup Guide:** `SUPABASE_SETUP.md`
- **Next Steps:** `NEXT_STEPS.md`
- **File Structure:** All files use `purchase.*` naming

## 💡 Tips

1. **Start Simple:** Use localStorage first, then add Supabase when ready
2. **Test Incrementally:** Test one feature at a time
3. **Monitor Console:** Keep browser console open (F12) to catch errors
4. **Backup Data:** Export purchase history regularly

## 🎯 You're Ready!

The app is fully functional and ready to use. Choose your path:
- **Quick Start:** Use localStorage (works immediately)
- **Full Setup:** Configure Supabase for multi-device sync

Happy procuring! 🛒
