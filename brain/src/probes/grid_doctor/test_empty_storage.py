"""Test empty-list reference checks on inert classes."""
import copy
import unittest

from grid_symbols.scan import Class, Member, Refusal
from grid_symbols.test_resolve import FakeJar
from .empty_storage import empty_list_references
from .test_descriptor_resolution import ModelCode


def model():
    cp = [None]
    def add(tag, value):
        cp.append((tag, value))
        return len(cp) - 1
    def ref(tag, owner, name, desc):
        o = add(7, add(1, owner))
        n, d = add(1, name), add(1, desc)
        return add(tag, (o, add(12, (n, d))))
    typ = add(7, add(1, 'java/util/ArrayList'))
    ctor = ref(10, 'java/util/ArrayList', '<init>', '()V')
    field = ref(9, 'Descriptor', 'expressions', 'Ljava/util/List;')
    read = ref(11, 'java/util/List', 'isEmpty', '()Z')
    cls = Class('Descriptor', 'java/lang/Object', (), 1,
                [Member('field', 'expressions', 'Ljava/util/List;', 18)], [
                    Member('method', '<init>', '()V', 1,
                           bytes([42, 187, 0, typ, 89, 183, 0, ctor, 181, 0, field, 177])),
                    Member('method', 'check', '()V', 1,
                           bytes([42, 180, 0, field, 185, 0, read, 1, 0, 87, 177]))], cp)
    jar = FakeJar([cls]); jar.sha256 = 'model'
    target = {'tag': 9, 'owner': cls.name, 'name': 'expressions', 'descriptor': 'Ljava/util/List;'}
    scan = {'input': {'sha256': jar.sha256}, 'work': {'classes': 1, 'methods': 2},
            'methodHandles': [], 'unresolvedReferences': [], 'sites': []}
    for name, offset, op in [('<init>', 8, 181), ('check', 1, 180)]:
        scan['sites'].append({'caller': cls.name, 'method': name, 'descriptor': '()V',
                              'offset': offset, 'opcode': op, 'target': target,
                              'resolution': {'owner': cls.name}})
    return jar, ModelCode(), ('Descriptor', 'expressions', 'Ljava/util/List;'), scan


class EmptyStorageTests(unittest.TestCase):
    def test_one_fresh_assignment_and_read_remain_conditional(self):
        result = empty_list_references(*model())
        self.assertTrue(result['ordinaryReferenceCheck'])
        self.assertFalse(result['boundedAdmission'])
        self.assertIn('Reflective and native mutation require separate exclusion.', result['conditions'])

    def test_coverage_and_private_final_field_are_required(self):
        for change in ('coverage', 'hash', 'access'):
            args = model()
            if change == 'coverage':
                args[3]['work']['methods'] -= 1
            elif change == 'hash':
                args[3]['input']['sha256'] = 'other'
            else:
                args[0].classes['Descriptor'].fields[0].flags = 2
            with self.assertRaises(Refusal):
                empty_list_references(*args)

    def test_duplicate_or_missing_assignment_refuses(self):
        for duplicate in (False, True):
            args = model()
            if duplicate:
                args[3]['sites'].append(copy.deepcopy(args[3]['sites'][0]))
            else:
                del args[3]['sites'][0]
            with self.assertRaisesRegex(Refusal, 'reference-count'):
                empty_list_references(*args)

    def test_reference_escape_and_mutator_refuse(self):
        args = model()
        cls = args[0].classes['Descriptor']
        cls.methods[1].code = cls.methods[1].code[:4] + bytes([176])
        with self.assertRaisesRegex(Refusal, 'reference-escape'):
            empty_list_references(*args)
        args = model(); cls = args[0].classes['Descriptor']
        index = next(i for i, v in enumerate(cls.cp) if v == (1, 'isEmpty'))
        cls.cp[index] = (1, 'clear')
        with self.assertRaisesRegex(Refusal, 'list-operation'):
            empty_list_references(*args)

    def test_handle_or_unresolved_subtype_refuses(self):
        for key in ('methodHandles', 'unresolvedReferences'):
            args = model()
            args[3][key].append({'target': args[3]['sites'][0]['target']})
            with self.assertRaisesRegex(Refusal, 'unresolved-or-handle'):
                empty_list_references(*args)

    def test_unrelated_signature_does_not_alias_the_field(self):
        args = model()
        args[0].classes['Other'] = Class('Other', 'java/lang/Object', (), 1, [], [])
        args[3]['work']['classes'] = 2
        ref = dict(args[3]['sites'][0]['target'], owner='Other')
        args[3]['unresolvedReferences'].append({'target': ref})
        self.assertTrue(empty_list_references(*args)['ordinaryReferenceCheck'])

    def test_initializer_handler_or_entered_block_refuses(self):
        args = model()
        args[0].classes['Descriptor'].methods[0].handlers = ((0, 11, 11, 0),)
        with self.assertRaisesRegex(Refusal, 'initializer'):
            empty_list_references(*args)
        args = model()
        method = args[0].classes['Descriptor'].methods[0]
        method.code = method.code[:-1] + bytes([167, 255, 253, 177])
        with self.assertRaisesRegex(Refusal, 'initializer-entry'):
            empty_list_references(*args)

    def test_reader_handler_does_not_change_reference_use(self):
        args = model()
        args[0].classes['Descriptor'].methods[1].handlers = ((0, 9, 10, 0),)
        self.assertTrue(empty_list_references(*args)['ordinaryReferenceCheck'])


if __name__ == '__main__':
    unittest.main()
