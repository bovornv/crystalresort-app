# User Roles Setup Guide

## Overview
The Purchase tool now supports role-based access control with three roles:
- **admin**: Full access to all features
- **manager**: Can view reports and delete items
- **staff**: Basic access (add, edit, move items)

## How to Assign Roles

### Method 1: Edit purchase.js (Recommended for Initial Setup)

1. Open `purchase.js` in your code editor
2. Find the `USER_ROLES` object (around line 78)
3. Add users with their roles:

```javascript
const USER_ROLES = {
    'admin': 'admin',        // User with nickname "admin" gets admin role
    'manager': 'manager',    // User with nickname "manager" gets manager role
    'john': 'staff',         // User with nickname "john" gets staff role
    'mary': 'manager',       // User with nickname "mary" gets manager role
    // Add more users here...
};
```

4. Save the file
5. Users will get their roles when they log in

### Method 2: Use Browser Console (For Runtime Updates)

1. Open the Purchase tool in your browser
2. Log in as an admin user
3. Open browser console (F12)
4. Run this command to set a user's role:

```javascript
setUserRole('nickname', 'role');
```

Examples:
```javascript
setUserRole('john', 'admin');      // Make john an admin
setUserRole('mary', 'manager');    // Make mary a manager
setUserRole('bob', 'staff');       // Make bob a staff member
```

### Method 3: Edit localStorage Directly

1. Open browser console (F12)
2. Run:

```javascript
// Get current roles
const roles = JSON.parse(localStorage.getItem('crystal_user_roles') || '{}');

// Add or update a role
roles['nickname'] = 'admin';  // or 'manager' or 'staff'

// Save back to localStorage
localStorage.setItem('crystal_user_roles', JSON.stringify(roles));

// Reload page for changes to take effect
location.reload();
```

## Permission Matrix

| Feature | Admin | Manager | Staff |
|---------|-------|---------|-------|
| Add items | ✅ | ✅ | ✅ |
| Edit items | ✅ | ✅ | ✅ |
| Move items | ✅ | ✅ | ✅ |
| Delete items | ✅ | ✅ | ❌ |
| View purchase history | ✅ | ✅ | ❌ |
| View weekly review | ✅ | ✅ | ❌ |
| View received items | ✅ | ✅ | ✅ |
| View issue items | ✅ | ✅ | ✅ |
| Change user roles | ✅ | ❌ | ❌ |

## Default Behavior

- If a user's nickname is not in `USER_ROLES`, they default to **'staff'** role
- All users can add, edit, and move items
- Only admin and manager can delete items
- Only admin and manager can view purchase history and weekly review
- Only admin can change user roles

## Testing Roles

1. Log in with different nicknames
2. Check browser console for role assignment:
   - Open console (F12)
   - Type: `userRole`
   - Should show: 'admin', 'manager', or 'staff'

3. Test permissions:
   - Try to delete an item (should work for admin/manager, fail for staff)
   - Try to view purchase history (should work for admin/manager, fail for staff)

## Notes

- Roles are stored in localStorage (`crystal_user_roles`)
- Roles persist across browser sessions
- To reset all roles, clear localStorage: `localStorage.removeItem('crystal_user_roles')`
- Roles are case-sensitive (nickname must match exactly)
