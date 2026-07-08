#!/bin/sh
# Renders marketing screenshots into promo/ via headless Chrome.
# Requires the dev server on :5199 (npm run dev -- --port 5199).
# Scenes are staged by src/ui/demo.ts (dev builds only).
set -e
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
BASE="http://localhost:5199"
OUT="promo"
mkdir -p "$OUT"

shot() { # name url [budget]
  "$CHROME" --headless --disable-gpu --hide-scrollbars \
    --window-size=1440,900 --virtual-time-budget="${3:-6000}" \
    --screenshot="$OUT/$1.png" "$BASE/#demo=$2" 2>/dev/null
  echo "wrote $OUT/$1.png"
}

shot chain-arrows        "chain&theme=dark"
shot nice-loop           "niceloop&theme=dark"
shot xy-chain-light      "xychain&theme=light"
shot solution-path       "steps&theme=dark"
shot practice-catalog    "practice&theme=dark"
shot difficulty-bands    "newgame&theme=dark"
shot rose-nutella        "board&theme=rose&poodle=1"
shot victory             "victory&theme=dark" 3500
