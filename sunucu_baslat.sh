#!/usr/bin/env bash

# Renk kodlari
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Scriptin bulundugu dizin
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=8000

# Python kontrolu
if command -v python3 >/dev/null 2>&1; then
    PYTHON_CMD="python3"
elif command -v python >/dev/null 2>&1; then
    PYTHON_CMD="python"
else
    echo -e "${RED}Hata: Python sisteminizde yuklu degil veya PATH degiskenine eklenmemis!${NC}"
    exit 1
fi

# Port kontrolu ve eski sureci temizleme
OLD_PID=""
if command -v lsof >/dev/null 2>&1; then
    OLD_PID=$(lsof -ti :$PORT 2>/dev/null)
elif command -v ss >/dev/null 2>&1; then
    OLD_PID=$(ss -tulpn 2>/dev/null | grep ":$PORT " | grep -oP 'pid=\K[0-9]+' | head -n 1)
fi

if [ -n "$OLD_PID" ]; then
    echo -e "${YELLOW}Port $PORT dolu. Eski islem (PID: $OLD_PID) sonlandiriliyor...${NC}"
    kill -9 $OLD_PID 2>/dev/null
    sleep 1
elif command -v fuser >/dev/null 2>&1; then
    fuser -k ${PORT}/tcp >/dev/null 2>&1
fi

# Sunucuyu arka planda bagimsiz baslat
echo -e "${CYAN}Sunucu bagimsiz olarak baslatiliyor...${NC}"
cd "$SCRIPT_DIR" || exit 1
nohup "$PYTHON_CMD" -m http.server $PORT >/dev/null 2>&1 &
SERVER_PID=$!
disown $SERVER_PID 2>/dev/null

sleep 1

# Calisma kontrolu
if kill -0 $SERVER_PID 2>/dev/null; then
    echo -e "${GREEN}Sunucu basariyla baslatildi! PID: $SERVER_PID${NC}"
    echo -e "${GREEN}Proje Dizini: $SCRIPT_DIR${NC}"
    echo -e "${GREEN}Tarayicinizdan http://localhost:$PORT adresine gidebilirsiniz.${NC}"
else
    echo -e "${RED}Sunucu baslatilamadi.${NC}"
    exit 1
fi
