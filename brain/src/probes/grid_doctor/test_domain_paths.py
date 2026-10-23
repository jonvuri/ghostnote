"""Test conditional domain bounds on inert class data."""
from types import SimpleNamespace
import unittest
from unittest.mock import patch
from grid_symbols.scan import Class, Member, Refusal
from grid_symbols.test_resolve import FakeJar
from .domain_paths import domain_reads
from .test_descriptor_resolution import ModelCode


def run(body, extra=(), cp=None):
    cls = Class('Domain', 'java/lang/Object', (), 1, [],
                [Member('method', 'extent', '()D', 1, bytes(body)), *extra], cp or [None])
    jar = FakeJar([cls]); jar.sha256 = 'model'
    jar.zip = SimpleNamespace(read=lambda _: b'')
    catalog = {'rows': [{'count': 1, 'matches': [{'runtimeClass': 'Domain'}]}]}
    symbols = {'members': [{'role': 'domain-extent', 'reference': ['method', 'Domain', 'extent', '()D']}]}
    with patch('grid_doctor.domain_paths.requirements', return_value={'fields': []}), \
         patch('grid_doctor.domain_paths.bootstraps', return_value=[]), \
         patch('grid_doctor.domain_paths.method_trace', return_value={}):
        return domain_reads(jar, catalog, symbols, ModelCode())


class DomainPathTests(unittest.TestCase):
    def test_constant_bound_has_no_runtime_authority(self):
        result = run([14, 175])
        self.assertEqual(result['receivers'][0]['instructionBound'], 2)
        self.assertFalse(result['boundedAdmission'])
        self.assertFalse(result['receivers'][0]['runtimeObserved'])

    def test_loop_allocation_and_receiver_store_refuse(self):
        for body, reason in [([167, 0, 0], 'back-edge'),
                             ([187, 0, 1, 175], 'unsupported-opcode'),
                             ([3, 59, 14, 175], 'receiver-store')]:
            with self.subTest(body=body), self.assertRaisesRegex(Refusal, reason):
                run(body)

    def test_self_call_cycle_refuses(self):
        cp = [None, (1, 'Domain'), (7, 1), (1, 'extent'), (1, '()D'),
              (12, (3, 4)), (10, (2, 5))]
        with self.assertRaisesRegex(Refusal, 'recursion'):
            run([42, 182, 0, 6, 175], cp=cp)

    def test_nested_numeric_call_has_accumulated_bound(self):
        cp = [None, (1, 'Domain'), (7, 1), (1, 'value'), (1, '()D'),
              (12, (3, 4)), (10, (2, 5))]
        result = run([42, 182, 0, 6, 175],
                     [Member('method', 'value', '()D', 1, bytes([15, 175]))], cp)
        row = result['receivers'][0]
        self.assertEqual((row['instructionBound'], row['callBound'], row['depthBound']), (5, 1, 2))


if __name__ == '__main__':
    unittest.main()
