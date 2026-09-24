#!/bin/bash
# Linux smoke test for the optional Tauri shell (needs Xvfb, xdotool, ImageMagick and a release build:
#   cd desktop/src-tauri && cargo build --release --features custom-protocol).
# Usage: tools/tauri-smoke-linux.sh [out-dir]   → out-dir/tauri-match.png and tauri-play.log
OUT=${1:-/tmp}; cd "$(dirname "$0")/../desktop/src-tauri" || exit 1
Xvfb :78 -screen 0 1440x900x24 >/dev/null 2>&1 & XP=$!
sleep 1
DISPLAY=:78 WEBKIT_DISABLE_COMPOSITING_MODE=1 ./target/release/kernel-keep > "$OUT/tauri-play.log" 2>&1 & AP=$!
sleep 10
WID=$(DISPLAY=:78 xdotool search --name "Kernel Keep" | head -1)
DISPLAY=:78 xdotool mousemove --window "$WID" 230 493 click 1   # "New match" on the title screen at 1440×900
sleep 8
DISPLAY=:78 import -window root "$OUT/tauri-match.png"
echo "app alive after starting a match: $(kill -0 $AP 2>/dev/null && echo yes || echo no)"
kill $AP $XP 2>/dev/null; wait 2>/dev/null
