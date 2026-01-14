# START HERE - How to Run the Procurement Board

## ⚠️ ERR_EMPTY_RESPONSE Fix

This error means the server isn't running. Follow these steps:

## Method 1: Open File Directly (Easiest - No Server Needed)

1. **Open Finder**
2. **Navigate to:** `/Users/bovorn/Desktop/aurasea/Projects/purchase/`
3. **Double-click `index.html`**
4. It will open in your default browser

**Note:** This works for testing! Some advanced features might need a server, but basic functionality works.

---

## Method 2: Start Server Manually (For Full Features)

### Step-by-Step:

1. **Open Terminal:**
   - Press `Cmd + Space`
   - Type "Terminal"
   - Press Enter

2. **Copy and paste this EXACT command:**
   ```bash
   cd /Users/bovorn/Desktop/aurasea/Projects/purchase && python3 -m http.server 8000
   ```

3. **Press Enter**

4. **You should see:**
   ```
   Serving HTTP on :: port 8000
   ```
   (or similar message)

5. **IMPORTANT:** Keep this Terminal window open! Don't close it.

6. **Open Chrome:**
   - Open Google Chrome
   - Type in address bar: `http://localhost:8000`
   - Press Enter

7. **You should see the login screen!**

---

## Method 3: Use the Test Server Script

1. **Open Terminal**

2. **Run:**
   ```bash
   cd /Users/bovorn/Desktop/aurasea/Projects/purchase
   python3 test_server.py
   ```

3. **Keep Terminal open**

4. **Visit:** `http://localhost:8000` in Chrome

---

## Troubleshooting

### "python3: command not found"
Try:
```bash
python -m http.server 8000
```

### "Address already in use"
Try a different port:
```bash
python3 -m http.server 8080
```
Then visit: `http://localhost:8080`

### Still getting ERR_EMPTY_RESPONSE?

**Check if server is actually running:**
1. Look at your Terminal window
2. Do you see "Serving HTTP on..." message?
3. If NO → Server didn't start (check for errors)
4. If YES → Try `http://127.0.0.1:8000` instead of `localhost:8000`

### Verify Files Exist:
```bash
cd /Users/bovorn/Desktop/aurasea/Projects/purchase
ls -la index.html purchase.css purchase.js
```

All three files should be listed. If any are missing, that's the problem.

---

## Quick Test

**In Terminal, run:**
```bash
cd /Users/bovorn/Desktop/aurasea/Projects/purchase
python3 -m http.server 8000 &
sleep 2
curl http://localhost:8000/index.html | head -3
```

If you see HTML output (starting with `<!DOCTYPE html>`), the server is working!

---

## What You Should See

When it works, you'll see:
- ✅ Login modal with Thai text
- ✅ "กรุณากรอกชื่อเล่นเพื่อเข้าสู่ระบบ"
- ✅ Input field for nickname
- ✅ Login button

---

**Try Method 1 first (double-click index.html) - it's the easiest!**
