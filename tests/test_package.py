import hashlib
import json
from pathlib import Path
import subprocess
import sys
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]

class PackageTest(unittest.TestCase):
    def test_package_is_complete_and_reproducible(self):
        manifest = json.loads((ROOT / 'extension/manifest.json').read_text())
        target = ROOT / 'dist' / f"thunderbird-folder-controls-{manifest['version']}.xpi"
        def build():
            subprocess.run([sys.executable, str(ROOT / 'scripts/package.py')], check=True, capture_output=True)
            return hashlib.sha256(target.read_bytes()).digest()
        self.assertEqual(build(), build())
        with zipfile.ZipFile(target) as archive:
            self.assertIsNone(archive.testzip())
            self.assertEqual(set(archive.namelist()), {'manifest.json', 'background.js', 'experiments/schema.json', 'experiments/implementation.js'})
            for name in archive.namelist():
                self.assertEqual(archive.read(name), (ROOT / 'extension' / name).read_bytes())
            self.assertEqual(json.loads(archive.read('manifest.json')), manifest)
