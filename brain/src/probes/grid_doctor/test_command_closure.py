"""Test the exact-dispatch command core on inert class models."""
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from grid_symbols.scan import Class, Member, Refusal
from grid_symbols.test_resolve import FakeJar
from .command_closure import ClosureLimits, Index, closure, exact_field, fingerprint, value_source


class Pool:
    def __init__(self):
        self.cp, self.seen = [None], {}

    def add(self, entry):
        if entry not in self.seen:
            self.seen[entry] = len(self.cp)
            self.cp.append(entry)
        return self.seen[entry]

    def utf(self, text):
        return self.add((1, text))

    def cls(self, name):
        return self.add((7, self.utf(name)))

    def nat(self, name, desc):
        return self.add((12, (self.utf(name), self.utf(desc))))

    def method(self, owner, name, desc, interface=False):
        return self.add((11 if interface else 10, (self.cls(owner), self.nat(name, desc))))

    def field(self, owner, name, desc):
        return self.add((9, (self.cls(owner), self.nat(name, desc))))


def u2(value):
    return [value >> 8, value & 255]


def build(names=None):
    """A root reads a field that its constructor fills with B. C also implements I."""
    n = names or {}
    A, B, C, I = (n.get(x, x) for x in 'ABCI')
    pa, pb, pc, pi = Pool(), Pool(), Pool(), Pool()
    f = pa.field(A, 'f', f'L{I};')
    m = pa.method(I, 'm', '()V', True)
    ctor_b = pa.method(B, '<init>', '()V')
    obj = pa.method('java/lang/Object', '<init>', '()V')
    size = pa.method('java/util/List', 'size', '()I', True)
    pfield = pa.field(A, 'p', f'L{I};')
    # <init>: aload_0 invokespecial Object.<init>; aload_0 new B dup invokespecial B.<init> putfield f; return
    init = bytes([42, 183, *u2(obj), 42, 187, *u2(pa.cls(B)), 89, 183, *u2(ctor_b), 181, *u2(f), 177])
    # run: aload_0 getfield f invokeinterface I.m 1 0; return
    run = bytes([42, 180, *u2(f), 185, *u2(m), 1, 0, 177])
    # open: aload_0 getfield p invokeinterface I.m; aload_1 invokeinterface List.size pop; return
    open_ = bytes([42, 180, *u2(pfield), 185, *u2(m), 1, 0, 43, 185, *u2(size), 1, 0, 87, 177])
    # set(p): aload_0 aload_1 putfield p; return
    setp = bytes([42, 43, 181, *u2(pfield), 177])
    a = Class(A, 'java/lang/Object', (), 1, [Member('field', 'f', f'L{I};', 2), Member('field', 'p', f'L{I};', 2)],
              [Member('method', '<init>', '()V', 1, init), Member('method', 'run', '()V', 1, run),
               Member('method', 'open', '(Ljava/util/List;)V', 1, open_),
               Member('method', 'set', f'(L{I};)V', 1, setp)], pa.cp)
    sink = pb.method('S', 'sink', '()V')
    b = Class(B, 'java/lang/Object', (I,), 1, [], [
        Member('method', '<init>', '()V', 1, bytes([177])),
        Member('method', 'm', '()V', 1, bytes([184, *u2(sink), 177]))], pb.cp)
    c = Class(C, 'java/lang/Object', (I,), 1, [], [Member('method', 'm', '()V', 1, bytes([177]))], pc.cp)
    i = Class(I, 'java/lang/Object', (), 0x601, [], [Member('method', 'm', '()V', 0x401, b'')], pi.cp)
    s = Class('S', 'java/lang/Object', (), 1, [], [Member('method', 'sink', '()V', 9, bytes([177]))], [None])
    return [a, b, c, i, s]


def index(classes, limits=None):
    jar = FakeJar(classes)
    jar.zip = SimpleNamespace(read=lambda path: path[:-6].encode())
    lookup = {c.name: c for c in classes}
    p1 = patch('grid_doctor.command_closure.parse', lambda data, code=False: lookup[data.decode()])
    p2 = patch('grid_doctor.command_closure.bootstraps', return_value=[])
    p1.start()
    p2.start()
    return Index(jar, limits), (p1, p2)


