"""Test fixed registrations and reject effects outside the generated form."""
import copy
import unittest

from grid_symbols.scan import Class, Member, Refusal
from grid_symbols.test_resolve import FakeJar
from .descriptor_builders import registrations
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

    append = ref(10, 'Base', 'append', '(LProperty;Ljava/util/List;)V')
    field = ref(9, 'Base', 'id', 'LProperty;')
    parent = ref(10, 'Base', 'build', '(Ljava/util/List;)V')
    getter = ref(10, 'Child', 'get', '()LProperty;')
    def op(opcode, index):
        return [opcode, index >> 8, index & 255]
    base = Class('Base', 'java/lang/Object', (), 1,
                 [Member('field', 'id', 'LProperty;', 18)], [
                     Member('method', 'append', '(LProperty;Ljava/util/List;)V', 20, bytes([177])),
                     Member('method', 'build', '(Ljava/util/List;)V', 4,
                            bytes([42, 42, *op(180, field), 43, *op(182, append), 177]))], cp)
    child = Class('Child', 'Base', (), 1, [], [
        Member('method', 'get', '()LProperty;', 1, bytes([1, 176])),
        Member('method', 'build', '(Ljava/util/List;)V', 4,
               bytes([42, 43, *op(183, parent), 42, 42, *op(182, getter), 43,
                      *op(182, append), 177]))], cp)
    return FakeJar([base, child]), ModelCode(), 'Child', (
        'Base', 'build', '(Ljava/util/List;)V'), ('Base', 'append', '(LProperty;Ljava/util/List;)V')


class DescriptorBuilderTests(unittest.TestCase):
    def test_parent_and_getter_registrations_are_counted(self):
        args = model()
        result = registrations(*args)
        self.assertEqual(result['count'], 2)
        self.assertEqual([p['kind'] for p in result['registrations']], ['field', 'getter'])
        self.assertFalse(result['boundedAdmission'])
        for cls in args[0].classes.values():
            cls.methods.reverse()
        self.assertEqual(result, registrations(*args))

    def test_unexpected_list_effect_and_branch_refuse(self):
        for extra in ([43, 87], [167, 0, 3]):
            args = model()
            method = args[0].classes['Child'].methods[1]
            method.code = method.code[:-1] + bytes(extra + [177])
            with self.assertRaisesRegex(Refusal, 'registration-shape'):
                registrations(*args)

    def test_append_override_or_nonfinal_refuses(self):
        for override in (False, True):
            args = model()
            method = args[0].classes['Base'].methods[0]
            if override:
                args[0].classes['Child'].methods.append(copy.deepcopy(method))
            else:
                method.flags &= ~16
            with self.assertRaisesRegex(Refusal, 'append-target'):
                registrations(*args)

    def test_concrete_receiver_override_is_selected(self):
        args = model()
        parent, child = args[0].classes['Base'], args[0].classes['Child']
        parent.methods.append(copy.deepcopy(child.methods[0]))
        result = registrations(*args)
        self.assertEqual(result['registrations'][1]['source'][0], 'Child')

    def test_static_getter_field_and_handler_refuse(self):
        for change in ('getter', 'field', 'handler'):
            args = model()
            if change == 'getter':
                args[0].classes['Child'].methods[0].flags |= 8
            elif change == 'field':
                args[0].classes['Base'].fields[0].flags |= 8
            else:
                args[0].classes['Child'].methods[1].handlers = ((0, 2, 2, 0),)
            with self.assertRaises(Refusal):
                registrations(*args)

    def test_duplicate_method_refuses(self):
        args = model()
        cls = args[0].classes['Child']
        cls.methods.append(copy.deepcopy(cls.methods[0]))
        with self.assertRaisesRegex(Refusal, 'duplicate-method'):
            registrations(*args)

    def test_attribute_requires_explicit_target_and_exact_operands(self):
        args = model()
        cls = args[0].classes['Child']
        cp = cls.cp
        def add(tag, value):
            cp.append((tag, value))
            return len(cp) - 1
        def ref(tag, owner, name, desc):
            o = add(7, add(1, owner))
            n, d = add(1, name), add(1, desc)
            return add(tag, (o, add(12, (n, d))))
        label = add(8, add(1, 'not_engine'))
        value = ref(9, 'java/lang/Boolean', 'TRUE', 'Ljava/lang/Boolean;')
        target = ('Base', 'attribute', '(Ljava/lang/String;Ljava/lang/Object;)V')
        call = ref(10, *target)
        args[0].classes['Base'].methods.append(Member('method', *target[1:], 1, bytes([177])))
        method = cls.methods[1]
        method.code = method.code[:-1] + bytes([42, 18, label, 178, 0, value, 182, 0, call, 177])
        with self.assertRaisesRegex(Refusal, 'registration-shape'):
            registrations(*args)
        result = registrations(*args, attribute=target)
        self.assertEqual(result['count'], 2)
        self.assertEqual(len(result['attributes']), 1)
        cp[cp[label][1]] = (1, 'another_attribute')
        with self.assertRaisesRegex(Refusal, 'attribute-operands'):
            registrations(*args, attribute=target)


if __name__ == '__main__':
    unittest.main()
