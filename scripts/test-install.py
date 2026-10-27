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
        self.temp = tempfile.TemporaryDirectory(prefix="mado-installer-test-")
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
        archive = self.root / f"mado-{version}-{target}.tar.gz"
        files = {
            "mado/Mado": b"#!/bin/sh\necho mado\n",
            "mado/nsh/bundle.nshc": b"bytecode",
            "packaging/mado.desktop": b"[Desktop Entry]\nExec=mado %F\n",
            "assets/mado.png": b"icon",
        }
        if "apple" in target:
            files = {"Mado.app/Contents/MacOS/Mado": b"#!/bin/sh\n", "Mado.app/Contents/Info.plist": b"plist"}
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
        self.env["MADO_INSTALL_DIR"] = str(self.dest)
        result = subprocess.run([os.environ.get("INSTALL_TEST_SHELL", "sh")], input=SCRIPT.read_text(), env=self.env, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue((self.dest / "bin/mado").is_file())

    def test_linux_latest_install_and_upgrade(self):
        self.release()
        for _ in range(2):
            result = self.run_install()
            self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue((self.dest / "lib/mado/Mado").is_file())
        self.assertTrue((self.dest / "lib/mado/nsh/bundle.nshc").is_file())
        self.assertEqual(sorted(p.name for p in (self.dest / "lib").iterdir()), ["mado"])
        desktop = (self.dest / "share/applications/mado.desktop").read_text()
        self.assertIn(f"Exec={self.dest}/bin/mado %F", desktop)
        self.assertTrue((self.dest / "share/icons/hicolor/1024x1024/apps/mado.png").is_file())
        launched = subprocess.run([str(self.dest / "bin/mado")], capture_output=True, text=True)
        self.assertEqual(launched.stdout.strip(), "mado")

    def test_build_release_archive_installs(self):
        packaged = self.root / "packaged"
        (packaged / "Mado/nsh").mkdir(parents=True)
        (packaged / "Mado/Mado").write_bytes(b"#!/bin/sh\necho built\n")
        (packaged / "Mado/nsh/bundle.nshc").write_bytes(b"bytecode")
        result = subprocess.run([
            sys.executable, str(ROOT / "packaging/build-release.py"),
            "--target", "aarch64-unknown-linux-gnu", "--version", "0.1.0",
            "--packaged", str(packaged), "--output", str(self.root),
        ], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        checksum = self.root / "mado-0.1.0-aarch64-unknown-linux-gnu.tar.gz.sha256"
        (self.root / "SHA256SUMS").write_bytes(checksum.read_bytes())
        check = subprocess.run([sys.executable, str(ROOT / "packaging/check-release.py"), str(self.root / "mado-0.1.0-aarch64-unknown-linux-gnu.tar.gz"), "--version", "0.1.0"], capture_output=True, text=True)
        self.assertEqual(check.returncode, 0, check.stderr)
        for architecture in ("aarch64", "arm64"):
            with self.subTest(architecture=architecture):
                self.env["MOCK_ARCH"] = architecture
                result = self.run_install()
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual((self.dest / "lib/mado/Mado").read_bytes(), (packaged / "Mado/Mado").read_bytes())
                self.assertTrue(os.access(self.dest / "bin/mado", os.X_OK))

    def test_mac_bundle_install_and_upgrade(self):
        self.env.update(MOCK_OS="Darwin", MOCK_ARCH="arm64")
        self.release("aarch64-apple-darwin")
        for _ in range(2):
            result = self.run_install("--version", "v0.1.0")
            self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue((self.dest / "Mado.app/Contents/MacOS/Mado").is_file())
        self.assertEqual([p.name for p in self.dest.iterdir()], ["Mado.app"])

    def test_mac_failed_replacement_restores_previous_bundle(self):
        self.env.update(MOCK_OS="Darwin", MOCK_ARCH="arm64")
        self.mock("mv", '#!/bin/sh\ncase "$1" in */.mado-install.*/new) exit 1 ;; esac\nexec /bin/mv "$@"\n')
        self.release("aarch64-apple-darwin")
        previous = self.dest / "Mado.app/Contents/MacOS/Mado"
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
