# Maintainer: Jason Lee <huacnlee@gmail.com>
pkgname=richtext-demo
pkgver=0.2.0
pkgrel=1
pkgdesc='Markdown files, edited as documents'
arch=('x86_64' 'aarch64')
url='https://github.com/huacnlee/nsh-richtext'
license=('MIT')
depends=(
  'glibc'
  'gtk4>=4.14'
  'hicolor-icon-theme'
  'webkitgtk-6.0'
)
options=('!debug' '!strip')

# Built from a repository checkout (`makepkg` run in a clone) with the nsh
# command line on PATH, or named by $NSH: `scripts/setup-nsh.sh` builds one.
source=()

build() {
  cd "$startdir"
  "${NSH:-nsh}" package examples/demo --target linux --out "$srcdir/out"
}

package() {
  cd "$startdir"
  install -dm755 "$pkgdir/usr/lib/richtext-demo"
  cp -a "$srcdir/out/RichText Demo/." "$pkgdir/usr/lib/richtext-demo/"
  install -dm755 "$pkgdir/usr/bin"
  printf '#!/bin/sh\nexec "/usr/lib/richtext-demo/RichText Demo" "$@"\n' > "$pkgdir/usr/bin/richtext-demo"
  chmod 755 "$pkgdir/usr/bin/richtext-demo"
  install -Dm644 packaging/richtext-demo.desktop "$pkgdir/usr/share/applications/richtext-demo.desktop"
  install -Dm644 examples/demo/assets/richtext-demo.png "$pkgdir/usr/share/icons/hicolor/1024x1024/apps/richtext-demo.png"
  install -Dm644 LICENSE "$pkgdir/usr/share/licenses/$pkgname/LICENSE"
  install -Dm644 NOTICE.md "$pkgdir/usr/share/licenses/$pkgname/NOTICE.md"
}
