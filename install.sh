#!/bin/sh
# Install the published RichText Demo app for the current user. No sudo required.
set -eu

version="${RICHTEXT_DEMO_VERSION:-latest}"
destination="${RICHTEXT_DEMO_INSTALL_DIR:-}"
usage() {
  printf '%s\n' 'Usage: install.sh [--version VERSION] [--dir DIRECTORY]' \
    'Defaults: latest release; ~/Applications on macOS, ~/.local on Linux.'
}
while [ "$#" -gt 0 ]; do
  case "$1" in
    --version|--dir)
      [ "$#" -ge 2 ] || { usage >&2; exit 2; }
      if [ "$1" = --version ]; then version="$2"; else destination="$2"; fi
      shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) usage >&2; exit 2 ;;
  esac
done
die() { printf 'RichText Demo: %s\n' "$*" >&2; exit 1; }
for tool in curl tar awk; do command -v "$tool" >/dev/null || die "Required command missing: $tool"; done
case "$(uname -s)" in
  Darwin) platform=macos; suffix=apple-darwin; destination="${destination:-$HOME/Applications}" ;;
  Linux) platform=linux; suffix=unknown-linux-gnu; destination="${destination:-$HOME/.local}" ;;
  *) die 'Use install.ps1 on Windows. This script supports macOS and Linux.' ;;
esac
case "$(uname -m)" in
  x86_64|amd64) arch=x86_64 ;;
  arm64|aarch64) arch=aarch64 ;;
  *) die 'Unsupported CPU architecture (requires x86_64 or arm64).' ;;
esac
download() { curl --proto '=https' --tlsv1.2 --fail --silent --show-error --location "$@"; }
repo=https://github.com/huacnlee/nsh-richtext
if [ "$version" = latest ]; then
  release_url="$(download --output /dev/null --write-out '%{url_effective}' "$repo/releases/latest")"
  version="${release_url##*/}"
fi
version="${version#v}"
awk -v version="$version" 'BEGIN {exit !(version ~ /^[0-9]+\.[0-9]+\.[0-9]+([.-][A-Za-z0-9.-]+)?$/)}' || die 'Version must be a release version such as 0.1.0 or v0.1.0.'
asset="richtext-demo-$version-$arch-$suffix.tar.gz"
base="$repo/releases/download/v$version"
work="$(mktemp -d "${TMPDIR:-/tmp}/richtext-demo-install.XXXXXXXX")"
trap 'rm -rf "$work"' 0
printf 'Downloading RichText Demo %s for %s %s…\n' "$version" "$platform" "$arch"
download "$base/$asset" --output "$work/$asset"
download "$base/SHA256SUMS" --output "$work/SHA256SUMS"
expected="$(awk -v name="$asset" '$2 == name || $2 == "*" name { print $1 }' "$work/SHA256SUMS")"
[ "${#expected}" -eq 64 ] || die "Missing or invalid checksum for $asset"
case "$expected" in *[!a-fA-F0-9]*) die "Missing or invalid checksum for $asset" ;; esac
if command -v sha256sum >/dev/null; then
  actual="$(sha256sum "$work/$asset")"
elif command -v shasum >/dev/null; then
  actual="$(shasum -a 256 "$work/$asset")"
else die 'Required command missing: sha256sum or shasum'; fi
[ "${actual%% *}" = "$expected" ] || die 'Checksum verification failed; nothing was installed.'
mkdir "$work/unpacked"
# Only relative archive paths inside the temporary extraction directory.
tar -tzf "$work/$asset" > "$work/entries"
if awk '/^\// || /(^|\/)\.\.(\/|$)/ {bad=1} END {exit !bad}' "$work/entries"; then
  die 'Release archive contains an unsafe path.'
fi
tar -xzf "$work/$asset" -C "$work/unpacked"

# Replaces `$2` with the directory `$1` as a unit, keeping the previous one if the move fails.
replace_dir() {
  staging="$(mktemp -d "$(dirname "$2")/.richtext-demo-install.XXXXXXXX")"
  trap 'rm -rf "$work" "${staging:-}"' 0
  cp -R "$1" "$staging/new"
  previous="$staging/previous"
  if [ -e "$2" ]; then mv "$2" "$previous"; fi
  if ! mv "$staging/new" "$2"; then
    if [ -e "$previous" ]; then mv "$previous" "$2"; fi
    die "Could not replace $2."
  fi
  rm -rf "$staging"
}

if [ "$platform" = macos ]; then
  app="$work/unpacked/RichText Demo.app"
  [ -x "$app/Contents/MacOS/RichTextDemo" ] && [ -f "$app/Contents/Info.plist" ] || die 'Release archive is missing RichText Demo.app.'
  mkdir -p "$destination"
  replace_dir "$app" "$destination/RichText Demo.app"
  printf 'Installed %s/RichText Demo.app\nOpen it from Finder.\n' "$destination"
else
  source_dir="$work/unpacked"
  for file in "richtext-demo/RichText Demo" packaging/richtext-demo.desktop assets/richtext-demo.png; do
    [ -f "$source_dir/$file" ] || die "Release archive is missing $file."
  done
  mkdir -p "$destination/bin" "$destination/lib" "$destination/share/applications" "$destination/share/icons/hicolor/1024x1024/apps"
  replace_dir "$source_dir/richtext-demo" "$destination/lib/richtext-demo"
  chmod 755 "$destination/lib/richtext-demo/RichText Demo"
  # A launcher on PATH: the app finds its resources next to its executable.
  launcher="$(mktemp "$destination/bin/.richtext-demo.XXXXXXXX")"
  printf '#!/bin/sh\nexec "%s/lib/richtext-demo/RichText Demo" "$@"\n' "$destination" > "$launcher"
  chmod 755 "$launcher"
  mv -f "$launcher" "$destination/bin/richtext-demo"
  sed "s|^Exec=richtext-demo|Exec=$destination/bin/richtext-demo|" "$source_dir/packaging/richtext-demo.desktop" > "$destination/share/applications/richtext-demo.desktop"
  chmod 644 "$destination/share/applications/richtext-demo.desktop"
  install -m644 "$source_dir/assets/richtext-demo.png" "$destination/share/icons/hicolor/1024x1024/apps/richtext-demo.png"
  if command -v update-desktop-database >/dev/null; then update-desktop-database "$destination/share/applications" >/dev/null 2>&1 || true; fi
  printf 'Installed %s/bin/richtext-demo\nAdd %s/bin to PATH, then run richtext-demo.\n' "$destination" "$destination"
  printf '%s\n' 'RichText Demo on Linux uses GTK 4.14+ and WebKitGTK 6.0.'
fi
