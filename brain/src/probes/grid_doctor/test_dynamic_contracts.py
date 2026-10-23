"""Test retained dynamic payloads without executing a bootstrap."""
import copy
import unittest

from grid_symbols.scan import Member, Refusal
from .contracts import contract
from .dynamic_contracts import dynamic_contract
from .migrate import bindings
from .test_bootstrap_contracts import fixture


class DynamicTests(unittest.TestCase):
    def value(self, triple):
        cls, method, bootstrap = triple
        return dynamic_contract(cls, method, {cls.name: cls}, bootstrap)

    def test_renamed_implementation_and_capture_bind(self):
        a, b = fixture(), fixture('Changed', 'renamed')
        mapped = bindings(self.value(a), self.value(b))
        self.assertEqual(mapped[0], {'Receiver': 'Changed'})
        self.assertEqual(mapped[1][(10, 'Receiver', 'message', '()Ljava/lang/String;')],
                         (10, 'Changed', 'renamed', '()Ljava/lang/String;'))

    def test_strict_comparator_still_refuses_dynamic(self):
        cls, method, _ = fixture()
        with self.assertRaisesRegex(Refusal, 'unsupported-constant:18'):
            contract(cls, method, {cls.name: cls})

    def test_implementation_kind_and_signature_are_retained(self):
        original = fixture()
        for field, value in [('kind', 6), ('descriptor', '(I)Ljava/lang/String;')]:
            altered = copy.deepcopy(original)
            handle = altered[2][0]['arguments'][1]
            (handle if field == 'kind' else handle['target'])[field] = value
            with self.subTest(field=field):
                self.assertNotEqual(self.value(original)['digest'], self.value(altered)['digest'])

    def test_method_types_and_capture_types_are_retained(self):
        original = fixture()
        for index in (0, 2):
            altered = copy.deepcopy(original)
            altered[2][0]['arguments'][index]['value'] = '(I)Ljava/lang/String;'
            self.assertNotEqual(self.value(original)['digest'], self.value(altered)['digest'])
        altered = copy.deepcopy(original)
        altered[0].cp[2] = (1, '(Ljava/lang/Object;)Ljava/util/function/Supplier;')
        self.assertNotEqual(self.value(original)['digest'], self.value(altered)['digest'])

    def test_member_alias_is_shared_with_static_instructions(self):
        cls, method, bs = fixture()
        cls.cp += [(1, cls.name), (7, 5), (1, 'message'), (1, '()Ljava/lang/String;'),
                   (12, (7, 8)), (10, (6, 9))]
        method = Member('method', 'root', '()Ljava/lang/Object;', 1,
                        bytes([182, 0, 10, 87, 186, 0, 4, 0, 0, 176]))
        value = self.value((cls, method, bs))
        self.assertEqual(len(value['members']), 1)
        bs[0]['arguments'][1]['target']['name'] = 'other'
        changed = self.value((cls, method, bs))
        self.assertEqual(len(changed['members']), 2)
        self.assertNotEqual(value['digest'], changed['digest'])

    def test_concat_recipe_and_constants_are_retained(self):
        original = fixture(concat=True)
        altered = copy.deepcopy(original)
        altered[2][0]['arguments'][0]['value'] = 'different \x01'
        self.assertNotEqual(self.value(original)['digest'], self.value(altered)['digest'])
        altered[2][0]['arguments'][0]['value'] += '\x02'
        altered[2][0]['arguments'].append({'tag': 3, 'value': 7})
        before = self.value(altered)['digest']
        altered[2][0]['arguments'][1]['value'] = 8
        self.assertNotEqual(before, self.value(altered)['digest'])

    def test_unchecked_factories_refuse(self):
        for change in ('kind', 'name', 'owner', 'signature'):
            row = fixture()
            h = row[2][0]['handle']
            if change == 'kind':
                h['kind'] = 5
            elif change == 'name':
                h['target']['name'] = 'altMetafactory'
            elif change == 'owner':
                h['target']['owner'] = 'Other'
            else:
                h['target']['descriptor'] = '()Ljava/lang/Object;'
            with self.subTest(change=change), self.assertRaises(Refusal):
                self.value(row)

    def test_lambda_field_handles_and_extra_arguments_refuse(self):
        for change in ('kind', 'tag', 'extra'):
            row = fixture()
            args = row[2][0]['arguments']
            if change == 'kind':
                args[1]['kind'] = 1
            elif change == 'tag':
                args[1]['target']['tag'] = 9
            else:
                args.append({'tag': 3, 'value': 1})
            with self.subTest(change=change), self.assertRaises(Refusal):
                self.value(row)

    def test_concat_missing_constant_and_dynamic_constant_refuse(self):
        row = fixture(concat=True)
        row[2][0]['arguments'][0]['value'] += '\x02'
        with self.assertRaisesRegex(Refusal, 'constant-count'):
            self.value(row)
        row[2][0]['arguments'].append({'tag': 17, 'value': 1})
        with self.assertRaisesRegex(Refusal, 'concat-constant'):
            self.value(row)

    def test_missing_bootstrap_and_condy_refuse(self):
        cls, method, bs = fixture()
        with self.assertRaisesRegex(Refusal, 'missing-entry'):
            self.value((cls, method, []))
        cls.cp[4] = (17, (0, 3))
        with self.assertRaisesRegex(Refusal, 'unsupported-constant:17'):
            self.value((cls, method, bs))

    def test_control_flow_flags_and_call_name_are_retained(self):
        original = fixture()
        for change in ('flags', 'name', 'code'):
            row = copy.deepcopy(original)
            if change == 'flags':
                row[1].flags = 9
            elif change == 'name':
                row[0].cp[1] = (1, 'run')
            else:
                row[1].code = bytes([0]) + row[1].code
            with self.subTest(change=change):
                self.assertNotEqual(self.value(original)['digest'], self.value(row)['digest'])


if __name__ == '__main__':
    unittest.main()
