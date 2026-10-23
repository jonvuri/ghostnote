"""Test fixed-program parsing and refusal with inert bytes."""
import struct
import unittest
from unittest.mock import patch

from grid_symbols.scan import Class, Member, Refusal
from .nitro_data import AstReader, byte_array_initializers, decode_program


def node(body=b'', ident=1):
    return b'\x01' + struct.pack('>h', ident) + body + b'\x02'


def listing(items):
    return b'\x04' + struct.pack('>i', len(items)) + b''.join(items) + b'\x05'


def string(value):
    raw = value.encode('utf8')
    return b'\x06' + struct.pack('>i', len(raw)) + raw


def read(body, registry=None, declarations=()):
    return AstReader(b'\x0a' + body, registry or {1: 'Root'}, declarations).read()


def key_fixture():
    cp = [None, (1, 'Owner'), (7, 1), (1, 'key'), (1, '[B'), (12, (3, 4)), (9, (2, 5))]
    raw = bytearray([16, 17, 188, 8])
    for index in range(17):
        raw.extend([89, 16, index, 16, index, 84])
    raw.extend([179, 0, 6, 177])
    method = Member('method', '<clinit>', '()V', 8, bytes(raw))
    return Class('Owner', 'java/lang/Object', (), 1,
                 [Member('field', 'key', '[B', 26)], [method], cp), method


class NitroDataTests(unittest.TestCase):
    def test_literal_key_and_field_contract(self):
        cls, method = key_fixture()
        self.assertEqual(byte_array_initializers(cls, method), {'key': bytes(range(17))})
        method.code = method.code[:-1] + bytes([1, 179, 0, 6, 177])
        with self.assertRaisesRegex(Refusal, 'key-reassigned'):
            byte_array_initializers(cls, method)
        cls, method = key_fixture()
        cls.fields[0].flags = 10
        with self.assertRaisesRegex(Refusal, 'key-field'):
            byte_array_initializers(cls, method)

    def test_key_store_order_and_truncation(self):
        for changed in ('index', 'truncated'):
            cls, method = key_fixture()
            raw = bytearray(method.code)
            if changed == 'index':
                raw[6] = 1
            else:
                raw = raw[:10]
            method.code = bytes(raw)
            with self.subTest(changed=changed), self.assertRaisesRegex(Refusal, 'key-store'):
                byte_array_initializers(cls, method)

    def test_codec_vector_crosses_key_and_salt_cycles(self):
        # A zero key makes each output byte equal to the rotated salt byte.
        key = bytes(17)
        salt = bytes([128]) * 34
        raw = b'\x02' + salt + bytes(60)
        expected = bytes([128, 64, 32, 16, 8, 4, 2, 1] * 4 + [128, 64]
                         + [0] * 16 + [32, 16, 8, 4, 2, 1, 128, 64, 32, 16])
        self.assertEqual(decode_program(raw, key), expected)

    def test_codec_refuses_other_routes_and_short_input(self):
        for raw, key in ((b'\x01' + bytes(60), bytes(17)), (b'\x02', bytes(17)),
                         (b'\x02' + bytes(60), bytes(16))):
            with self.assertRaisesRegex(Refusal, 'codec-input'):
                decode_program(raw, key)

    def test_nested_nodes_and_declaration_annotations(self):
        child = node(string('port'), 2) + listing([node(ident=3)])
        result = read(node(listing([child])), {1: 'Root', 2: 'Declaration', 3: 'Annotation'}, {'Declaration'})
        self.assertEqual(result['nodeOccurrences'], 3)
        self.assertEqual(result['root']['data'][0][0]['annotations'][0]['class'], 'Annotation')
        self.assertFalse(result['boundedAdmission'])

    def test_string_aliases_numbers_null_and_boolean(self):
        body = string('port') + b'\x07' + struct.pack('>i', 0)
        body += b'\x0b' + struct.pack('>q', -12) + b'\x0c' + struct.pack('>d', 0.5)
        body += b'\x03\x09\x0a'
        self.assertEqual(read(node(body))['root']['data'], ['port', 'port', -12, 0.5, None, True, False])

    def test_string_references_cannot_point_forward_or_backward_from_zero(self):
        for index in (-1, 0, 1):
            with self.assertRaisesRegex(Refusal, 'string-reference'):
                read(node(b'\x07' + struct.pack('>i', index)))

    def test_list_count_and_end_are_required(self):
        for raw in (b'\x04' + struct.pack('>i', -1),
                    b'\x04' + struct.pack('>i', 1) + b'\x05',
                    b'\x04' + struct.pack('>i', 0) + b'\x03'):
            with self.assertRaises(Refusal):
                read(node(raw))

    def test_headers_trailing_data_and_unknown_types_refuse(self):
        for raw in (b'\x09' + node(), b'\x0a' + node() + b'\x03',
                    b'\x0a' + node(ident=2), b'\x0a\x03'):
            with self.assertRaises(Refusal):
                AstReader(raw, {1: 'Root'}, ()).read()

    def test_every_truncation_refuses(self):
        raw = b'\x0a' + node(listing([node(string('text'))]))
        for end in range(len(raw)):
            with self.subTest(end=end), self.assertRaises(Refusal):
                AstReader(raw[:end], {1: 'Root'}, ()).read()

    def test_limits_precede_unbounded_growth(self):
        for variable, limit in (('MAX_NODES', 1), ('MAX_VALUES', 2), ('MAX_DEPTH', 2)):
            with patch('grid_doctor.nitro_data.' + variable, limit), self.assertRaises(Refusal):
                read(node(listing([node()])))

    def test_nonfinite_unknown_tokens_and_bad_annotations_refuse(self):
        for body in (b'\x0c' + struct.pack('>d', float('inf')), b'\x08'):
            with self.assertRaises(Refusal):
                read(node(body))
        with self.assertRaisesRegex(Refusal, 'annotations'):
            read(node() + b'\x03', declarations={'Root'})


if __name__ == '__main__':
    unittest.main()
