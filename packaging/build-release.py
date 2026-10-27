#!/usr/bin/env python3
"""Turn `nsh package` output into a release archive using the install scripts' contract.

The archive of each target holds:
  macOS    RichText Demo.app
  Linux    richtext-demo/ (the packaged app: the `RichText Demo` executable and its `nsh/` resources),
           packaging/richtext-demo.desktop, assets/richtext-demo.png (from examples/demo)
  Windows  RichText Demo.exe and its `nsh\\` resources, at the top
  web      the static site, at the top
plus LICENSE and README.md, and a `<archive>.sha256` sidecar next to it.
"""
import argparse
import hashlib
from pathlib import Path
import re
import shutil
import tarfile
import tempfile
import zipfile

TARGETS = {
    "aarch64-apple-darwin": "macos",
    "x86_64-apple-darwin": "macos",
    "x86_64-unknown-linux-gnu": "linux",
    "aarch64-unknown-linux-gnu": "linux",
    "x86_64-pc-windows-msvc": "windows",
    "web": "web",
}
NAME = "RichText Demo"


def copy_tree(source, destination):
    shutil.copytree(source, destination, symlinks=True)


def package(root, packaged, output, version, target):
    platform = TARGETS[target]
    output.mkdir(parents=True, exist_ok=True)
    extension = "zip" if platform == "windows" else "tar.gz"
    archive = output / f"richtext-demo-{version}-{target}.{extension}"
    with tempfile.TemporaryDirectory(prefix="richtext-demo-package-") as temporary:
        stage = Path(temporary)
        if platform == "macos":
            app = packaged / f"{NAME}.app"
            if not (app / "Contents/MacOS" / NAME).is_file():
                raise SystemExit(f"nsh package output is missing {app}")
            copy_tree(app, stage / f"{NAME}.app")
        elif platform == "linux":
            app = packaged / NAME
            if not (app / NAME).is_file():
                raise SystemExit(f"nsh package output is missing {app / NAME}")
            copy_tree(app, stage / "richtext-demo")
            (stage / "richtext-demo" / NAME).chmod(0o755)
            # The archive keeps the install scripts' layout: assets/ at its root.
            for source, name in (("packaging/richtext-demo.desktop", "packaging/richtext-demo.desktop"), ("examples/demo/assets/richtext-demo.png", "assets/richtext-demo.png")):
                destination = stage / name
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(root / source, destination)
        elif platform == "windows":
            app = packaged / NAME
            if not (app / f"{NAME}.exe").is_file():
                raise SystemExit(f"nsh package output is missing {app / (NAME + '.exe')}")
            for path in app.iterdir():
                (copy_tree if path.is_dir() else shutil.copy2)(path, stage / path.name)
        else:
            if not (packaged / "index.html").is_file():
                raise SystemExit(f"nsh package output is missing {packaged / 'index.html'}")
            for path in packaged.iterdir():
                (copy_tree if path.is_dir() else shutil.copy2)(path, stage / path.name)
        for name in ("LICENSE", "README.md", "NOTICE.md"):
            if (root / name).is_file():
                shutil.copy2(root / name, stage / name)
        if platform == "windows":
            with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as bundle:
                for path in sorted(stage.rglob("*")):
                    if path.is_file():
                        bundle.write(path, path.relative_to(stage))
        else:
            with tarfile.open(archive, "w:gz", format=tarfile.PAX_FORMAT) as bundle:
                for path in sorted(stage.iterdir()):
                    bundle.add(path, arcname=path.name)
    with archive.open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()
    # Checksums are merged and read by the Unix installer: LF even on Windows.
    archive.with_name(archive.name + ".sha256").write_text(f"{digest}  {archive.name}\n", encoding="ascii", newline="\n")
    print(archive)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--target", required=True, choices=TARGETS)
    parser.add_argument("--version", required=True)
    parser.add_argument("--packaged", type=Path, required=True, help="the directory `nsh package --out` wrote")
    parser.add_argument("--output", type=Path, default=Path("dist"))
    args = parser.parse_args()
    if not re.fullmatch(r"\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?", args.version):
        parser.error("version must be a SemVer release version without a leading v")
    package(Path(__file__).resolve().parent.parent, args.packaged.resolve(), args.output.resolve(), args.version, args.target)
