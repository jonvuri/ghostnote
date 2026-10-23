"""Test explicit bootstrap forms and refusal without JVM execution."""
import copy
import unittest

from grid_symbols.scan import Class, Member, Refusal
from .bootstrap_contracts import bootstrap_contract
from .contracts import contract
from .migrate import bindings

LOOKUP = 'Ljava/lang/invoke/MethodHandles$Lookup;Ljava/lang/String;Ljava/lang/invoke/MethodType;'


def fixture(owner='Receiver', implementation='message', concat=False):
    name = 'makeConcatWithConstants' if concat else 'get'
    desc = '(Ljava/lang/String;)Ljava/lang/String;' if concat else '(L' + owner + ';)Ljava/util/function/Supplier;'
    cp = [None, (1, name), (1, desc), (12, (1, 2)), (18, (0, 3))]
    root = Member('method', 'root', '()Ljava/lang/Object;', 1, bytes([186, 0, 4, 0, 0, 176]))
    supplier = Member('method', implementation, '()Ljava/lang/String;', 4098, bytes([1, 176]))
    cls = Class(owner, 'java/lang/Object', (), 1, [], [root, supplier], cp)
    if concat:
        factory = {'tag': 10, 'owner': 'java/lang/invoke/StringConcatFactory',
                   'name': 'makeConcatWithConstants',
                   'descriptor': '(' + LOOKUP + 'Ljava/lang/String;[Ljava/lang/Object;)Ljava/lang/invoke/CallSite;'}
        arguments = [{'tag': 8, 'value': 'Object of type \x01 has been disposed'}]
    else:
        factory = {'tag': 10, 'owner': 'java/lang/invoke/LambdaMetafactory', 'name': 'metafactory',
                   'descriptor': '(' + LOOKUP + 'Ljava/lang/invoke/MethodType;Ljava/lang/invoke/MethodHandle;Ljava/lang/invoke/MethodType;)Ljava/lang/invoke/CallSite;'}
        arguments = [{'tag': 16, 'value': '()Ljava/lang/Object;'},
                     {'tag': 15, 'kind': 5, 'target': {'tag': 10, 'owner': owner, 'name': implementation,
                                                   'descriptor': '()Ljava/lang/String;'}},
                     {'tag': 16, 'value': '()Ljava/lang/String;'}]
    return cls, root, [{'handle': {'tag': 15, 'kind': 6, 'target': factory}, 'arguments': arguments}]


class BootstrapTests(unittest.TestCase):
    def test_supplier_renaming_preserves_handle_identity(self):
        a, am, ab = fixture()
        b, bm, bb = fixture('Renamed', 'different')
        av = bootstrap_contract(a, am, {a.name: a}, ab)
        bv = bootstrap_contract(b, bm, {b.name: b}, bb)
        mapped = bindings(av, bv)
        self.assertEqual(mapped[1][(10, 'Receiver', 'message', '()Ljava/lang/String;')],
                         (10, 'Renamed', 'different', '()Ljava/lang/String;'))
        with self.assertRaisesRegex(Refusal, 'unsupported-constant:18'):
            contract(a, am, {a.name: a})

    def test_concat_recipe_and_signature_are_required(self):
        cls, method, bs = fixture(concat=True)
        bootstrap_contract(cls, method, {cls.name: cls}, bs)
        bs[0]['arguments'][0]['value'] = 'changed \x01'
        with self.assertRaisesRegex(Refusal, 'concat-recipe'):
            bootstrap_contract(cls, method, {cls.name: cls}, bs)

    def test_unsupported_handles_method_types_and_receiver_refuse(self):
        mutations = [lambda b: b[0]['handle'].update(kind=5),
                     lambda b: b[0]['handle']['target'].update(name='altMetafactory'),
                     lambda b: b[0]['arguments'][1].update(kind=6),
                     lambda b: b[0]['arguments'][1]['target'].update(owner='Other'),
                     lambda b: b[0]['arguments'][0].update(value='()Ljava/lang/String;'),
                     lambda b: b[0]['arguments'][2].update(value='()Ljava/lang/Object;')]
        for mutate in mutations:
            cls, method, bs = fixture()
            mutate(bs)
            with self.subTest(mutation=mutate), self.assertRaises(Refusal):
                bootstrap_contract(cls, method, {cls.name: cls}, bs)
        cls, method, bs = fixture()
        cls.cp[2] = (1, '(LOther;)Ljava/util/function/Supplier;')
        with self.assertRaisesRegex(Refusal, 'captured-receiver'):
            bootstrap_contract(cls, method, {cls.name: cls}, bs)

    def test_missing_duplicate_and_changed_supplier_refuse(self):
        for action in ('missing', 'duplicate', 'flags'):
            cls, method, bs = fixture()
            if action == 'missing':
                cls.methods.pop()
            elif action == 'duplicate':
                cls.methods.append(copy.deepcopy(cls.methods[-1]))
            else:
                cls.methods[-1].flags = 1
            with self.subTest(action=action), self.assertRaisesRegex(Refusal, 'implementation-declaration'):
                bootstrap_contract(cls, method, {cls.name: cls}, bs)

    def test_missing_entry_and_condy_refuse(self):
        cls, method, bs = fixture()
        with self.assertRaisesRegex(Refusal, 'missing-entry'):
            bootstrap_contract(cls, method, {cls.name: cls}, [])
        cls.cp[4] = (17, (0, 3))
        with self.assertRaisesRegex(Refusal, 'unsupported-constant:17'):
            bootstrap_contract(cls, method, {cls.name: cls}, bs)

    def test_unrelated_members_and_enumeration_preserve_contract(self):
        cls, method, bs = fixture()
        expected = bootstrap_contract(cls, method, {cls.name: cls}, bs)
        cls.methods.reverse()
        cls.methods.append(Member('method', 'extra', '()V', 1, bytes([177])))
        self.assertEqual(expected, bootstrap_contract(cls, method, {cls.name: cls}, bs))


if __name__ == '__main__':
    unittest.main()
