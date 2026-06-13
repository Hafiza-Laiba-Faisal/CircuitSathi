#!/bin/bash

echo "🚀 Starting CircuitSathi Developer Environment..."

# Function to launch in gnome-terminal if available
launch_terminal() {
    local title=$1
    local cmd=$2
    if command -v gnome-terminal >/dev/null 2>&1; then
        gnome-terminal --title="$title" -- bash -c "$cmd; exec bash"
    else
        echo "⚠️ gnome-terminal not found. Running $title in background..."
        $cmd &
    fi
}

# 1. Start Backend in a new tab
echo "📡 Launching Backend (Port 3001)..."
launch_terminal "CircuitSathi Backend" "npm run dev:backend"

# 2. Start Frontend in a new tab
echo "🎨 Launching Frontend (Port 3000)..."
launch_terminal "CircuitSathi Frontend" "npm run dev:frontend"

echo "✅ Tabs opened. Happy coding! Check the new terminal windows for logs."
