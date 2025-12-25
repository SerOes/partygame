#!/bin/bash

# Silvester Party Game - Server Restart Script
# Kills all running game servers and restarts them

echo "🛑 Stopping all game servers..."

# Kill processes on common development ports
for port in 3000 3001 3002 5173 5174 5175; do
    pid=$(lsof -ti:$port 2>/dev/null)
    if [ ! -z "$pid" ]; then
        echo "  Killing process on port $port (PID: $pid)"
        kill -9 $pid 2>/dev/null
    fi
done

# Also kill any ts-node or vite processes related to this project
pkill -f "ts-node.*server/index.ts" 2>/dev/null
pkill -f "vite" 2>/dev/null

sleep 2

echo ""
echo "🚀 Starting servers..."

# Change to project directory
cd "$(dirname "$0")"

# Regenerate Prisma client
echo "  Regenerating Prisma client..."
npx prisma generate --quiet

# Start backend server in background
echo "  Starting backend server..."
npx ts-node server/index.ts &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Start frontend dev server in background
echo "  Starting frontend server..."
npm run dev -- --host &
FRONTEND_PID=$!

# Wait for frontend to start
sleep 3

echo ""
echo "✅ Servers started!"
echo ""
echo "📍 Backend:  http://localhost:3001"
echo "📍 Frontend: http://localhost:5173 (or next available port)"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Wait for any process to exit
wait
