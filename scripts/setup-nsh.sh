#!/bin/sh
# Makes `.nsh-src`: NSH at the commit Cargo.toml pins, with Mado's patches
# applied, and builds its CLI (`.nsh-src/target/release/nsh`).
#   scripts/setup-nsh.sh            # clone, patch, build
#   NSH_PROFILE=dev scripts/setup-nsh.sh
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
rev=$(cat "$root/NSH_REV")
src="$root/.nsh-src"
if [ ! -d "$src/.git" ]; then
  git clone --quiet https://github.com/longbridge/nsh "$src"
fi
cd "$src"
git fetch --quiet origin
git checkout --quiet --force "$rev"
git clean --quiet -fd crates
for patch in "$root"/packaging/patches/*.patch; do
  [ -e "$patch" ] || continue  # none while the pinned commit has every fix
  git apply "$patch"
done
profile=${NSH_PROFILE:-release}
cargo build --profile "$profile" -p nsh-cli
dir=$([ "$profile" = dev ] && echo debug || echo "$profile")
echo "nsh: $src/target/$dir/nsh"
