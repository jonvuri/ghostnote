"""Test possible call paths and exact receiver exclusions on inert classes."""
from types import SimpleNamespace
import unittest
from unittest.mock import patch
from grid_symbols.scan import Class, Member, Refusal
from grid_symbols.test_resolve import FakeJar
from .call_paths import paths
from .test_descriptor_resolution import ModelCode


def cls(name, parent='java/lang/Object', call=None):
    cp = [None]
    if call:
        owner, method = call
        cp += [(1, owner), (7, 1), (1, method), (1, '()V'), (12, (3, 4)), (10, (2, 5))]
    return Class(name, parent, (), 1, [], [], cp)


def run(classes, roots, sinks, hypotheses=None):
    jar = FakeJar(classes)
    jar.sha256 = 'model'
    jar.zip = SimpleNamespace(read=lambda path: path[:-6].encode())
    with patch('grid_doctor.call_paths.parse', lambda data, code: jar.classes[data.decode()]), \
         patch('grid_doctor.call_paths.bootstraps', return_value=[]), \
         patch('grid_doctor.call_paths.method_trace', lambda j, c, m, b: {'owner': c.name, 'name': m.name}):
        return paths(jar, roots, sinks, ModelCode(), hypotheses)


class CallPathsTests(unittest.TestCase):
    def test_direct_path_retains_no_admission(self):
        a, b = cls('A', call=('B', 'sink')), cls('B')
        a.methods = [Member('method', 'root', '()V', 9, bytes([184, 0, 6, 177]))]
        b.methods = [Member('method', 'sink', '()V', 9, bytes([177]))]
        result = run([a, b], [('A', 'root', '()V')], [('B', 'sink', '()V')])
        self.assertEqual(result['work']['methods'], 2)
        self.assertEqual(result['work']['instructions'], 3)
        self.assertEqual(result['work']['indexedSites'], 1)
        self.assertEqual(result['results'][0]['rootPaths'][0]['edges'][0]['kind'], 'symbolic-direct')
        self.assertFalse(result['boundedAdmission'])
        self.assertEqual(result['results'][0]['cutoff'], 'first-root-witness')

    def test_virtual_path_requires_receiver(self):
        a, b, c = cls('A', call=('A', 'v')), cls('B', 'A', ('C', 'sink')), cls('C')
        a.methods = [Member('method', 'root', '()V', 1, bytes([42, 182, 0, 6, 177])),
                     Member('method', 'v', '()V', 1, bytes([177]))]
        b.methods = [Member('method', 'v', '()V', 1, bytes([184, 0, 6, 177]))]
        c.methods = [Member('method', 'sink', '()V', 9, bytes([177]))]
        roots, sinks = [('A', 'root', '()V')], [('C', 'sink', '()V')]
        possible = run([a, b, c], roots, sinks)
        self.assertEqual(len(possible['results'][0]['rootPaths']), 1)
        excluded = run([a, b, c], roots, sinks, {roots[0]: ['A']})
        self.assertTrue(excluded['results'][0]['searchComplete'])
        self.assertEqual(excluded['results'][0]['rootPaths'], [])
        admitted_type = run([a, b, c], roots, sinks, {roots[0]: ['B']})
        self.assertEqual(len(admitted_type['results'][0]['rootPaths']), 1)

    def test_duplicate_and_missing_sink_refuse(self):
        a = cls('A')
        a.methods = [Member('method', 'root', '()V', 1, bytes([177]))]
        with self.assertRaisesRegex(Refusal, 'missing-sink'):
            run([a], [], [('A', 'missing', '()V')])
        a.methods.append(a.methods[0])
        with self.assertRaisesRegex(Refusal, 'duplicate-method'):
            run([a], [], [])

    def test_external_edge_stays_unresolved(self):
        a = cls('A', call=('Outside', 'call'))
        a.methods = [Member('method', 'root', '()V', 9, bytes([184, 0, 6, 177]))]
        result = run([a], [], [])
        self.assertEqual(result['unresolvedIndexEdges']['external'], 1)
        self.assertEqual(result['work']['indexedSites'], 0)


if __name__ == '__main__':
    unittest.main()
