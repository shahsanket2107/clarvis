#!/bin/bash
# Shoots a theater contact sheet to a PNG: ens-shot.sh <movie 1-10> <cols> <rows> <n> <out.png> [find=kind:k | at=1,2,3] [seed]
# Needs demo/gallery.html (bun scripts/gallery.ts). GAL overrides the html (parallel work).
C=${CHROME:-'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}
D=${GAL:-"$(cd "$(dirname "$0")/.." && pwd)/demo/gallery.html"}
m=$1; w=$2; h=$3; n=$4; out=$5; sel=${6:-}; seed=${7:-42}
"$C" --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=9000 --window-size=$((w*10+60)),$((n*(h*24+10)+60)) --screenshot="$out" "file://$D?theater=$m&w=$w&h=$h&n=$n&seed=$seed&$sel" >/dev/null 2>&1
echo "$out"
