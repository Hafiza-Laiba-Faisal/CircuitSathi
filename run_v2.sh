#!/bin/bash

# Configuration
PROJECT_ROOT=$(pwd)
PYTHON_ENGINE_DIR="$PROJECT_ROOT/engine"
NODE_BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

# Colors for output
BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' 

echo -e "${BLUE}🚀 Cleaning up ports (3000, 3001, 8000)...${NC}"
fuser -k 3000/tcp 3001/tcp 8000/tcp 2>/dev/null || true
sleep 1

# Check dependencies
function check_deps() {
    folder=$1
    if [ ! -d "$folder/node_modules" ]; then
        echo -e "${BLUE}📦 Installing dependencies in $folder...${NC}"
        cd "$folder" && npm install
        cd "$PROJECT_ROOT"
    fi
}

check_deps "$NODE_BACKEND_DIR"
check_deps "$FRONTEND_DIR"

echo -e "${BLUE}🖥️  Launching Services...${NC}"

# Check for gnome-terminal
if command -v gnome-terminal >/dev/null 2>&1; then
    
    # 1. Start Engine first (Physics source of truth)
    gnome-terminal --title="📡 ENGINE (8000)" -- bash -c "cd '$PYTHON_ENGINE_DIR'; [ -d .venv ] && source .venv/bin/activate; uvicorn main:app --reload --port 8000; exec bash" &
    sleep 2
    
    # 2. Start Backend
    gnome-terminal --title="📦 BACKEND (3001)" -- bash -c "cd '$NODE_BACKEND_DIR'; npm run dev; exec bash" &
    
    # 3. Start Frontend
    gnome-terminal --title="💻 FRONTEND (3000)" -- bash -c "cd '$FRONTEND_DIR'; npm run dev; exec bash" &

    echo -e "${GREEN}✨ Terminals have been opened! System is LIVE.${NC}"
    echo -e "Frontend: http://localhost:3000"

else
    echo -e "${RED}⚠️ gnome-terminal not found. Running in background...${NC}"
    
    cd "$PYTHON_ENGINE_DIR" && uvicorn main:app --reload --port 8000 &
    sleep 2
    cd "$NODE_BACKEND_DIR" && npm run dev &
    cd "$FRONTEND_DIR" && npm run dev &
    
    wait
fi

exit 0
