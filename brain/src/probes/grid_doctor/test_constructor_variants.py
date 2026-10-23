"""Test the two explicit constructor projections on inert classes."""
import copy
import unittest

from grid_symbols.scan import Class, Member, Refusal
from grid_symbols.test_resolve import FakeJar
from .constructor_variants import empty_holder, map_capacity_one
from .contracts import contract
from .test_descriptor_resolution import ModelCode


def pool():
    cp = [None]
    def add(tag, value):
        cp.append((tag, value)); return len(cp) - 1
    def typ(name):
        return add(7, add(1, name))
    def ref(tag, owner, name, desc):
        o = typ(owner); n, d = add(1, name), add(1, desc)
        return add(tag, (o, add(12, (n, d))))
    return cp, typ, ref


def map_model():
    cp, typ, ref = pool()
    parent = ref(10, 'java/lang/Object', '<init>', '()V')
    allocated = typ('java/util/LinkedHashMap')
    call = ref(10, 'java/util/LinkedHashMap', '<init>', '(I)V')
    field = ref(9, 'Owner', 'map', 'Ljava/util/Map;')
    method = Member('method', '<init>', '()V', 1,
                    bytes([42, 183, 0, parent, 42, 187, 0, allocated, 89,
                           4, 183, 0, call, 181, 0, field, 177]))
    cls = Class('Owner', 'java/lang/Object', (), 1,
                [Member('field', 'map', 'Ljava/util/Map;', 18)], [method], cp)
    old = copy.deepcopy(cls)
    old.methods[0].code = method.code[:9] + method.code[10:]
    old.cp = [(1, '()V') if entry == (1, '(I)V') else entry for entry in old.cp]
    return cls, old


def holder_model():
    cp, typ, ref = pool()
    parent = ref(10, 'java/lang/Object', '<init>', '()V')
    allocated = typ('Holder'); call = ref(10, 'Holder', '<init>', '()V')
    field = ref(9, 'Owner', 'holder', 'LHolder;')
    method = Member('method', '<init>', '()V', 1,
                    bytes([42, 183, 0, parent, 42, 187, 0, allocated, 89,
                           183, 0, call, 181, 0, field, 177]))
    cls = Class('Owner', 'java/lang/Object', (), 1,
                [Member('field', 'holder', 'LHolder;', 18)], [method], cp)
    holder = Class('Holder', 'java/lang/Object', (), 1,
                   [Member('field', 'value', 'Ljava/lang/Object;', 2)],
                   [Member('method', '<init>', '()V', 1, bytes([42, 183, 0, parent, 177]))], cp)
    old = copy.deepcopy(cls)
    old.methods[0].code = method.code[:4] + bytes([177])
    return FakeJar([cls, holder]), cls, old


class ConstructorVariantTests(unittest.TestCase):
    def test_map_projection_keeps_strict_contract_different(self):
        cls, old = map_model(); classes = {'Owner': cls}
        source = contract(old, old.methods[0], classes)
        original = contract(cls, cls.methods[0], classes)
        projected = map_capacity_one(cls, cls.methods[0], classes)
        self.assertNotEqual(original['digest'], source['digest'])
        self.assertEqual(projected['digest'], source['digest'])
        self.assertEqual(projected['constructorVariant']['targetCapacity'], 1)
        self.assertEqual(contract(cls, cls.methods[0], classes), original)

    def test_other_capacity_or_nonfresh_receiver_refuses(self):
        for change in ('capacity', 'receiver'):
            cls, _ = map_model(); raw = bytearray(cls.methods[0].code)
            raw[9 if change == 'capacity' else 4] = 5 if change == 'capacity' else 43
            cls.methods[0].code = bytes(raw)
            with self.assertRaises(Refusal):
                map_capacity_one(cls, cls.methods[0], {'Owner': cls})

    def test_branch_handler_and_wrong_method_refuse(self):
        for change in ('branch', 'handler', 'name'):
            cls, _ = map_model(); method = cls.methods[0]
            if change == 'branch':
                method.code = method.code[:-1] + bytes([167, 0, 3, 177])
            elif change == 'handler':
                method.handlers = ((0, 16, 16, 0),)
            else:
                method.name = 'reset'
            with self.assertRaisesRegex(Refusal, 'constructor-shape'):
                map_capacity_one(cls, method, {'Owner': cls})

    def test_map_projection_retains_another_operation_change(self):
        cls, old = map_model()
        cls.methods[0].code = cls.methods[0].code[:-1] + bytes([3, 87, 177])
        self.assertNotEqual(map_capacity_one(cls, cls.methods[0], {'Owner': cls})['digest'],
                            contract(old, old.methods[0], {'Owner': old})['digest'])

    def test_holder_projection_records_added_allocation(self):
        jar, cls, old = holder_model()
        projected = empty_holder(jar, ModelCode(), cls, cls.methods[0])
        self.assertEqual(projected['digest'], contract(old, old.methods[0], jar.classes)['digest'])
        self.assertNotEqual(projected['digest'], contract(cls, cls.methods[0], jar.classes)['digest'])
        self.assertEqual(projected['constructorVariant']['addedObjectAllocations'], 1)
        self.assertEqual(projected['constructorVariant']['holderConstructorInstructions'], 3)

    def test_holder_initialization_or_finalizer_refuses(self):
        for change in ('initializer', 'finalizer', 'write', 'value-field'):
            jar, cls, _ = holder_model(); holder = jar.classes['Holder']
            if change in ('initializer', 'finalizer'):
                holder.methods.append(Member('method', '<clinit>' if change == 'initializer' else 'finalize',
                                             '()V', 8 if change == 'initializer' else 1, bytes([177])))
            elif change == 'write':
                holder.methods[0].code = bytes([42, 1, 87, 177])
            else:
                holder.fields[0].flags = 1
            with self.assertRaisesRegex(Refusal, 'empty-holder-class'):
                empty_holder(jar, ModelCode(), cls, cls.methods[0])

    def test_holder_field_and_extra_effect_refuse(self):
        for change in ('field', 'effect'):
            jar, cls, _ = holder_model()
            if change == 'field':
                cls.fields[0].flags = 2
            else:
                cls.methods[0].code = cls.methods[0].code[:-1] + bytes([3, 87, 177])
            with self.assertRaises(Refusal):
                empty_holder(jar, ModelCode(), cls, cls.methods[0])


if __name__ == '__main__':
    unittest.main()
