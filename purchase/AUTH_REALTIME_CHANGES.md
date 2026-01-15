# Authentication & Real-time Updates Implementation

## Summary
This document outlines the changes made to add Supabase Auth, real-time updates, role-based permissions, and presence tracking to the Purchase tool.

## Files Changed

### 1. `SUPABASE_SETUP.md`
**Changes:**
- Added `users` table with roles (admin, manager, staff)
- Added `created_by` and `updated_by` columns to `items` table
- Added `created_by` column to `purchase_records` table
- Added `presence` table for tracking online users
- Added database triggers and functions for automatic user profile creation
- Updated RLS policies for authenticated access

### 2. `purchase.js`
**Major Changes:**

#### Authentication System (Lines ~390-520)
- Replaced localStorage-based auth with Supabase Auth
- Added `signIn()`, `signUp()`, `signOut()` functions
- Added `loadUser()` async function that loads user profile and role
- Added role checking functions: `isAdminOrManager()`, `isAdmin()`
- Maintains backward compatibility with localStorage fallback

#### Real-time Subscriptions (Lines ~238-374)
- Enhanced `setupRealtimeSubscriptions()` with better error handling
- Added presence channel subscription
- Improved real-time update handling for items and purchase_records
- Updates UI within 1-2 seconds of changes

#### Presence Tracking (Lines ~200-236)
- Added `updatePresence()` function to track user activity
- Added `getOnlineUsersCount()` to count active users (last 5 minutes)
- Added `startPresenceTracking()` to update presence every 30 seconds
- Added `updatePresenceIndicator()` to update UI with online count

#### User Tracking (Lines ~62-150)
- Updated `saveItemToSupabase()` to include `created_by` and `updated_by`
- Updated `savePurchaseRecordToSupabase()` to include `created_by`
- Tracks which user created/updated each item

#### Role-Based Permissions (Lines ~3422, ~3914, ~3940)
- `deleteItem()`: Only admin/manager can delete items
- `showStatsModal()`: Only admin/manager can view purchase history
- `showWeeklyReviewModal()`: Only admin/manager can view weekly review
- Delete buttons hidden in UI for staff users
- Stats/reports buttons hidden in UI for staff users

#### UI Updates (Lines ~618-650)
- `updateUserUI()` now shows role badge (Admin/Manager)
- Hides admin-only features based on role
- Updates presence indicators

#### Initialization (Lines ~5722-5764)
- Updated DOMContentLoaded to use async `loadUser()`
- Shows fallback nickname input if Supabase not configured
- Starts presence tracking after login

### 3. `index.html`
**Changes:**
- Updated login form to use email/password fields (Lines ~694-704)
- Added fallback nickname input (hidden by default)
- Added presence indicators to top bar (Lines ~17-18)
  - Shows "X users online"
  - Shows "Last updated: [time]"

## Database Schema Updates

Run these SQL commands in Supabase SQL Editor:

1. **Create users table** (links to auth.users)
2. **Add user tracking columns** to items and purchase_records
3. **Create presence table** for online user tracking
4. **Enable real-time** for all tables
5. **Create triggers** for automatic user profile creation

See `SUPABASE_SETUP.md` for complete SQL.

## Testing Checklist

### Authentication
- [ ] Sign up new user with email/password
- [ ] Sign in with existing credentials
- [ ] Sign out works correctly
- [ ] User profile loads with correct role
- [ ] Fallback to localStorage works if Supabase not configured

### Real-time Updates
- [ ] Open app in two browser windows/devices
- [ ] Add item in Window 1 → appears in Window 2 within 1-2 seconds
- [ ] Edit item in Window 1 → updates in Window 2 within 1-2 seconds
- [ ] Move item to next stage in Window 1 → updates in Window 2
- [ ] Delete item in Window 1 → disappears in Window 2

### Role-Based Permissions
- [ ] Staff user cannot see delete buttons
- [ ] Staff user cannot see Purchase History button
- [ ] Staff user cannot see Weekly Review button
- [ ] Admin/Manager can see all features
- [ ] Staff user gets error message when trying to delete (if button shown)
- [ ] Staff user gets error message when trying to view reports

### Presence Tracking
- [ ] "X users online" indicator shows correct count
- [ ] Count updates when users come online/go offline
- [ ] "Last updated" time updates when changes occur
- [ ] Presence updates every 30 seconds for active users

### Mobile/Tablet/Desktop
- [ ] All features work on mobile devices
- [ ] Presence indicators visible on all screen sizes
- [ ] Role-based UI hiding works on all devices
- [ ] Real-time updates work on all devices

## Configuration Required

1. **Update Supabase credentials** in `purchase.js`:
   ```javascript
   const SUPABASE_URL = 'YOUR_SUPABASE_URL';
   const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
   ```

2. **Run SQL setup** from `SUPABASE_SETUP.md` in Supabase SQL Editor

3. **Create initial admin user**:
   - Sign up normally (will be created as 'staff')
   - In Supabase dashboard → Authentication → Users, find the user
   - In SQL Editor, run:
     ```sql
     UPDATE users SET role = 'admin' WHERE email = 'admin@example.com';
     ```

## Notes

- **Backward Compatibility**: App falls back to localStorage if Supabase not configured
- **Real-time Performance**: Updates appear within 1-2 seconds across devices
- **Security**: Uses Supabase RLS policies for data access control
- **Presence**: Users are considered "online" if active within last 5 minutes

## Known Limitations

- Presence count updates every minute (not real-time)
- Role changes require manual database update (no UI for this yet)
- Email confirmation required for new signups (can be disabled in Supabase settings)
