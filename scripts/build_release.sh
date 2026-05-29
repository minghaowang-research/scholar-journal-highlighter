#!/usr/bin/env bash
# Builds Chrome and Firefox release zips from the single shared extension/ source.
# Firefox manifest = manifest.json with the top-level overrides in manifest.firefox.json
# merged in (background, host_permissions, browser_specific_settings).
# Usage: scripts/build_release.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/extension"
OUT="$ROOT/dist"
NAME="scholar-journal-highlighter"

VERSION=$(node -p "require('$SRC/manifest.json').version")
echo "Building v$VERSION"

rm -rf "$OUT"
mkdir -p "$OUT/chrome" "$OUT/firefox"

# Copy shared source (exclude the firefox override and OS junk) into both builds
for target in chrome firefox; do
  rsync -a --exclude='.DS_Store' --exclude='manifest.firefox.json' "$SRC"/ "$OUT/$target"/
done

# Firefox: replace manifest.json with the merged version
node -e "
  const fs = require('fs');
  const base = require('$SRC/manifest.json');
  const ovr  = require('$SRC/manifest.firefox.json');
  delete base.background; // background shape differs; take Firefox's wholesale
  fs.writeFileSync('$OUT/firefox/manifest.json', JSON.stringify({ ...base, ...ovr }, null, 2) + '\n');
"

# Zip each build
( cd "$OUT/chrome"  && zip -r -X "$OUT/${NAME}-chrome-v${VERSION}.zip"  . -x '.DS_Store' >/dev/null )
( cd "$OUT/firefox" && zip -r -X "$OUT/${NAME}-firefox-v${VERSION}.zip" . -x '.DS_Store' >/dev/null )

echo "Done:"
echo "  dist/${NAME}-chrome-v${VERSION}.zip"
echo "  dist/${NAME}-firefox-v${VERSION}.zip"
