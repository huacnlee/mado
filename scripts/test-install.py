#!/usr/bin/env python3
"""Exercise install.sh with local release fixtures; never touches the host's install."""
import hashlib
import io
import os
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "install.sh"


class InstallTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="richtext-demo-installer-test-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.bin = self.root / "bin"
        self.bin.mkdir()
        self.dest = self.root / "install with spaces"
        self.env = dict(os.environ, PATH=f"{self.bin}:{os.environ['PATH']}", FIXTURES=str(self.root))
        self.mock("uname", '#!/bin/sh\nif [ "$1" = -s ]; then echo "${MOCK_OS:-Linux}"; else echo "${MOCK_ARCH:-x86_64}"; fi\n')
        self.mock("curl", '''#!/usr/bin/env python3
import os, pathlib, shutil, sys
args = sys.argv[1:]
url = next(x for x in args if x.startswith('https://'))
if url.endswith('/latest'):
    print('https://github.com/huacnlee/nsh-richtext/releases/tag/v0.1.0', end='')
else:
    shutil.copyfile(pathlib.Path(os.environ['FIXTURES']) / url.rsplit('/', 1)[1], args[args.index('--output') + 1])
''')

    def mock(self, name, source):
        path = self.bin / name
        path.write_text(source)
        path.chmod(0o755)

    def release(self, target="x86_64-unknown-linux-gnu", unsafe=False, version="0.1.0"):
        archive = self.root / f"richtext-demo-{version}-{target}.tar.gz"
        files = {
            "richtext-demo/RichText Demo": b"#!/bin/sh\necho richtext-demo\n",
            "richtext-demo/nsh/bundle.nshc": b"bytecode",
            "packaging/richtext-demo.desktop": b"[Desktop Entry]\nExec=richtext-demo %F\n",
            "assets/richtext-demo.png": b"icon",
        }
        if "apple" in target:
            files = {"RichText Demo.app/Contents/MacOS/RichTextDemo": b"#!/bin/sh\n", "RichText Demo.app/Contents/Info.plist": b"plist"}
        if unsafe:
            files["../escaped"] = b"bad"
        with tarfile.open(archive, "w:gz") as tar:
            for name, data in files.items():
                info = tarfile.TarInfo(name)
                info.size = len(data)
                info.mode = 0o755
                tar.addfile(info, io.BytesIO(data))
        (self.root / "SHA256SUMS").write_text(f"{hashlib.sha256(archive.read_bytes()).hexdigest()}  {archive.name}\n")
        return archive

    def run_install(self, *args):
        return subprocess.run([os.environ.get("INSTALL_TEST_SHELL", "sh"), str(SCRIPT), "--dir", str(self.dest), *args], env=self.env, capture_output=True, text=True)

    def test_pipe_to_sh_install(self):
        self.release()
        self.env["RICHTEXT_DEMO_INSTALL_DIR"] = str(self.dest)
        result = subprocess.run([os.environ.get("INSTALL_TEST_SHELL", "sh")], input=SCRIPT.read_text(), env=self.env, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue((self.dest / "bin/richtext-demo").is_file())

    def test_linux_latest_install_and_upgrade(self):
        self.release()
        for _ in range(2):
            result = self.run_install()
            self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue((self.dest / "lib/richtext-demo/RichText Demo").is_file())
        self.assertTrue((self.dest / "lib/richtext-demo/nsh/bundle.nshc").is_file())
        self.assertEqual(sorted(p.name for p in (self.dest / "lib").iterdir()), ["richtext-demo"])
        desktop = (self.dest / "share/applications/richtext-demo.desktop").read_text()
        self.assertIn(f"Exec={self.dest}/bin/richtext-demo %F", desktop)
        self.assertTrue((self.dest / "share/icons/hicolor/1024x1024/apps/richtext-demo.png").is_file())
        launched = subprocess.run([str(self.dest / "bin/richtext-demo")], capture_output=True, text=True)
        self.assertEqual(launched.stdout.strip(), "richtext-demo")

    def test_build_release_archive_installs(self):
        packaged = self.root / "packaged"
        (packaged / "RichText Demo/nsh").mkdir(parents=True)
        (packaged / "RichText Demo/RichTextDemo").write_bytes(b"#!/bin/sh\necho built\n")
        (packaged / "RichText Demo/nsh/bundle.nshc").write_bytes(b"bytecode")
        result = subprocess.run([
            sys.executable, str(ROOT / "packaging/build-release.py"),
            "--target", "aarch64-unknown-linux-gnu", "--version", "0.1.0",
            "--packaged", str(packaged), "--output", str(self.root),
        ], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        checksum = self.root / "richtext-demo-0.1.0-aarch64-unknown-linux-gnu.tar.gz.sha256"
        (self.root / "SHA256SUMS").write_bytes(checksum.read_bytes())
        check = subprocess.run([sys.executable, str(ROOT / "packaging/check-release.py"), str(self.root / "richtext-demo-0.1.0-aarch64-unknown-linux-gnu.tar.gz"), "--version", "0.1.0"], capture_output=True, text=True)
        self.assertEqual(check.returncode, 0, check.stderr)
        for architecture in ("aarch64", "arm64"):
            with self.subTest(architecture=architecture):
                self.env["MOCK_ARCH"] = architecture
                result = self.run_install()
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual((self.dest / "lib/richtext-demo/RichText Demo").read_bytes(), (packaged / "RichText Demo/RichTextDemo").read_bytes())
                self.assertTrue(os.access(self.dest / "bin/richtext-demo", os.X_OK))

    def test_build_mac_archive_preserves_bundle(self):
        packaged = self.root / "packaged"
        app = packaged / "RichText Demo.app"
        executable = app / "Contents/MacOS/RichTextDemo"
        executable.parent.mkdir(parents=True)
        executable.write_bytes(b"signed executable")
        executable.chmod(0o755)
        (app / "Contents/Info.plist").write_bytes(b"original plist")
        result = subprocess.run([
            sys.executable, str(ROOT / "packaging/build-release.py"),
            "--target", "aarch64-apple-darwin", "--version", "0.1.0",
            "--packaged", str(packaged), "--output", str(self.root),
        ], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        archive = self.root / "richtext-demo-0.1.0-aarch64-apple-darwin.tar.gz"
        with tarfile.open(archive) as bundle:
            for relative in ("Contents/MacOS/RichTextDemo", "Contents/Info.plist"):
                self.assertEqual(bundle.extractfile(f"RichText Demo.app/{relative}").read(), (app / relative).read_bytes())

    def test_mac_bundle_install_and_upgrade(self):
        self.env.update(MOCK_OS="Darwin", MOCK_ARCH="arm64")
        self.release("aarch64-apple-darwin")
        for _ in range(2):
            result = self.run_install("--version", "v0.1.0")
            self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue((self.dest / "RichText Demo.app/Contents/MacOS/RichTextDemo").is_file())
        self.assertEqual([p.name for p in self.dest.iterdir()], ["RichText Demo.app"])

    def test_mac_failed_replacement_restores_previous_bundle(self):
        self.env.update(MOCK_OS="Darwin", MOCK_ARCH="arm64")
        self.mock("mv", '#!/bin/sh\ncase "$1" in */.richtext-demo-install.*/new) exit 1 ;; esac\nexec /bin/mv "$@"\n')
        self.release("aarch64-apple-darwin")
        previous = self.dest / "RichText Demo.app/Contents/MacOS/RichTextDemo"
        previous.parent.mkdir(parents=True)
        previous.write_text("previous version")
        result = self.run_install("--version", "0.1.0")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Could not replace", result.stderr)
        self.assertEqual(previous.read_text(), "previous version")

    def test_bad_checksum_does_not_install(self):
        archive = self.release()
        archive.write_bytes(b"tampered")
        result = self.run_install()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Checksum verification failed", result.stderr)
        self.assertFalse(self.dest.exists())

    def test_unsafe_archive_does_not_install(self):
        self.release(unsafe=True)
        result = self.run_install()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("unsafe path", result.stderr)
        self.assertFalse(self.dest.exists())

    def test_unsupported_architecture(self):
        self.env["MOCK_ARCH"] = "armv7l"
        result = self.run_install()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Unsupported CPU architecture", result.stderr)

    def test_invalid_version_does_not_download(self):
        result = self.run_install("--version", "../bad")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Version must be", result.stderr)


if __name__ == "__main__":
    unittest.main()
