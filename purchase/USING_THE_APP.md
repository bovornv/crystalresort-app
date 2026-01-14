# Using the Procurement Board App

## ✅ You're Up and Running!

The app is working! Here's what to do next:

## 🎯 First Steps

### 1. Login
- You should see a login modal
- Enter any nickname (no password needed)
- Click the login button
- You'll see the Procurement Board

### 2. Explore the Board
You'll see 5 sections:
- **ต้องซื้อ** (Need to Buy) - Items that need to be purchased
- **พร้อมสั่งซื้อ** (Ready to Order) - Items ready to order
- **ซื้อแล้ว / กำลังขนส่ง** (Bought / In Transit) - Items purchased
- **รับของถูกต้อง** (Received Correctly) - Items received
- **มีปัญหา** (Issues) - Items with problems

### 3. Add Your First Item
1. Click the green **"เพิ่มรายการ"** button
2. Fill in:
   - Item name (ชื่อรายการ)
   - Quantity (จำนวน)
   - Unit (หน่วย) - choose from dropdown
   - Supplier (ร้านค้า) - ตลาด, แม็คโคร, สุนิษา, or อื่นๆ
   - Check "ด่วน" if urgent
3. Click "บันทึก" (Save)
4. Item appears in "ต้องซื้อ" section

### 4. Move Items Through Workflow
- Click the action buttons to move items between sections
- Items flow: ต้องซื้อ → พร้อมสั่งซื้อ → ซื้อแล้ว → รับของถูกต้อง

### 5. Receive Items
- When item is in "ซื้อแล้ว / กำลังขนส่ง"
- Click "รับ" button
- Enter received quantity
- Mark as "Quality OK" or "Issue"
- If issue, select issue type and reason

### 6. View Purchase History
- Scroll to bottom of page
- Click **"Purchase History"** button
- See all purchase records
- Filter by date range
- Export to CSV or JSON

### 7. Weekly Review
- Click **"Weekly Review"** button
- See weekly summary:
  - Total purchases
  - Frequently bought items
  - High volume items
  - Issues this week
  - Insights

## 📱 Mobile View

- Resize browser window or use mobile device
- Cards display in single line
- Quick Receive buttons available
- Quick Issue sheet (mobile only)
- All features work on mobile!

## 💾 Data Storage

**Current Setup (File Protocol):**
- Data stored in browser localStorage
- Persists between sessions
- Only available on this device/browser

**For Multi-Device Sync:**
- Need to set up Supabase (see SUPABASE_SETUP.md)
- Requires running a server (see START_HERE.md)

## 🎨 Features to Try

### Quick Actions (Mobile)
- **Quick Receive**: Instant receive with one click
- **Quick Issue**: Report issues quickly
- **Undo**: Undo quick actions within 5 seconds

### Desktop/Tablet
- **Expand Cards**: Click cards to see full details
- **Edit/Delete**: Use edit/delete buttons
- **Bulk Actions**: Select multiple items (if enabled)

### Purchase Tracking
- Automatic recording when items received
- Date, item name, supplier, quantity tracked
- Filter by date range
- Export functionality

## 🐛 Troubleshooting

### Data Not Saving?
- Check browser console (F12) for errors
- Make sure JavaScript is enabled
- Try clearing browser cache

### Features Not Working?
- Some features need a server (not file:// protocol)
- For full functionality, use a local server (see START_HERE.md)

### Want Multi-Device Sync?
- Set up Supabase (see SUPABASE_SETUP.md)
- Requires server running

## 📚 Next Steps

1. **Test Basic Features**: Add items, move them, receive them
2. **Test Mobile View**: Resize browser or use mobile device
3. **Set Up Supabase**: For multi-device sync (optional)
4. **Customize**: Adjust settings as needed

## 💡 Tips

- **Login**: Use consistent nicknames for tracking
- **Urgent Items**: Mark with "ด่วน" for priority
- **Issues**: Report issues when receiving items
- **History**: Review purchase history regularly
- **Weekly Review**: Check weekly insights

Enjoy using the Procurement Board! 🛒
