# Testing Checklist

Use this checklist to verify everything works correctly after setup.

## ✅ Pre-Testing Setup

- [x] Files renamed: `kitchen.css` → `purchase.css`
- [x] Files renamed: `kitchen.js` → `purchase.js`
- [x] Files renamed: `kitchen.code-workspace` → `purchase.code-workspace`
- [x] All references updated in code

## 🧪 Basic Functionality Tests

### 1. Application Load
- [ ] Open `index.html` in browser
- [ ] No console errors (check F12)
- [ ] Page loads completely
- [ ] Thai header displays correctly: "บอร์ดจัดซื้อของ คริสตัลรีสอร์ต"

### 2. Login System
- [ ] Login modal appears on first visit
- [ ] Can enter nickname
- [ ] Can login successfully
- [ ] User menu shows nickname in top right
- [ ] Can logout
- [ ] After logout, content is hidden

### 3. Adding Items
- [ ] "เพิ่มรายการ" button works
- [ ] Add item modal opens
- [ ] Can fill in all fields:
  - [ ] Item name
  - [ ] Quantity
  - [ ] Unit (แพ็ค/มัด, ถุง, etc.)
  - [ ] Supplier (ตลาด, แม็คโคร, สุนิษา, อื่นๆ)
  - [ ] Urgency checkbox (ด่วน)
- [ ] Can save item
- [ ] Item appears in "ต้องซื้อ" section

### 4. Moving Items
- [ ] Can move item from "ต้องซื้อ" → "พร้อมสั่งซื้อ"
- [ ] Can move item from "พร้อมสั่งซื้อ" → "ซื้อแล้ว / กำลังขนส่ง"
- [ ] Can move item from "ซื้อแล้ว / กำลังขนส่ง" → "รับของถูกต้อง"
- [ ] Status updates correctly

### 5. Receiving Items
- [ ] "รับของถูกต้อง" section shows receive button
- [ ] Receiving modal opens
- [ ] Can enter received quantity
- [ ] Can mark as "Quality OK" or "Issue"
- [ ] If issue, can select issue type and reason
- [ ] Item moves to "มีปัญหา" if issue marked
- [ ] Purchase record created

### 6. Quick Actions (Mobile)
- [ ] Quick Receive button appears (mobile view)
- [ ] Quick Receive works instantly
- [ ] Undo notification appears
- [ ] Can undo quick receive
- [ ] Quick Issue button works
- [ ] Quick Issue sheet appears (mobile only)

### 7. Editing Items
- [ ] Edit button works
- [ ] Can modify item details
- [ ] Changes save correctly
- [ ] Item updates in correct section

### 8. Deleting Items
- [ ] Delete button works
- [ ] Confirmation dialog appears
- [ ] Item removed after confirmation

### 9. Purchase History
- [ ] "Purchase History" button works
- [ ] Modal opens
- [ ] Shows purchase records
- [ ] Date range filter works
- [ ] Table displays correctly:
  - [ ] Date (short format)
  - [ ] Item name
  - [ ] Supplier
  - [ ] Quantity + unit
- [ ] Export buttons work (CSV/JSON)

### 10. Weekly Review
- [ ] "Weekly Review" button works
- [ ] Shows current week's data
- [ ] Displays:
  - [ ] Summary stats
  - [ ] Frequently bought items
  - [ ] High volume items
  - [ ] Issues this week
  - [ ] Weekly insights

## 📱 Mobile View Tests

### Layout
- [ ] All 5 sections visible
- [ ] Sections stack vertically
- [ ] Can scroll through all sections
- [ ] No horizontal scrolling
- [ ] White background (not black)

### Cards
- [ ] Item cards display correctly
- [ ] Each card fits on one line
- [ ] Can click to expand
- [ ] Full text visible when expanded
- [ ] Unit displayed next to item name (grey)
- [ ] Quantity displayed (grey)
- [ ] No supplier name in card

### Actions
- [ ] Quick Receive buttons visible
- [ ] Quick Issue button visible
- [ ] Edit/Delete buttons visible
- [ ] All buttons work correctly

### Supplier Grouping
- [ ] Items grouped by supplier
- [ ] Supplier headers are light dividers (not heavy boxes)
- [ ] Order: ตลาด, แม็คโคร, สุนิษา, อื่นๆ

## 💻 Desktop/Tablet View Tests

### Layout
- [ ] 5 columns display horizontally
- [ ] All columns visible without scrolling
- [ ] Columns auto-adjust width
- [ ] Can scroll horizontally if needed

### Cards
- [ ] Cards display in single row
- [ ] Text fits on one line
- [ ] Can click to expand
- [ ] Quick Receive buttons visible
- [ ] Edit/Delete buttons visible

## 🔄 Multi-Device Sync Tests (If Supabase Configured)

### Setup
- [ ] Supabase credentials added to `purchase.js`
- [ ] Database tables created
- [ ] Real-time enabled

### Sync Tests
- [ ] Open app on Device 1
- [ ] Open app on Device 2
- [ ] Login on both devices
- [ ] Add item on Device 1
- [ ] Item appears on Device 2 within seconds
- [ ] Move item on Device 1
- [ ] Change appears on Device 2
- [ ] Edit item on Device 1
- [ ] Changes sync to Device 2
- [ ] Delete item on Device 1
- [ ] Item removed on Device 2

## 🐛 Error Scenarios

### Network Issues
- [ ] App works offline (localStorage fallback)
- [ ] Data persists after refresh
- [ ] No data loss if Supabase unavailable

### Data Validation
- [ ] Cannot add item with empty name
- [ ] Cannot add item with zero quantity
- [ ] Cannot add item without supplier
- [ ] Error messages display correctly

## 📊 Performance Tests

- [ ] App loads quickly (< 2 seconds)
- [ ] Smooth scrolling
- [ ] No lag when adding items
- [ ] No lag when moving items
- [ ] Real-time updates don't cause flickering

## ✅ Final Verification

- [ ] All tests pass
- [ ] No console errors
- [ ] No visual glitches
- [ ] All features work as expected
- [ ] Mobile and desktop views both functional

## 📝 Notes

Document any issues found:
- Issue: ________________
- Steps to reproduce: ________________
- Expected behavior: ________________
- Actual behavior: ________________

---

**Test Date:** _______________
**Tester:** _______________
**Browser:** _______________
**Device:** _______________
