#!/bin/bash

# Configuration
LAB_DIR="$(pwd)/circuit-creator-lab-main"
PORT=8080

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
NC='\033[0m' 

echo -e "${BLUE}🧪 Launching Circuit Creator Lab using Local Node v22...${NC}"

# Add local node/npm to path for this session
export PATH="$LAB_DIR/bin:$PATH"

# Verify node version
NODE_V=$(node -v)
echo -e "${BLUE}📦 Using Node version: $NODE_V${NC}"

echo -e "${BLUE}🖥️  Launching Lab Terminal...${NC}"

# Launch in separate terminal if possible
if command -v gnome-terminal >/dev/null 2>&1; then
    gnome-terminal --title="🧪 CIRCUIT LAB (Port $PORT)" -- bash -c "cd '$LAB_DIR'; export PATH=\"\$PWD/bin:\$PATH\"; npm run dev -- --port $PORT; exec bash" &
    echo -e "${GREEN}✨ Lab is opening! Check http://localhost:$PORT${NC}"
else
    echo -e "${BLUE}🔗 Running in background on http://localhost:$PORT${NC}"
    cd "$LAB_DIR" && npm run dev -- --port $PORT
fi

exit 0
