import struct
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from index_reader import Reader, FormatError, ids, plugins, cache_envelopes
from audit import read_stable


def u32(n): return struct.pack('<I', n)
def name(s):
    b = s.encode('utf-8')
    return u32(0) + struct.pack('<H', len(b)) + b

def block(tag, payload=b''): return u32(tag << 24 | len(payload)) + payload

def fixture(kind='vst3', arch='arm64', identity_ref=0):
    bundle = block(5, name('Example.' + kind) + u32(0) + b'\0\0')
    record = name('Example') + u32(0) + b'\0' + struct.pack('<Q', 123)
    record += u32(0) + u32(identity_ref) + name('1.0')
    if kind == 'vst3': record += b'\0'
    if arch != 'arm64': record += b'\1'
    record += b'\3' + u32(8) + u32(0)
    header = {'vst3': b'3tsv', 'clap': b'palc'}[kind] + u32(27) + b'\1'
    return header + bundle + block(2, record) + block(6)


TABLES = {'categories': ['Synth'], 'device-creators': ['Vendor'],
          'vst3-device-ids': ['A' * 32], 'clap-device-ids': ['org.example.synth']}


class IndexTests(unittest.TestCase):
    def test_vst3_and_clap_and_foreign_architecture(self):
        for kind, arch in [('vst3', 'arm64'), ('vst3', 'x64'), ('clap', 'arm64')]:
            row, = plugins(fixture(kind, arch), kind, arch, TABLES)
            self.assertEqual(row['identity'], TABLES[kind + '-device-ids'][0])
            self.assertEqual(row['relativeBundle'], 'Example.' + kind)
            self.assertEqual(row['deviceType'], 3)
            self.assertEqual(row['foreignFlag'], True if arch == 'x64' else None)

    def test_every_interior_truncation_refused(self):
        b = fixture()
        # An empty 9-byte header is a legitimate empty scope.
        for end in list(range(9)) + list(range(10, len(b))):
            with self.subTest(end=end), self.assertRaises(ValueError):
                plugins(b[:end], 'vst3', 'arm64', TABLES)

    def test_unknown_header_and_record_refused(self):
        for b in [fixture().replace(u32(27), u32(28), 1), fixture()[:9] + block(7)]:
            with self.assertRaises(FormatError): plugins(b, 'vst3', 'arm64', TABLES)

    def test_out_of_range_reference_refused(self):
        with self.assertRaises(FormatError): plugins(fixture(identity_ref=9), 'vst3', 'arm64', TABLES)

    def test_unbalanced_and_outside_bundle_refused(self):
        for b in [fixture()[:9] + block(6), fixture()[:9] + block(2, b'')]:
            with self.assertRaises(FormatError): plugins(b, 'vst3', 'arm64', TABLES)

    def test_unsafe_path_refused(self):
        b = fixture()[:9] + block(1, name('..') + u32(0)) + block(4)
        with self.assertRaises(FormatError): plugins(b, 'vst3', 'arm64', TABLES)

    def test_deleted_record_skipped_duplicates_preserved(self):
        b = fixture() + block(3, b'not a device') + fixture()[9:]
        self.assertEqual(len(plugins(b, 'vst3', 'arm64', TABLES)), 2)

    def test_dictionary_unicode(self):
        b = struct.pack('>I', 1) + b'A' + struct.pack('>I', 0x80000001) + 'Ø'.encode('utf-16-be')
        self.assertEqual(ids(b), ['A', 'Ø'])
        with self.assertRaises(FormatError): ids(b[:-1])

    def test_invalid_booleans_and_lengths(self):
        with self.assertRaises(FormatError): Reader(b'\2').boolean()
        with self.assertRaises(FormatError): Reader(u32(1025)).array()
        with self.assertRaises(FormatError): ids(struct.pack('>I', 0x7fffffff))

    def test_cache_success_failure_and_append(self):
        def string(s): return struct.pack('>I', len(s)) + s.encode()
        common = string('/test.clap') + struct.pack('>QQ', 100, 200)
        success = common + b'\0' + struct.pack('>I', 4) + b'BtWg'
        failure = common + b'\1' + string('scan error')
        b = struct.pack('>I', 13) + success + failure
        rows = cache_envelopes(b, 13)
        self.assertEqual(len(rows), 2)
        self.assertFalse(rows[0]['failed'])
        self.assertTrue({r['path']: r for r in rows}['/test.clap']['failed'])
        with self.assertRaises(FormatError): cache_envelopes(b[:-1], 13)
        with self.assertRaises(FormatError): cache_envelopes(b, 11)

    def test_changed_file_refused(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / 'input'
            p.write_bytes(b'old')
            original = Path.read_bytes
            def changed(path):
                data = original(path)
                path.write_bytes(b'new content')
                return data
            with patch.object(Path, 'read_bytes', changed), self.assertRaises(ValueError): read_stable(p)


if __name__ == '__main__': unittest.main()
