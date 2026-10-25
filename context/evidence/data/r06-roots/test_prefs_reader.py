import struct
import unittest
from prefs_reader import decode, package_root


def u32(n):
    return struct.pack('>I', n)


def string(value):
    if value.isascii():
        return u32(len(value)) + value.encode('ascii')
    data = value.encode('utf-16-be')
    return u32(0x80000000 | len(data)//2) + data


def obj(kind, fields):
    return u32(kind) + b''.join(u32(k) + bytes([t]) + v for k,t,v in fields) + u32(0)


def fixture(paths=(), extra=()):
    rows = b''.join(obj(720, [(3443,8,string(p)), (3444,5,bytes([a]))]) for p,a in paths)
    library = obj(718, [(5134,8,string('/custom/library')),
                        (5066,18,rows+u32(3)), (5067,18,u32(3)), (5068,18,u32(3))])
    root = obj(722, [(3457,9,library),(4917,8,string('/custom/packs')), *extra])
    return b'BtWg000100020006000000290000000000000000' + b'\x0a' + root


class PrefsTests(unittest.TestCase):
    def test_multiple_unicode_and_disabled_roots(self):
        result = decode(fixture([('/Volumes/Sound One',1),('/Volumes/音楽/🎹',0)]))
        self.assertEqual(result['soundContent'], [
            {'path':'/Volumes/Sound One','automaticUpdate':True},
            {'path':'/Volumes/音楽/🎹','automaticUpdate':False}])
        self.assertEqual(result['myLibrary'], '/custom/library')
        self.assertEqual(result['packageInstallationDirectory'], '/custom/packs')
        self.assertEqual(result['music'], [])

    def test_every_truncation_rejected(self):
        data = fixture([('/new',1)])
        for end in range(len(data)):
            with self.subTest(end=end), self.assertRaises((ValueError, KeyError)):
                decode(data[:end])

    def test_unknown_wire_rejected(self):
        with self.assertRaises(ValueError):
            decode(fixture(extra=[(9000,255,b'')]))

    def test_duplicate_field_rejected(self):
        with self.assertRaises(ValueError):
            decode(fixture(extra=[(4917,8,string('/other'))]))

    def test_trailing_data_rejected(self):
        with self.assertRaises(ValueError):
            decode(fixture()+b'\x00')

    def test_invalid_boolean_rejected(self):
        with self.assertRaises(ValueError):
            decode(fixture([('/new',2)]))

    def test_package_defaults_and_custom_child(self):
        for configured, expected in [('', '/settings/installed-packages'),
            ('/settings/installed-packages','/settings/installed-packages'),
            ('/Volumes/Packs','/Volumes/Packs/Installed Bitwig Packs'),
            ('/Volumes/Packs/Installed Bitwig Packs','/Volumes/Packs/Installed Bitwig Packs')]:
            self.assertEqual(package_root(configured,'/settings'),expected)


if __name__ == '__main__':
    unittest.main()
