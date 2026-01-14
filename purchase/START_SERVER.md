# Starting the Local Server

## Quick Start

The server should already be running! If Chrome didn't open automatically:

1. **Open Chrome manually:**
   - Open Google Chrome
   - Go to: `http://localhost:8000`

2. **Or start the server yourself:**
   ```bash
   cd /Users/bovorn/Desktop/aurasea/Projects/purchase
   python3 -m http.server 8000
   ```
   Then open Chrome and go to: `http://localhost:8000`

## Alternative: Using Different Ports

If port 8000 is busy, use a different port:

```bash
python3 -m http.server 8080
```

Then visit: `http://localhost:8080`

## Stop the Server

Press `Ctrl+C` in the terminal where the server is running.

## Troubleshooting

- **Port already in use?** Use a different port (8080, 3000, etc.)
- **Can't connect?** Make sure the server is running
- **Page not loading?** Check browser console (F12) for errors

## What to Expect

1. Login modal should appear
2. Enter any nickname to login
3. You'll see the Procurement Board with 5 sections:
   - ต้องซื้อ (Need to Buy)
   - พร้อมสั่งซื้อ (Ready to Order)
   - ซื้อแล้ว / กำลังขนส่ง (Bought / In Transit)
   - รับของถูกต้อง (Received Correctly)
   - มีปัญหา (Issues)

Enjoy testing! 🚀
