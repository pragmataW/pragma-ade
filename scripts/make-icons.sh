#!/bin/sh
# Regenerates every app icon and the README banner from the SVG masters in assets/logo.
# Needs rsvg-convert (librsvg) and magick (ImageMagick 7); macOS also uses iconutil for the .icns.
#   brew install librsvg imagemagick
# Usage: pnpm icons   (or: sh scripts/make-icons.sh)
set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
LOGO="$ROOT/assets/logo"
BUILD="$ROOT/build"
MASTER="$LOGO/pragma-ade.svg"        # macOS grid (tile with padding)
SQUARE="$LOGO/pragma-ade-square.svg" # near full-bleed tile for Windows and Linux
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

for tool in rsvg-convert magick; do
  command -v "$tool" >/dev/null 2>&1 || { echo "make-icons: $tool not found (brew install librsvg imagemagick)" >&2; exit 1; }
done

png() { rsvg-convert -w "$2" -h "$2" "$1" -o "$3"; }

# Linux: build/icons/<n>x<n>.png (electron-builder reads the directory) and the 1024 fallback.
mkdir -p "$BUILD/icons"
for n in 16 24 32 48 64 128 256 512 1024; do png "$SQUARE" "$n" "$BUILD/icons/${n}x${n}.png"; done
png "$SQUARE" 1024 "$BUILD/icon.png"

# Windows: multi-resolution .ico.
for n in 16 24 32 48 64 128 256; do png "$SQUARE" "$n" "$WORK/ico-$n.png"; done
magick "$WORK"/ico-16.png "$WORK"/ico-24.png "$WORK"/ico-32.png "$WORK"/ico-48.png \
  "$WORK"/ico-64.png "$WORK"/ico-128.png "$WORK"/ico-256.png "$BUILD/icon.ico"

# macOS: .icns with every iconset size (16 … 512@2x = 1024).
if command -v iconutil >/dev/null 2>&1; then
  SET="$WORK/icon.iconset"
  mkdir -p "$SET"
  for n in 16 32 128 256 512; do
    png "$MASTER" "$n" "$SET/icon_${n}x${n}.png"
    png "$MASTER" $((n * 2)) "$SET/icon_${n}x${n}@2x.png"
  done
  iconutil -c icns "$SET" -o "$BUILD/icon.icns"
else
  echo "make-icons: iconutil not found (macOS only); kept the existing build/icon.icns" >&2
fi

# The window icon the app sets on Linux/Windows, and the README images.
png "$SQUARE" 512 "$ROOT/apps/desktop/src/main/assets/icon.png"
png "$MASTER" 256 "$LOGO/pragma-ade-256.png"
rsvg-convert -w 1280 -h 320 "$LOGO/pragma-ade-banner.svg" -o "$LOGO/pragma-ade-banner.png"

echo "make-icons: wrote build/icon.{icns,ico,png}, build/icons/, apps/desktop/src/main/assets/icon.png, assets/logo/*.png"
