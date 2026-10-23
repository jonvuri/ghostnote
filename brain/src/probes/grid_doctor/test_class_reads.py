"""Check class tests only with an exact concrete receiver and known ancestry."""
import unittest
from grid_symbols.scan import Class, Refusal
from .read_dataflow import ReadFlow, NULL, integer, unknown
from .test_descriptor_resolution import ModelCode
from .test_read_dataflow import model


def fixture(target='Target', parent='java/lang/Object', target_flags=1, enabled=True):
    target_cls = Class(target, 'java/lang/Object', (), target_flags, [], [])
    flow, receiver = model([43, 193, 0, 2, 172], '(Ljava/lang/Object;)I', parent=parent,
                           cp=[None, (1, target), (7, 1)], others=[target_cls])
    return ReadFlow(flow.jar, ModelCode(), [], ('Receiver', 'id', 'I'), 17,
                    'Descriptor', class_tests=enabled), receiver


def run(flow, receiver, value=None):
    return flow.evaluate('Receiver', 'read', '(Ljava/lang/Object;)I', receiver,
                         (receiver if value is None else value,))


class ClassReadTests(unittest.TestCase):
    def test_positive_and_negative_class_tests(self):
        for parent, expected in [('Target', 1), ('java/lang/Object', 0)]:
            flow, receiver = fixture(parent=parent)
            self.assertEqual(run(flow, receiver), {integer(expected)})
            self.assertEqual(flow.resolved_class_tests, {('Receiver', 'Target', expected)})

    def test_default_interfaces_and_external_ancestry_stay_unknown(self):
        for args in ({'enabled': False}, {'target_flags': 513}, {'parent': 'Missing'}):
            flow, receiver = fixture(**args)
            self.assertEqual(run(flow, receiver), {integer()})
            self.assertFalse(flow.resolved_class_tests)
        flow, receiver = fixture(); del flow.jar.classes['Target']
        self.assertEqual(run(flow, receiver), {integer()})

    def test_null_unknown_and_abstract_receivers_are_not_exact_classes(self):
        flow, receiver = fixture()
        self.assertEqual(run(flow, receiver, NULL), {integer(0)})
        self.assertEqual(run(flow, receiver, unknown('Ljava/lang/Object;')), {integer()})
        flow, receiver = fixture(); flow.jar.classes['Receiver'].flags |= 1024
        self.assertEqual(run(flow, receiver), {integer()})

    def test_inherited_match_can_precede_an_unknown_parent(self):
        flow, receiver = fixture(parent='Target'); flow.jar.classes['Target'].parent = 'Missing'
        self.assertEqual(run(flow, receiver), {integer(1)})

    def test_cycles_and_depth_limits_refuse(self):
        for cycle in (False, True):
            flow, receiver = fixture(parent='Target')
            if cycle:flow.jar.classes['Target'].parent = 'Receiver'
            else:flow.jar.limits.depth = 1
            with self.assertRaises(Refusal):run(flow, receiver)


if __name__ == '__main__':
    unittest.main()
