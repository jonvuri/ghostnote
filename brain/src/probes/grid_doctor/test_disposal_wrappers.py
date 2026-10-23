"""Test the generated map-removal shape on inert class data."""
from types import SimpleNamespace
import unittest
from unittest.mock import patch
from grid_symbols.scan import Class, Member, Refusal
from grid_symbols.test_resolve import FakeJar
from .disposal_wrappers import map_wrapper, false_fields_delegate
from .test_descriptor_resolution import ModelCode


def model():
    cp = [None, (1, 'Wrapper'), (7, 1), (1, 'map'), (1, 'Ljava/util/HashMap;'),
          (12, (3, 4)), (9, (2, 5)), (1, 'java/util/HashMap'), (7, 7),
          (1, 'remove'), (1, '(Ljava/lang/Object;)Ljava/lang/Object;'),
          (12, (9, 10)), (10, (8, 11)), (1, 'Base'), (7, 13),
          (1, 'dispose'), (1, '()V'), (12, (15, 16)), (10, (14, 17))]
    method = Member('method', 'dispose', '()V', 1,
                    bytes([178, 0, 6, 198, 0, 11, 178, 0, 6, 42, 182, 0, 12,
                           87, 42, 183, 0, 18, 177]))
    cls = Class('Wrapper', 'Base', (), 1,
                [Member('field', 'map', 'Ljava/util/HashMap;', 10)], [method], cp)
    jar = FakeJar([cls]); jar.zip = SimpleNamespace(read=lambda _: b'')
    return jar, cls, method


def run(jar, cls, method):
    with patch('grid_doctor.disposal_wrappers.requirements',
               return_value={'fields': [], 'initializers': []}), \
         patch('grid_doctor.disposal_wrappers.bootstraps', return_value=[]), \
         patch('grid_doctor.disposal_wrappers.method_trace', return_value={}):
        return map_wrapper(jar, ModelCode(), cls, method)


def flag_model():
    jar, cls, method = model()
    cls.cp.extend([(1, 'flag'), (1, 'Z'), (12, (19, 20)), (9, (2, 21))])
    cls.fields.append(Member('field', 'flag', 'Z', 2))
    method.code = bytes([42, 180, 0, 22, 153, 0, 4, 177, 42, 183, 0, 18, 177])
    return jar, cls, method


def run_flags(jar, cls, method):
    with patch('grid_doctor.disposal_wrappers.bootstraps', return_value=[]), \
         patch('grid_doctor.disposal_wrappers.method_trace', return_value={}):
        return false_fields_delegate(jar, ModelCode(), cls, method)


class DisposalWrapperTests(unittest.TestCase):
    def test_map_count_excludes_delegate_cost_and_runtime_authority(self):
        result = run(*model())
        self.assertEqual(result['mapRemoveCallBound'], 1)
        self.assertEqual(result['instructionBound'], 9)
        self.assertEqual(result['delegate'], ['Base', 'dispose', '()V'])
        self.assertFalse(result['boundedAdmission'])
        self.assertFalse(result['writeAuthority'])

    def test_empty_delegate_and_unrelated_members(self):
        jar, cls, method = model(); method.code = method.code[-5:]
        cls.fields.append(Member('field', 'extra', 'I', 2))
        self.assertEqual(run(jar, cls, method)['mapRemoveCallBound'], 0)

    def test_changed_branch_refuses(self):
        jar, cls, method = model(); body = bytearray(method.code); body[5] = 15; method.code = bytes(body)
        with self.assertRaisesRegex(Refusal, 'map-branch'):
            run(jar, cls, method)

    def test_different_map_operation_refuses(self):
        jar, cls, method = model(); cls.cp[9] = (1, 'get')
        with self.assertRaisesRegex(Refusal, 'map-call'):
            run(jar, cls, method)

    def test_instance_or_missing_field_refuses(self):
        for missing in (False, True):
            jar, cls, method = model()
            if missing:
                cls.fields.clear()
            else:
                cls.fields[0].flags = 2
            with self.subTest(missing=missing), self.assertRaisesRegex(Refusal, 'map-declaration'):
                run(jar, cls, method)

    def test_foreign_delegate_refuses(self):
        jar, cls, method = model(); cls.cp[13] = (1, 'Other')
        with self.assertRaisesRegex(Refusal, 'delegate-identity'):
            run(jar, cls, method)

    def test_inserted_call_and_handler_refuse(self):
        jar, cls, method = model(); method.code = bytes([42, 184, 0, 18, 177])
        with self.assertRaisesRegex(Refusal, 'delegate-shape'):
            run(jar, cls, method)
        jar, cls, method = model(); method.handlers = ((0, 14, 14, 0),)
        with self.assertRaisesRegex(Refusal, 'signature-or-handler'):
            run(jar, cls, method)

    def test_false_flag_path_retains_its_runtime_condition(self):
        result = run_flags(*flag_model())
        self.assertEqual(result['requiredFalseFields'], [['Wrapper', 'flag', 'Z']])
        self.assertEqual(result['instructionBound'], 6)
        self.assertFalse(result['boundedAdmission'])

    def test_inverted_flag_and_changed_target_refuse(self):
        for offset, value in [(4, 154), (6, 3)]:
            jar, cls, method = flag_model(); body = bytearray(method.code)
            body[offset] = value; method.code = bytes(body)
            with self.subTest(offset=offset), self.assertRaisesRegex(Refusal, 'delegate-shape'):
                run_flags(jar, cls, method)

    def test_flag_back_edge_refuses(self):
        jar, cls, method = flag_model(); body = bytearray(method.code); body[6] = 0; method.code = bytes(body)
        with self.assertRaisesRegex(Refusal, 'flags-branch'):
            run_flags(jar, cls, method)

    def test_static_flag_refuses(self):
        jar, cls, method = flag_model(); cls.fields[-1].flags = 10
        with self.assertRaisesRegex(Refusal, 'field-declaration'):
            run_flags(jar, cls, method)


if __name__ == '__main__':
    unittest.main()
