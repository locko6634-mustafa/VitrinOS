#!/usr/bin/env bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "Bagimsiz Python sunucusu tetikleniyor..."
chmod +x "$SCRIPT_DIR/sunucu_baslat.sh" 2>/dev/null
"$SCRIPT_DIR/sunucu_baslat.sh"
