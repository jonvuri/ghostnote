"""Test the body-change report on inert in-memory class models.

The tests do not read a vendor jar and do not run vendor code.
"""
import contextlib
import io
from pathlib import Path
import tempfile
import unittest

from grid_symbols.scan import Class, Member, Refusal
from grid_symbols.test_resolve import FakeJar
from .body_change import closure_rows, compare_fields, compare_methods, main, write_report

READ = bytes([42, 180, 0, 6, 87, 42, 180, 0, 6, 176])


def model(prefix, code=READ, flags=1, desc=None):
    """Make one receiver and one dependency. The prefix renames every vendor symbol."""
    receiver, dependency = prefix + 'Receiver', prefix + 'Dependency'
    field_desc = 'L' + dependency + ';'
    cp = [None, (1, receiver), (7, 1), (1, prefix + 'a'), (1, field_desc),
          (12, (3, 4)), (9, (2, 5)), (1, prefix + 'b'), (12, (7, 4)), (9, (2, 8))]
    method = Member('method', prefix + 'read', desc or '()' + field_desc, flags, code)
    cls = Class(receiver, 'java/lang/Object', (), 1,
                [Member('field', prefix + 'a', field_desc, 2),
                 Member('field', prefix + 'b', field_desc, 2)], [method], cp)
    jar = FakeJar([cls, Class(dependency, 'java/lang/Object', (), 1, [], [])])
    return jar, (receiver, method.name, method.desc)


class BodyChangeTests(unittest.TestCase):
    def test_renamed_only_pair_is_same_body(self):
        old_jar, old_id = model('A')
        new_jar, new_id = model('B')
        row = compare_methods(old_jar, old_id, new_jar, new_id)
        self.assertEqual(row['result'], 'same-body')
        self.assertEqual(row['bodyDigestOld'], row['bodyDigestNew'])
        self.assertEqual(row['instructionsOld'], 6)

    def test_renamed_field_is_field_same(self):
        old_jar, _ = model('A')
        new_jar, _ = model('B')
        row = compare_fields(old_jar, ('AReceiver', 'Aa', 'LADependency;'),
                             new_jar, ('BReceiver', 'Ba', 'LBDependency;'))
        self.assertEqual(row['result'], 'field-same')

    def test_changed_literal_or_added_instruction_is_changed_body(self):
        old_jar, old_id = model('A', bytes([4, 172]), desc='()I')
        for code in (bytes([5, 172]), bytes([4, 4, 87, 172])):
            with self.subTest(code=code.hex()):
                new_jar, new_id = model('B', code, desc='()I')
                row = compare_methods(old_jar, old_id, new_jar, new_id)
                self.assertEqual(row['result'], 'changed-body')
                diff = row['diff']
                self.assertGreater(diff['tokensOnlyOld'] + diff['tokensOnlyNew'], 0)
                self.assertTrue(diff['tokens'])
                self.assertLessEqual(len(diff['tokens']), 16)

    def test_flags_only_change_is_access_change_only(self):
        old_jar, old_id = model('A', flags=2)
        new_jar, new_id = model('B', flags=0)
        row = compare_methods(old_jar, old_id, new_jar, new_id)
        self.assertEqual(row['result'], 'access-change-only')
        self.assertNotEqual(row['digestOld'], row['digestNew'])
        self.assertEqual((row['flagsOld'], row['flagsNew']), (2, 0))

    def test_stored_parity_disagreement_refuses(self):
        old_jar, old_id = model('A')
        new_jar, new_id = model('B')
        closure = {'labels': {'read': list(new_id)},
                   'labelParity': {'read': {'old': list(old_id), 'how': 'test',
                                            'bodyEqual': True}}}
        self.assertEqual(closure_rows(old_jar, new_jar, closure)[0]['result'], 'same-body')
        closure['labelParity']['read']['bodyEqual'] = False
        with self.assertRaisesRegex(Refusal, 'stored-body-parity-disagreement'):
            closure_rows(old_jar, new_jar, closure)

    def test_existing_report_path_refuses(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'body-change.json'
            path.write_text('{}\n')
            with self.assertRaisesRegex(Refusal, 'report-exists'):
                write_report(path, {})
            output = io.StringIO()
            missing = Path(directory) / 'missing.jar'
            with contextlib.redirect_stdout(output):
                code = main(['--old-jar', str(missing), '--new-jar', str(missing),
                             '--report', str(path)])
            self.assertEqual(code, 2)
            self.assertIn('report-exists', output.getvalue())
            self.assertEqual(path.read_text(), '{}\n')


if __name__ == '__main__':
    unittest.main()
