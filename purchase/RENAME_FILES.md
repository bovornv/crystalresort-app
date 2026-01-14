# File Renaming Instructions

## Current Status
- ✅ All code references updated to use `purchase.css` and `purchase.js`
- ⏳ Files still need to be physically renamed

## Manual Renaming Steps

Since automated renaming isn't working, please manually rename these files:

1. **Rename CSS file:**
   - `kitchen.css` → `purchase.css`

2. **Rename JS file:**
   - `kitchen.js` → `purchase.js`

3. **Optional - Rename workspace file:**
   - `kitchen.code-workspace` → `purchase.code-workspace`

## Quick Rename Script

If you have terminal access, run this command in the project directory:

```bash
cd /Users/bovorn/Desktop/aurasea/Projects/purchase
mv kitchen.css purchase.css
mv kitchen.js purchase.js
mv kitchen.code-workspace purchase.code-workspace
```

## Verification

After renaming, verify the files exist:
- `purchase.css` should exist
- `purchase.js` should exist
- Open `index.html` in a browser - it should load without errors

## Current File References

The following files reference the new names:
- `index.html` - links to `purchase.css` and `purchase.js`
- `NEXT_STEPS.md` - mentions `purchase.js` and `purchase.css`
- `SUPABASE_SETUP.md` - mentions `purchase.js`

All references are ready - just need the physical file rename!
