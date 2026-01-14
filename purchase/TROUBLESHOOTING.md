# Troubleshooting Server Issues

## Problem: ERR_EMPTY_RESPONSE

This usually means the server isn't running or can't be accessed.

## Solutions

### Solution 1: Open File Directly (Easiest)

**Just open the HTML file directly in Chrome:**

1. Open Finder
2. Navigate to: `/Users/bovorn/Desktop/aurasea/Projects/purchase/`
3. Double-click `index.html`
4. It should open in your default browser

**Note:** Some features might not work perfectly with `file://` protocol, but basic functionality should work.

### Solution 2: Use Python Server (Recommended)

**In Terminal, run:**

```bash
cd /Users/bovorn/Desktop/aurasea/Projects/purchase
python3 test_server.py
```

Then open Chrome and go to: `http://localhost:8000`

### Solution 3: Use Python HTTP Server

```bash
cd /Users/bovorn/Desktop/aurasea/Projects/purchase
python3 -m http.server 8000
```

**Keep the terminal window open!** Then visit `http://localhost:8000` in Chrome.

### Solution 4: Try Different Port

If port 8000 is busy:

```bash
cd /Users/bovorn/Desktop/aurasea/Projects/purchase
python3 -m http.server 8080
```

Then visit: `http://localhost:8080`

### Solution 5: Check What's Using Port 8000

```bash
lsof -i :8000
```

If something is using it, kill it:
```bash
kill -9 <PID>
```

## Common Issues

### "python3: command not found"
Try:
```bash
python -m http.server 8000
```

### "Permission denied"
Make sure you're in the right directory:
```bash
cd /Users/bovorn/Desktop/aurasea/Projects/purchase
ls -la index.html
```

### "Address already in use"
Use a different port (8080, 3000, etc.)

### Still Not Working?

1. **Check files exist:**
   ```bash
   ls -la /Users/bovorn/Desktop/aurasea/Projects/purchase/
   ```
   Should see: `index.html`, `purchase.css`, `purchase.js`

2. **Check browser console:**
   - Open Chrome DevTools (F12)
   - Check Console tab for errors
   - Check Network tab to see if files are loading

3. **Try a different browser:**
   - Safari: `open -a Safari http://localhost:8000`
   - Firefox: `open -a Firefox http://localhost:8000`

## Quick Test

Run this to verify everything:
```bash
cd /Users/bovorn/Desktop/aurasea/Projects/purchase
python3 -m http.server 8000 &
sleep 2
curl http://localhost:8000/index.html | head -5
```

If you see HTML output, the server is working!
