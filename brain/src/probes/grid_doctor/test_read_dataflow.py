"""Test receiver and argument flow without loading vendor classes."""
import unittest
from grid_symbols.scan import Class, Member, Refusal
from grid_symbols.test_resolve import FakeJar
from .read_dataflow import ReadFlow, integer, path_bound, signature
from .test_descriptor_resolution import ModelCode


def model(body, desc='()I', methods=(), cp=None, parent='java/lang/Object', others=()):
    cls = Class('Receiver', parent, (), 1, [],
                [Member('method', 'read', desc, 1, bytes(body)), *methods], cp or [None])
    jar = FakeJar([cls, *others])
    flow = ReadFlow(jar, ModelCode(), [], ('Receiver', 'id', 'I'), 17, 'Descriptor')
    return flow, ('ref', 'Receiver', 'object')


def pool(owner, name, desc, tag=10):
    return [None, (1, owner), (7, 1), (1, name), (1, desc), (12, (3, 4)), (tag, (2, 5))]


class ReadDataflowTests(unittest.TestCase):
    def test_explicit_static_guard_excludes_lazy_allocation(self):
        other = Class('Descriptor', 'java/lang/Object', (), 1, [], [])
        flow, receiver = model([178, 0, 6, 199, 0, 7, 187, 0, 2, 176, 178, 0, 6, 176],
                               '()LDescriptor;', cp=pool('Receiver', 'slot', 'LDescriptor;', 9),
                               others=[other])
        flow.jar.classes['Receiver'].fields.append(Member('field', 'slot', 'LDescriptor;', 10))
        flow.descriptor_class = 'RootDescriptor'
        with self.assertRaisesRegex(Refusal, 'opcode'):
            flow.evaluate('Receiver', 'read', '()LDescriptor;', receiver)
        field = ('Receiver', 'slot', 'LDescriptor;')
        value = ('ref', 'Descriptor', 'property')
        guarded = ReadFlow(flow.jar, ModelCode(), [], ('Receiver', 'id', 'I'), 17, 'RootDescriptor',
                           static_values={field: value})
        self.assertEqual(guarded.evaluate('Receiver', 'read', '()LDescriptor;', receiver), {value})
        self.assertEqual(guarded.static_fields, {field})
        self.assertEqual(guarded.bounds[('Receiver', 'read', '()LDescriptor;', receiver, (), False)],
                         (4, 0, 0))

    def test_static_guard_requires_a_static_field_and_assignable_instance(self):
        for change in ('instance-field', 'wrong-type', 'unknown-value'):
            flow, _ = model([3, 172])
            cls = flow.jar.classes['Receiver']
            cls.fields.append(Member('field', 'slot', 'LReceiver;', 8 if change != 'instance-field' else 0))
            other = Class('Other', 'java/lang/Object', (), 1, [], [])
            flow.jar.classes['Other'] = other
            value = ('ref', 'Other' if change == 'wrong-type' else 'Receiver', 'property')
            if change == 'unknown-value':
                value = ('unknown', 'LReceiver;', None)
            with self.assertRaisesRegex(Refusal, 'static-guard'):
                ReadFlow(flow.jar, ModelCode(), [], ('Receiver', 'id', 'I'), 17, 'Descriptor',
                         static_values={('Receiver', 'slot', 'LReceiver;'): value})

    def test_repeated_callee_counts_each_runtime_invocation(self):
        helper = Member('method', 'value', '()I', 1, bytes([4, 172]))
        flow, receiver = model([42, 182, 0, 6, 42, 182, 0, 6, 96, 172],
                               methods=[helper], cp=pool('Receiver', 'value', '()I'))
        key = ('Receiver', 'read', '()I', receiver, (), False)
        flow.evaluate(*key[:4])
        self.assertEqual(flow.bounds[key], (10, 2, 0))
        before = dict(flow.work)
        flow.evaluate(*key[:4])
        self.assertEqual(flow.bounds[key], (10, 2, 0))
        self.assertEqual(flow.work, before)

    def test_known_and_unknown_branches_have_distinct_bounds(self):
        flow, receiver = model([27, 153, 0, 7, 3, 3, 96, 172, 4, 172], '(I)I')
        for value, cost in [(integer(0), 4), (integer(), 6)]:
            flow.evaluate('Receiver', 'read', '(I)I', receiver, (value,))
            key = ('Receiver', 'read', '(I)I', receiver, (value,), False)
            self.assertEqual(flow.bounds[key], (cost, 0, 0))

    def test_external_body_is_excluded_but_invocation_is_counted(self):
        flow, receiver = model([3, 184, 0, 6, 176], '()Ljava/lang/Integer;',
                               cp=pool('java/lang/Integer', 'valueOf', '(I)Ljava/lang/Integer;'))
        flow.evaluate('Receiver', 'read', '()Ljava/lang/Integer;', receiver)
        self.assertEqual(flow.bounds[('Receiver', 'read', '()Ljava/lang/Integer;', receiver, (), False)],
                         (3, 0, 1))

    def test_merged_paths_keep_the_larger_cost(self):
        edges = {'start': [('short', (1, 0, 0)), ('long', (3, 0, 0))],
                 'short': [('end', (2, 0, 7))], 'long': [('end', (5, 2, 0))], 'end': []}
        self.assertEqual(path_bound(edges)['start'], (9, 2, 7))

    def test_cost_graph_has_no_python_recursion_dependency(self):
        edges = {i: [(i + 1, (1, 0, 0))] for i in range(3000)}
        edges[3000] = []
        self.assertEqual(path_bound(edges)[0], (3001, 0, 0))

    def test_cost_cycle_missing_target_and_limit_refuse(self):
        for edges, reason in [({0: [(0, (1, 0, 0))]}, 'cycle'),
                              ({0: [(1, (1, 0, 0))]}, 'target'),
                              ({0: [(1, (2000000, 0, 0))], 1: []}, 'limit'),
                              ({0: [(1, (1, 16001, 0))], 1: []}, 'limit')]:
            with self.subTest(reason=reason), self.assertRaisesRegex(Refusal, reason):
                path_bound(edges)

    def test_signature_arrays_and_wide_arguments(self):
        self.assertEqual(signature('([ILX;D)J'), (['[I', 'LX;', 'D'], 'J'))
        with self.assertRaisesRegex(Refusal, 'signature'):
            signature('(V)I')
        flow, receiver = model([28, 172], '(JI)I')
        with self.assertRaisesRegex(Refusal, 'local-load'):
            flow.evaluate('Receiver', 'read', '(JI)I', receiver, (('unknown', 'J', None), integer(9)))
        flow, receiver = model([29, 172], '(JI)I')
        self.assertEqual(flow.evaluate('Receiver', 'read', '(JI)I', receiver,
                                      (('unknown', 'J', None), integer(9))), {integer(9)})

    def test_known_branch_and_unknown_branch(self):
        flow, receiver = model([27, 153, 0, 5, 4, 172, 5, 172], '(I)I')
        self.assertEqual(flow.evaluate('Receiver', 'read', '(I)I', receiver, (integer(0),)), {integer(2)})
        self.assertEqual(flow.evaluate('Receiver', 'read', '(I)I', receiver, (integer(),)), {integer(1), integer(2)})

    def test_property_field_id_is_receiver_scoped(self):
        flow, receiver = model([42, 180, 0, 6, 172], cp=pool('Receiver', 'id', 'I', 9))
        self.assertEqual(flow.evaluate('Receiver', 'read', '()I', ('ref', 'Receiver', 'property')), {integer(17)})
        self.assertEqual(flow.evaluate('Receiver', 'read', '()I', receiver), {('unknown', 'I', None)})

    def test_descriptor_argument_must_keep_the_property_id(self):
        flow, _ = model([3, 172], '(Ljava/lang/Object;I)I')
        with self.assertRaisesRegex(Refusal, 'dispatch-id'):
            flow.evaluate('Receiver', 'read', '(Ljava/lang/Object;I)I', ('ref', 'Receiver', 'descriptor'),
                          (('ref', 'Receiver', 'object'), integer(18)))

    def test_property_parent_guard_is_receiver_and_field_scoped(self):
        flow, receiver = model([42, 180, 0, 6, 176], '()LDescriptor;',
                               cp=pool('Receiver', 'parent', 'LDescriptor;', 9))
        flow.property_descriptor = (('Receiver', 'parent', 'LDescriptor;'), 'Descriptor')
        self.assertEqual(flow.evaluate('Receiver', 'read', '()LDescriptor;',
                                       ('ref', 'Receiver', 'property')),
                         {('ref', 'Descriptor', 'descriptor')})
        self.assertEqual(flow.evaluate('Receiver', 'read', '()LDescriptor;', receiver),
                         {('unknown', 'LDescriptor;', None)})
        flow, _ = model([42, 180, 0, 6, 176], '()LDescriptor;',
                        cp=pool('Receiver', 'other', 'LDescriptor;', 9))
        flow.property_descriptor = (('Receiver', 'parent', 'LDescriptor;'), 'Descriptor')
        self.assertEqual(flow.evaluate('Receiver', 'read', '()LDescriptor;',
                                       ('ref', 'Receiver', 'property')),
                         {('unknown', 'LDescriptor;', None)})

    def test_unknown_vendor_receiver_refuses(self):
        flow, _ = model([3, 172])
        with self.assertRaisesRegex(Refusal, 'unknown-receiver'):
            flow.evaluate('Receiver', 'read', '()I', ('unknown', 'LReceiver;', None))

    def test_virtual_and_special_dispatch_differ(self):
        base = Class('Base', 'java/lang/Object', (), 1, [],
                     [Member('method', 'value', '()I', 1, bytes([4, 172]))], [None])
        methods = [Member('method', 'value', '()I', 1, bytes([5, 172]))]
        for opcode, expected in ((182, 2), (183, 1)):
            flow, receiver = model([42, opcode, 0, 6, 172], methods=methods,
                                   cp=pool('Base', 'value', '()I'), parent='Base', others=[base])
            self.assertEqual(flow.evaluate('Receiver', 'read', '()I', receiver), {integer(expected)})

    def test_cycle_and_back_edge_refuse(self):
        flow, receiver = model([42, 182, 0, 6, 172], cp=pool('Receiver', 'read', '()I'))
        with self.assertRaisesRegex(Refusal, 'recursion'):
            flow.evaluate('Receiver', 'read', '()I', receiver)
        flow, receiver = model([167, 0, 0])
        with self.assertRaisesRegex(Refusal, 'back-edge'):
            flow.evaluate('Receiver', 'read', '()I', receiver)

    def test_external_call_stays_a_dependency(self):
        flow, receiver = model([3, 184, 0, 6, 176], '()Ljava/lang/Integer;',
                               cp=pool('java/lang/Integer', 'valueOf', '(I)Ljava/lang/Integer;'))
        flow.evaluate('Receiver', 'read', '()Ljava/lang/Integer;', receiver)
        self.assertEqual(flow.external, {('java/lang/Integer', 'valueOf', '(I)Ljava/lang/Integer;', None)})

    def test_arithmetic_uses_jvm_integer_overflow(self):
        flow, receiver = model([27, 4, 96, 172], '(I)I')
        self.assertEqual(flow.evaluate('Receiver', 'read', '(I)I', receiver, (integer(2**31 - 1),)), {integer(-2**31)})

    def test_work_limit_refuses(self):
        flow, receiver = model([3, 172]); flow.work['states'] = 100000
        with self.assertRaisesRegex(Refusal, 'state-limit'):
            flow.evaluate('Receiver', 'read', '()I', receiver)

    def test_call_limit_refuses_before_external_dispatch(self):
        flow, receiver = model([3, 184, 0, 6, 176], '()Ljava/lang/Integer;',
                               cp=pool('java/lang/Integer', 'valueOf', '(I)Ljava/lang/Integer;'))
        flow.work['calls'] = 16000
        with self.assertRaisesRegex(Refusal, 'call-limit'):
            flow.evaluate('Receiver', 'read', '()Ljava/lang/Integer;', receiver)
        self.assertFalse(flow.external)

    def test_special_call_requires_a_known_nonnull_receiver(self):
        flow, _ = model([3, 172])
        for value in [('null', 'Ljava/lang/Object;', None), ('unknown', 'LReceiver;', None)]:
            with self.subTest(value=value), self.assertRaisesRegex(Refusal, 'unknown-receiver'):
                flow.evaluate('Receiver', 'read', '()I', value, direct=True)

    def test_private_virtual_form_refuses(self):
        base = Class('Base', 'java/lang/Object', (), 1, [],
                     [Member('method', 'value', '()I', 2, bytes([4, 172]))], [None])
        flow, receiver = model([42, 182, 0, 6, 172],
                               methods=[Member('method', 'value', '()I', 1, bytes([5, 172]))],
                               cp=pool('Base', 'value', '()I'), parent='Base', others=[base])
        with self.assertRaisesRegex(Refusal, 'private-or-unresolved-virtual'):
            flow.evaluate('Receiver', 'read', '()I', receiver)


if __name__ == '__main__':
    unittest.main()
