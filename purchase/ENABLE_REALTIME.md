# How to Enable Real-time Replication in Supabase

## Method 1: Using Supabase Dashboard (Visual) - ⚠️ NOT AVAILABLE

**Note:** The "Replication" page in Supabase Dashboard is for external data replication (BigQuery, Iceberg, etc.), NOT for real-time WebSocket subscriptions. 

**Real-time subscriptions must be enabled using SQL (Method 2 below).**

If you see "Replication" page with external destinations, that's the wrong page. Use Method 2 instead.

---

## Method 2: Using SQL Editor (REQUIRED - This is the only way)

### Step-by-Step Instructions:

1. **Go to SQL Editor**
   - In Supabase Dashboard, click **"SQL Editor"** in the left sidebar
   - Click **"New Query"** button (top right)

2. **Run the SQL commands**
   - Copy and paste this SQL into the editor:

```sql
-- Enable real-time replication for purchase_items
ALTER PUBLICATION supabase_realtime ADD TABLE purchase_items;

-- Enable real-time replication for purchase_history
ALTER PUBLICATION supabase_realtime ADD TABLE purchase_history;
```

3. **Execute**
   - Click **"Run"** button (or press `Cmd+Enter` / `Ctrl+Enter`)
   - You should see "Success" message

4. **Verify**
   - Go to Database → Replication
   - Both tables should show as enabled

---

## Verify Real-time is Working

### Step 1: Check if tables exist first
Before enabling real-time, make sure your tables exist:

1. Go to **Database → Tables** in left sidebar
2. Look for `purchase_items` and `purchase_history` tables
3. If they don't exist, create them first using `SETUP_SQL.sql`

### Step 2: Enable real-time (SQL Method)
1. Go to **SQL Editor** → **New Query**
2. Run the SQL commands from Method 2 above
3. You should see "Success" message

### Step 3: Test real-time
1. **Open your app** in two browser windows
2. **Window 1**: Add a new item
3. **Window 2**: The item should appear within 1-2 seconds (no refresh needed)
4. **Check browser console** (F12):
   - Should see: `"Subscribed to purchase_items realtime changes"`
   - Should see: `"Subscribed to purchase_history realtime changes"`

### If Real-time is NOT Working:

1. **Check Replication Status**
   - Go to Database → Replication
   - Verify both tables show as "Enabled"

2. **Check Browser Console**
   - Look for errors like: `"Error subscribing to purchase_items changes"`
   - Check Network tab for WebSocket connections

3. **Verify Table Names**
   - Make sure table names are exactly: `purchase_items` and `purchase_history`
   - Case-sensitive!

4. **Check RLS Policies**
   - Go to Database → Tables → Select table → Policies
   - Ensure policies allow SELECT for authenticated users

---

## Troubleshooting

### Error: "relation does not exist"
- **Solution**: Make sure tables are created first
- Run the table creation SQL from `SETUP_SQL.sql` if needed

### Error: "permission denied"
- **Solution**: You need to be project owner or have admin access
- Check your Supabase project permissions

### Tables not showing in Replication list
- **Solution**: Tables might not exist yet
- Create tables first using `SETUP_SQL.sql`

### Real-time updates not appearing
- **Check**: Browser console for subscription errors
- **Check**: Network tab → WS (WebSocket) connections
- **Check**: Supabase project is not paused
- **Check**: Both users are logged in (if auth is required)

---

## Visual Guide

```
Supabase Dashboard
├── Left Sidebar
│   ├── 🏠 Home
│   ├── 📊 Table Editor
│   ├── 🔍 SQL Editor  ← Method 2: Use this
│   ├── 🗄️ Database
│   │   └── 🔄 Replication  ← Method 1: Use this
│   │       ├── purchase_items  ← Toggle ON
│   │       └── purchase_history  ← Toggle ON
│   └── ...
```

---

## Notes

- **Real-time replication** enables WebSocket connections for live updates
- **Both methods** achieve the same result - use whichever you prefer
- **SQL method** is faster if you know SQL
- **UI method** is easier if you prefer clicking
- Changes take effect **immediately** - no restart needed
