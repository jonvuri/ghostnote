"""Test direct cost counts and refusal boundaries with inert bytecode."""
import unittest

from grid_symbols.scan import Class, Member, Refusal
from grid_symbols.test_resolve import FakeJar
from .constructor_bounds import direct_bounds
from .test_constructor_variants import pool
from .test_descriptor_resolution import ModelCode


def model(body, helpers=()):
    cp, typ, ref = pool()
    data = body(typ, ref)
    methods = [Member('method', '<init>', '()V', 1, bytes(data))]
    methods.extend(helpers)
    cls = Class('Root', 'java/lang/Object', (), 1, [], methods, cp)
    return FakeJar([cls]), cls


def run(jar):
    return direct_bounds(jar, ModelCode(), [('Root', '<init>', '()V')])


class ConstructorBoundsTests(unittest.TestCase):
    def test_repeated_calls_count_each_execution(self):
        jar, _ = model(lambda t, r: [184, 0, r(10, 'Root', 'help', '()V'),
                                    184, 0, r(10, 'Root', 'help', '()V'), 177],
                       [Member('method', 'help', '()V', 9, bytes([3, 87, 177]))])
        result = run(jar)
        self.assertEqual(result['roots'][0]['vendorInstructions'], 9)
        self.assertEqual(result['roots'][0]['vendorCalls'], 2)
        self.assertEqual(result['work']['instructions'], 6)
        self.assertFalse(result['boundedAdmission'])

    def test_forward_branch_sum_is_conservative(self):
        jar, _ = model(lambda t, r: [3, 153, 0, 7, 3, 167, 0, 4, 4, 87, 177])
        self.assertEqual(run(jar)['roots'][0]['vendorInstructions'], 7)

    def test_recursion_and_back_edges_refuse(self):
        jar, _ = model(lambda t, r: [42, 183, 0, r(10, 'Root', '<init>', '()V'), 177])
        with self.assertRaisesRegex(Refusal, 'recursion'):
            run(jar)
        jar, _ = model(lambda t, r: [167, 0, 0])
        with self.assertRaisesRegex(Refusal, 'back-edge'):
            run(jar)

    def test_allocations_and_external_calls_stay_separate(self):
        jar, _ = model(lambda t, r: [187, 0, t('java/lang/Object'), 89,
                                    183, 0, r(10, 'java/lang/Object', '<init>', '()V'), 87, 177])
        root = run(jar)['roots'][0]
        self.assertEqual(root['explicitObjects'], {'java/lang/Object': 1})
        self.assertEqual(root['externalCalls'], [
            {'method': ['java/lang/Object', '<init>', '()V'], 'count': 1}])

    def test_virtual_arrays_monitors_and_handlers_refuse(self):
        bodies = [lambda t, r: [42, 182, 0, r(10, 'Root', 'call', '()V'), 177],
                  lambda t, r: [3, 188, 10, 87, 177],
                  lambda t, r: [42, 194, 177]]
        for body in bodies:
            jar, _ = model(body)
            with self.assertRaises(Refusal):
                run(jar)
        for kind in ('handler', 'synchronized'):
            jar, cls = model(lambda t, r: [177])
            if kind == 'handler':
                cls.methods[0].handlers = ((0, 1, 0, 0),)
            else:
                cls.methods[0].flags |= 32
            with self.assertRaisesRegex(Refusal, 'method-shape'):
                run(jar)

    def test_call_kind_and_root_limit_refuse(self):
        jar, _ = model(lambda t, r: [184, 0, r(10, 'Root', '<init>', '()V'), 177])
        with self.assertRaisesRegex(Refusal, 'call-kind'):
            run(jar)
        with self.assertRaisesRegex(Refusal, 'root-limit'):
            direct_bounds(jar, ModelCode(), [('C' + str(i), '<init>', '()V') for i in range(129)])

    def test_dynamic_work_remains_an_open_site(self):
        jar, cls = model(lambda t, r: [177])
        cls.cp.extend([(1, 'get'), (1, '()Ljava/lang/Object;'), (12, (1, 2)), (18, (0, 3))])
        cls.methods[0].code = bytes([186, 0, 4, 0, 0, 87, 177])
        result = run(jar)
        self.assertEqual(result['roots'][0]['dynamicSites'], [
            {'method': ['Root', '<init>', '()V'], 'offset': 0, 'count': 1}])
        self.assertEqual(result['roots'][0]['explicitObjects'], {})
        self.assertFalse(result['boundedAdmission'])

    def test_explicit_assertion_condition_selects_only_its_branch(self):
        jar, cls = model(lambda t, r: [178, 0, r(9, 'Root', 'disabled', 'Z'),
                                      154, 0, 7, 42, 182, 0, r(10, 'Root', 'unknown', '()V'), 177])
        cls.fields.append(Member('field', 'disabled', 'Z', 4120))
        with self.assertRaisesRegex(Refusal, 'virtual-call'):
            run(jar)
        result = direct_bounds(jar, ModelCode(), [('Root', '<init>', '()V')],
                               [('Root', 'disabled', 'Z')])
        self.assertEqual(result['roots'][0]['vendorInstructions'], 3)


if __name__ == '__main__':
    unittest.main()
