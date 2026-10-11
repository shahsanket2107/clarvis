#!/bin/bash
# Gallery PNG shots: shot.sh <h> [n] [span] [t0]. CHROME overrides the browser path; OUT the output dir (default: a fresh temp dir).
C=${CHROME:-'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}
OUT=${OUT:-$(mktemp -d)}
mkdir -p "$OUT"
D="$(cd "$(dirname "$0")/.." && pwd)/demo/gallery.html"
h=$1; n=${2:-6}; span=${3:-6}; t0=${4:-0}
sed -e "s|new URLSearchParams(location.search)|new URLSearchParams('?sheet=work-$h\&n=$n\&span=$span\&t0=$t0\&w=100')|" -e "s|</head>|<style>h1,.lead,section,.shots,p{display:none}body{padding:0}</style></head>|" "$D" > "$OUT/g-$h.html"
"$C" --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=6000 --window-size=1100,$((n*290+60)) --screenshot="$OUT/$h.png" "file://$OUT/g-$h.html" >/dev/null 2>&1
echo "$OUT/$h.png"
