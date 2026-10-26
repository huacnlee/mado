# Maintainer: Jason Lee <huacnlee@gmail.com>
pkgname=mado
pkgver=0.1.1
pkgrel=1
pkgdesc='Markdown files, edited as documents'
arch=('x86_64' 'aarch64')
url='https://github.com/huacnlee/mado'
license=('MIT')
depends=(
  'glibc'
  'gtk4>=4.14'
  'hicolor-icon-theme'
  'webkitgtk-6.0'
)
options=('!debug' '!strip')

# Built from a repository checkout (`makepkg` run in a clone) with the nsh
# command line on PATH, or named by $NSH.
source=()

build() {
  cd "$startdir"
  "${NSH:-nsh}" package . --target linux --out "$srcdir/out"
}

package() {
  cd "$startdir"
  install -dm755 "$pkgdir/usr/lib/mado"
  cp -a "$srcdir/out/Mado/." "$pkgdir/usr/lib/mado/"
  install -dm755 "$pkgdir/usr/bin"
  printf '#!/bin/sh\nexec /usr/lib/mado/Mado "$@"\n' > "$pkgdir/usr/bin/mado"
  chmod 755 "$pkgdir/usr/bin/mado"
  install -Dm644 packaging/mado.desktop "$pkgdir/usr/share/applications/mado.desktop"
  install -Dm644 assets/mado.png "$pkgdir/usr/share/icons/hicolor/1024x1024/apps/mado.png"
  install -Dm644 LICENSE "$pkgdir/usr/share/licenses/$pkgname/LICENSE"
  install -Dm644 NOTICE.md "$pkgdir/usr/share/licenses/$pkgname/NOTICE.md"
}
