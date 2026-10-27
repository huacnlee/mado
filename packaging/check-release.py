#!/usr/bin/env python3
"""Inspect a release archive: its checksum sidecar, its layout, and the packaged app's bundle."""
import argparse
import hashlib
import json
from pathlib import Path
import plistlib
import subprocess
import tarfile
import tempfile
import zipfile


def check(archive, version):
    expected = archive.with_name(archive.name + ".sha256").read_text().split()
    with archive.open("rb") as stream:
        actual = hashlib.file_digest(stream, "sha256").hexdigest()
    if expected != [actual, archive.name]:
        raise SystemExit("Release checksum does not match its archive")
    with tempfile.TemporaryDirectory(prefix="richtext-demo-release-check-") as temporary:
        root = Path(temporary)
        if archive.suffix == ".zip":
            with zipfile.ZipFile(archive) as bundle:
                bundle.extractall(root)
            executable = root / "RichText Demo.exe"
            resources = root / "nsh"
        else:
            with tarfile.open(archive) as bundle:
                bundle.extractall(root, filter="data")
            if "apple-darwin" in archive.name:
                app = root / "RichText Demo.app"
                executable = app / "Contents/MacOS/RichTextDemo"
                resources = app / "Contents/Resources/nsh"
                with (app / "Contents/Info.plist").open("rb") as stream:
                    info = plistlib.load(stream)
                if info.get("CFBundleIdentifier") != "com.huacnlee.richtext-demo":
                    raise SystemExit(f"Unexpected bundle identifier: {info.get('CFBundleIdentifier')}")
                if info.get("CFBundleShortVersionString") != version:
                    raise SystemExit(f"Bundle version {info.get('CFBundleShortVersionString')} is not {version}")
                subprocess.run(["codesign", "--verify", "--deep", "--strict", str(app)], check=True)
            elif "-web." in archive.name:
                if not (root / "index.html").is_file():
                    raise SystemExit("Web release is missing index.html")
                print(f"Verified {archive.name}")
                return
            else:
                executable = root / "richtext-demo/RichText Demo"
                resources = root / "richtext-demo/nsh"
                for asset in ("packaging/richtext-demo.desktop", "assets/richtext-demo.png"):
                    if not (root / asset).is_file():
                        raise SystemExit(f"Release archive is missing {asset}")
        if not executable.is_file():
            raise SystemExit("Release archive is missing its executable")
        if archive.suffix != ".zip" and not executable.stat().st_mode & 0o111:
            raise SystemExit("Packaged executable is not executable")
        if not (resources / "bundle.nshc").is_file():
            raise SystemExit("Release archive is missing the app's bytecode (nsh/bundle.nshc)")
        app_json = resources / "app.json"
        if app_json.is_file():
            data = json.loads(app_json.read_text())
            if data.get("version") not in (None, version):
                raise SystemExit(f"nsh/app.json version {data.get('version')} is not {version}")
    print(f"Verified {archive.name}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("--version", required=True)
    args = parser.parse_args()
    check(args.archive.resolve(), args.version)
