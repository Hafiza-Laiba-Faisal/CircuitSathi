#!/bin/bash

# Configuration
LAB_DIR="$(pwd)/lab-v2"
PORT=8081

# Colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
NC='\033[0m' 

echo -e "${CYAN}🚀 Launching Circuit Creator Lab V2...${NC}"

# Add local node/npm to path
export PATH="$LAB_DIR/bin:$PATH"

# Verify node version
NODE_V=$(node -v)
echo -e "${CYAN}📦 Using Node version: $NODE_V${NC}"

echo -e "${CYAN}🖥️  Starting Dev Server on http://localhost:$PORT...${NC}"

# Launch in separate terminal if possible
if command -v gnome-terminal >/dev/null 2>&1; then
    gnome-terminal --title="🧪 CIRCUIT LAB V2 (Port $PORT)" -- bash -c "cd '$LAB_DIR'; export PATH=\"\$PWD/bin:\$PATH\"; npm run dev -- --port $PORT; exec bash" &
    echo -e "${GREEN}✨ Lab V2 is opening! Check http://localhost:$PORT${NC}"
else
    echo -e "${CYAN}🔗 Running in background on http://localhost:$PORT${NC}"
    cd "$LAB_DIR" && npm run dev -- --port $PORT
fi

exit 0
