#!/bin/bash
set -e

cd "$(dirname "$0")"

# Load or generate token
if [ -f .env.local ]; then
  export PC_AUTH_TOKEN=$(grep VITE_PC_AUTH_TOKEN .env.local | cut -d= -f2)
else
  export PC_AUTH_TOKEN=$(openssl rand -hex 32)
  echo "VITE_PC_AUTH_TOKEN=$PC_AUTH_TOKEN" > .env.local
  echo "Generated new auth token"
fi

echo "Starting backend on :4176..."
node server/context-api.mjs &
BACKEND_PID=$!

echo "Starting frontend on :4175..."
npx vite &
FRONTEND_PID=$!

echo ""
echo "✅ Prompt Control running"
echo "   Frontend: http://127.0.0.1:4175"
echo "   Backend:  http://127.0.0.1:4176"
echo "   Auth:     enabled"
echo ""
echo "Press Ctrl+C to stop both"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
