import json
import os
import tempfile
import unittest

from grid_doctor import preservation


class PreservationTest(unittest.TestCase):
    def test_reports_missing_and_changed_files(self):
        with tempfile.TemporaryDirectory() as root:
            same = os.path.join(root, 'same.bin'); changed = os.path.join(root, 'changed.bin')
            with open(same, 'wb') as f: f.write(b'abc')
            with open(changed, 'wb') as f: f.write(b'abc')
            inventory = {'files': [
                {'path': same, 'bytes': 3, 'sha256': preservation.sha256(same)},
                {'path': changed, 'bytes': 3, 'sha256': preservation.sha256(changed)},
                {'path': os.path.join(root, 'missing.bin'), 'bytes': 1, 'sha256': '0' * 64},
            ]}
            report = preservation.check(inventory, 'test', 'inventory.json', '')
            self.assertEqual(report['result'], 'differs'); self.assertEqual(report['changed'], [])
            self.assertEqual(report['missing'], [os.path.join(root, 'missing.bin')])
            with open(changed, 'wb') as f: f.write(b'abd')
            report = preservation.check({'files': inventory['files'][:2]}, 'test', 'inventory.json', '')
            self.assertEqual(report['changed'], [changed]); self.assertEqual(report['result'], 'differs')
            with open(changed, 'wb') as f: f.write(b'abc')
            report = preservation.check({'files': inventory['files'][:2]}, 'test', 'inventory.json', 'n')
            self.assertEqual(report['result'], 'unchanged'); self.assertEqual(report['checked'], 2)
            self.assertEqual(report['format'], 'grid-doctor-preservation-v1')
            self.assertEqual(json.loads(json.dumps(report))['note'], 'n')


if __name__ == '__main__':
    unittest.main()
