#!/bin/bash
# Start local server for testing

echo "Starting local server in debug mode..."
export DEBUG="puppeteer:*"
export NODE_OPTIONS="--unhandled-rejections=strict"

# Start the server with nodemon for auto-restart
if command -v npx &> /dev/null; then
  npx nodemon src/server.js
else
  node src/server.js
fi