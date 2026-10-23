"""Test the bounded module-file reader with inert bytes."""
import struct
import unittest

from grid_symbols.scan import Class, Member, Refusal
from .module_file import Reader, decode_stream, decode_file, key_bytes, object_references, MAX_ITEMS


def integer(value):
    return struct.pack('>i', value)


def node(class_id=42, props=b''):
    return integer(class_id) + props + integer(0)


class ModuleFileTests(unittest.TestCase):
    def test_key_initializer_and_changed_index(self):
        cp = [None, (1, 'Codec'), (7, 1), (1, '<init>'), (1, '([BI)V'),
              (12, (3, 4)), (10, (2, 5))]
        body = bytearray([17, 0, 128, 188, 8])
        for i in range(128):
            body.extend([89, 16, i, 16, i, 84])
        body.extend([76, 187, 0, 2, 89, 43, 16, 16, 183, 0, 6, 176])
        method = Member('method', 'key', '()LCodec;', 4, bytes(body))
        cls = Class('Factory', 'java/lang/Object', (), 1, [], [method], cp)
        self.assertEqual(key_bytes(cls, method), bytes(range(128)))
        body[7] = 1
        method.code = bytes(body)
        with self.assertRaisesRegex(Refusal, 'key-store'):
            key_bytes(cls, method)

    def test_scalar_and_property_order(self):
        props = integer(8) + bytes([3]) + integer(-12)
        props += integer(8) + bytes([8]) + integer(3) + b'abc'
        report = Reader(node(props=props)).read()
        self.assertEqual([p['value'] for p in report['root']['properties']], [-12, 'abc'])
        self.assertEqual(report['classCounts'], {'42': 1})
        self.assertFalse(report['boundedAdmission'])

    def test_list_children_null_and_reference(self):
        values = node(43) + integer(0) + integer(1) + integer(7) + integer(3)
        report = Reader(node(props=integer(9) + bytes([18]) + values)).read()
        self.assertEqual(report['objectCount'], 2)
        children = report['root']['properties'][0]['value']
        self.assertEqual(children[1:], [None, {'reference': 7}])

    def test_named_class_and_property(self):
        raw = integer(4) + integer(4) + b'meta'
        raw += integer(1) + integer(4) + b'name' + bytes([8]) + integer(1) + b'x' + integer(0)
        report = Reader(raw).read()
        self.assertEqual(report['root']['classId'], 'meta')
        self.assertEqual(report['root']['properties'][0]['id'], 'name')

    def test_reference_ids_start_at_one_and_preserve_aliases(self):
        values = node(43) + integer(1) + integer(2) + integer(1) + integer(1) + integer(3)
        root = Reader(node(props=integer(9) + bytes([18]) + values)).read()['root']
        result = object_references(root)
        self.assertEqual([(r['target'], r['targetClassId']) for r in result['references']], [(2, 43), (1, 42)])
        self.assertFalse(result['ownershipProved'])

    def test_forward_and_null_reference_ids_refuse(self):
        for target in (0, -1, 2):
            root = Reader(node(props=integer(9) + bytes([11]) + integer(target))).read()['root']
            with self.subTest(target=target), self.assertRaisesRegex(Refusal, 'not-registered'):
                object_references(root)

    def test_truncation_and_trailing_data_refuse(self):
        for raw in (node()[:-1], node() + b'x'):
            with self.subTest(raw=raw), self.assertRaises(Refusal):
                Reader(raw).read()

    def test_untraced_forms_refuse(self):
        for tag in (0, 12, 19, 20, 26, 255):
            with self.subTest(tag=tag), self.assertRaisesRegex(Refusal, 'unsupported-type'):
                Reader(node(props=integer(9) + bytes([tag]))).read()

    def test_array_string_and_tree_limits(self):
        for tag, count in ((13, MAX_ITEMS + 1), (8, 65537), (13, -1)):
            with self.subTest(tag=tag, count=count), self.assertRaisesRegex(Refusal, 'count-limit'):
                Reader(node(props=integer(9) + bytes([tag]) + integer(count))).read()
        raw = node()
        for _ in range(64):
            raw = node(props=integer(9) + bytes([9]) + raw)
        with self.assertRaisesRegex(Refusal, 'tree-limit'):
            Reader(raw).read()

    def test_boolean_and_nonfinite_refuse(self):
        for tag, value in ((5, bytes([2])), (6, struct.pack('>f', float('nan')))):
            with self.subTest(tag=tag), self.assertRaises(Refusal):
                Reader(node(props=integer(9) + bytes([tag]) + value)).read()

    def test_codec_indices_and_rotation(self):
        key = bytes(range(128))
        result = decode_stream(bytes([0]) + bytes(range(16)) + bytes(113), key)
        self.assertEqual(result[:32], bytes([16] * 16 + [32] * 16))
        self.assertEqual(result[111], 112)
        # At byte 112, the key wraps and the salt rotates right by one bit.
        self.assertEqual(result[112], 16)

    def test_codec_shapes_refuse(self):
        for raw, key in ((b'', bytes(128)), (bytes([1]) + bytes(16), bytes(128)),
                         (bytes(17), bytes(127))):
            with self.subTest(size=len(raw)), self.assertRaisesRegex(Refusal, 'codec-input'):
                decode_stream(raw, key)

    def test_header_and_stream_split(self):
        header = b'BtWg0003000400ca00000044000000000000000000'
        streams = bytes(17) + node() + b'\n' + bytes(17) + node()
        info, metadata, objects = decode_file(header + streams, bytes(128))
        self.assertEqual(info['documentVersion'], 202)
        self.assertEqual((metadata, objects), (node(), node()))
        for offset, byte in ((4, b'1'), (8, b'1'), (24, b'1'), (40, b'1')):
            raw = header[:offset] + byte + header[offset + 1:] + streams
            with self.subTest(offset=offset), self.assertRaisesRegex(Refusal, 'header-form'):
                decode_file(raw, bytes(128))
        with self.assertRaisesRegex(Refusal, 'metadata-padding'):
            decode_file(header + streams[:25] + b'x' + streams[26:], bytes(128))


if __name__ == '__main__':
    unittest.main()
