#!/usr/bin/env python3
"""Reuse a verified runtime artifact only when its NSH revision and patches match."""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import re
import subprocess
import tarfile
import zipfile

ROOT = Path(__file__).resolve().parent.parent


def api(endpoint):
    return json.loads(subprocess.check_output(["gh", "api", endpoint]))


def check_toolchain(repo, run, nsh_ref):
    metadata = api(f"repos/{repo}/actions/runs/{run}")
    commit = metadata["head_sha"]

    def source(file):
        result = api(f"repos/{repo}/contents/{file}?ref={commit}")
        return base64.b64decode(result["content"]).replace(b"\r\n", b"\n")

    workflow = source(".github/workflows/release.yml").decode()
    pinned = re.search(r"^  NSH_REF: (\S+)$", workflow, re.MULTILINE)
    if not pinned or pinned.group(1) != nsh_ref:
        raise SystemExit("Runtime artifact was built with a different NSH revision")
    folder = "packaging/patches"
    previous = sorted(item["name"] for item in api(f"repos/{repo}/contents/{folder}?ref={commit}") if item["name"].endswith(".patch"))
    current = sorted(file.name for file in (ROOT / folder).glob("*.patch"))
    if previous != current:
        raise SystemExit("Runtime artifact has a different NSH patch set")
    for name in current:
        if source(f"{folder}/{name}") != (ROOT / folder / name).read_bytes().replace(b"\r\n", b"\n"):
            raise SystemExit(f"Runtime artifact has a different NSH patch: {name}")


def prepare(archive, platform, output):
    with archive.open("rb") as stream:
        actual = hashlib.file_digest(stream, "sha256").hexdigest()
    expected = archive.with_name(archive.name + ".sha256").read_text().split()
    if expected != [actual, archive.name]:
        raise SystemExit("Runtime archive checksum does not match")
    if archive.suffix == ".zip":
        bundle = zipfile.ZipFile(archive)
        names = bundle.namelist()
        read = bundle.read
    else:
        bundle = tarfile.open(archive)
        names = bundle.getnames()
        read = lambda name: bundle.extractfile(name).read()
    with bundle:
        if platform == "web":
            files = {}
            for suffix in ("js", "wasm"):
                matches = [name for name in names if re.fullmatch(rf"nsh\.[a-f0-9]+\.{suffix}", name)]
                if len(matches) != 1:
                    raise SystemExit(f"Expected exactly one Web runtime {suffix}")
                files[f"nsh.{suffix}"] = matches[0]
        else:
            source, destination = {
                "macos": ("Mado.app/Contents/MacOS/Mado", "nsh-macos-app"),
                "linux": ("mado/Mado", "nsh-linux-app"),
                "windows": ("Mado.exe", "nsh-windows-app.exe"),
            }[platform]
            files = {destination: source}
        destination = output / platform
        destination.mkdir(parents=True, exist_ok=True)
        for name, source in files.items():
            file = destination / name
            file.write_bytes(read(source))
            if platform != "web":
                file.chmod(0o755)
    print(f"Verified and prepared {platform} runtime from {archive.name}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--platform", choices=["macos", "linux", "windows", "web"], required=True)
    parser.add_argument("--repo", required=True)
    parser.add_argument("--run", required=True)
    parser.add_argument("--nsh-ref", required=True)
    args = parser.parse_args()
    if json.loads((ROOT / "nsh.json").read_text()).get("rust"):
        raise SystemExit("Runtime reuse requires a TSX app without app-specific Rust")
    check_toolchain(args.repo, args.run, args.nsh_ref)
    archives = [file for file in args.input.iterdir() if file.name.endswith((".tar.gz", ".zip"))]
    if len(archives) != 1:
        raise SystemExit("Expected exactly one runtime archive in the downloaded artifact")
    prepare(archives[0], args.platform, args.output)
