# Fix: Port 8000 Already in Use

## Problem
```
OSError: [Errno 48] Address already in use
```

This means something is already using port 8000.

## Solution 1: Use Different Port (Easiest)

**Run this instead:**
```bash
cd /Users/bovorn/Desktop/aurasea/Projects/purchase
python3 -m http.server 8080
```

Then visit: `http://localhost:8080`

## Solution 2: Kill Process Using Port 8000

**Find what's using port 8000:**
```bash
lsof -i :8000
```

**Kill it:**
```bash
lsof -ti:8000 | xargs kill
```

**Then start server:**
```bash
cd /Users/bovorn/Desktop/aurasea/Projects/purchase
python3 -m http.server 8000
```

## Solution 3: Use Test Server Script

The test server script might handle this better:
```bash
cd /Users/bovorn/Desktop/aurasea/Projects/purchase
python3 test_server.py
```

## Quick Fix - Just Use Port 8080

**Simplest solution - run this:**
```bash
cd /Users/bovorn/Desktop/aurasea/Projects/purchase && python3 -m http.server 8080
```

**Then open Chrome and go to:** `http://localhost:8080`

The server is now running on port 8080! ✅