class CommandClosureTests(unittest.TestCase):
    def setUp(self):
        self.patches = []

    def tearDown(self):
        for p in self.patches:
            p.stop()

    def make(self, classes=None, limits=None):
        ix, patches = index(classes or build(), limits)
        self.patches += patches
        return ix

    def test_value_source_follows_allocation_and_field(self):
        ix = self.make()
        a = ix.code('A')
        init = ix.method('A', '<init>', '()V')
        kind, row = value_source(a, init, 12, 0)
        self.assertEqual((kind, row[1]), ('op', 187))
        run = ix.method('A', 'run', '()V')
        kind, row = value_source(a, run, 4, 0)
        self.assertEqual((kind, row[1]), ('op', 180))

    def test_exact_field_requires_allocation_writers(self):
        ix = self.make()
        self.assertEqual(exact_field(ix, 'A', 'f')[0], frozenset({'B'}))
        found, why = exact_field(ix, 'A', 'p')
        self.assertIsNone(found)
        self.assertIn('writer-parameter', why)

    def test_exact_receiver_enters_core_and_reaches_sink(self):
        ix = self.make()
        r = closure(ix, [('A', 'run', '()V', 'A')], [('S', 'sink', '()V')])
        core = {tuple(x[:3]) for x in r['core']}
        self.assertIn(('B', 'm', '()V'), core)
        self.assertNotIn(('C', 'm', '()V'), core)
        self.assertEqual(r['sinkHits'][0]['sink'], ['S', 'sink', '()V'])
        self.assertEqual([e['offset'] for e in r['sinkHits'][0]['chain']], [4, 0])
        self.assertEqual(r['frontierSites'], 0)

    def test_open_receiver_stays_in_frontier_and_external_is_recorded(self):
        ix = self.make()
        r = closure(ix, [('A', 'open', '(Ljava/util/List;)V', 'A')], [('S', 'sink', '()V')])
        self.assertEqual(r['sinkHits'], [])
        self.assertEqual(r['openReceiverSites'], 1)
        self.assertEqual(r['frontier'][0][0][:4], ['receiver-open', 'I', 'm', '()V'])
        self.assertEqual(r['externalCalls'][0][0], ['java/util/List', 'size', '()I'])

    def test_pin_is_explicit_condition(self):
        ix = self.make()
        r = closure(ix, [('A', 'open', '(Ljava/util/List;)V', 'A')], [('S', 'sink', '()V')], pins={('A', 'p'): {'B'}})
        self.assertEqual(len(r['sinkHits']), 1)
        self.assertEqual(r['pins'], [[['A', 'p'], ['B']]])
        self.assertIn('pinned-field', r['sinkHits'][0]['chain'][0]['receiver'])

    def test_renamed_model_keeps_structure(self):
        names = {'A': 'R1', 'B': 'R2', 'C': 'R3', 'I': 'R4'}
        ix = self.make(build(names))
        r = closure(ix, [('R1', 'run', '()V', 'R1')], [('S', 'sink', '()V')])
        self.assertEqual(r['coreMethods'], 3)
        self.assertEqual(len(r['sinkHits']), 1)
        self.assertEqual(fingerprint(ix.method('R1', 'run', '()V')), fingerprint(build()[0].methods[1]))

    def test_unrelated_implementor_does_not_change_exact_core(self):
        classes = build()
        extra = Class('D', 'java/lang/Object', ('I',), 1, [], [Member('method', 'm', '()V', 1, bytes([177]))], [None])
        ix = self.make(classes + [extra])
        r = closure(ix, [('A', 'run', '()V', 'A')], [])
        self.assertEqual(r['coreMethods'], 3)

    def test_edge_and_node_limits_refuse(self):
        ix = self.make(limits=ClosureLimits(edges=1))
        with self.assertRaisesRegex(Refusal, 'closure-edge-limit'):
            closure(ix, [('A', 'run', '()V', 'A')], [])

    def test_default_method_uses_most_specific_interface(self):
        pi, pj = Pool(), Pool()
        i = Class('I', 'java/lang/Object', (), 0x601, [], [Member('method', 'd', '()V', 1, bytes([177]))], pi.cp)
        j = Class('J', 'java/lang/Object', ('I',), 0x601, [], [Member('method', 'd', '()V', 1, bytes([177]))], pj.cp)
        k = Class('K', 'java/lang/Object', ('J', 'I'), 1, [], [], [None])
        ix = self.make([i, j, k])
        self.assertEqual(ix.dispatch('K', 'd', '()V'), 'J')


if __name__ == '__main__':
    unittest.main()
