#!/bin/bash
# Start local HTTP server for Procurement Board

cd "$(dirname "$0")"
echo "Starting server on http://localhost:8000"
echo "Press Ctrl+C to stop the server"
echo ""
python3 -m http.server 8000
