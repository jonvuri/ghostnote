"""Check mode getter, writer values, lambda listener identity, and registration guards."""
import copy
from pathlib import Path
import unittest

from grid_symbols.scan import Class, Member, Refusal
from . import listener_mode as lm
from .test_constructor_variants import pool
from .test_owned_collectors import LightCode, LightJar, NEW, OLD, method, mutate


def mode_class(flags):
    cp, typ, ref = pool()
    field = ref(9, 'Mode', 'on', 'Z')
    getter = Member('method', 'enabled', '()Z', 9, bytes([178, 0, field, 172]))
    enable = Member('method', 'enable', '()V', 9, bytes([4, 179, 0, field, 177]))
    disable = Member('method', 'disable', '()V', 9, bytes([3, 179, 0, field, 177]))
    return Class('Mode', 'java/lang/Object', (), 1, [Member('field', 'on', 'Z', flags)],
                 [getter, enable, disable], cp)


class ModeGetterTest(unittest.TestCase):
    def test_volatile_private_static(self):
        cls = mode_class(0x4a)
        field, getter = lm.mode_getter(cls, cls.methods[0])
        self.assertEqual((field, getter['instructions']), (['Mode', 'on', 'Z'], 2))
        self.assertTrue(lm.constant_store(cls, cls.methods[1], 1))
        self.assertFalse(lm.constant_store(cls, cls.methods[2], 1))

    def test_refusals(self):
        with self.assertRaisesRegex(Refusal, 'mode-field-access'):
            cls = mode_class(0x0a)
            lm.mode_getter(cls, cls.methods[0])
        cls = mode_class(0x4a)
        with self.assertRaisesRegex(Refusal, 'mode-store-value'):
            lm.constant_store(cls, cls.methods[1], 0)


class InterfaceTest(unittest.TestCase):
    def test_closure(self):
        jar = type('J', (), {})()
        jar.classes = {'A': Class('A', 'java/lang/Object', ('B',), 0x601, [], []),
                       'B': Class('B', 'java/lang/Object', (), 0x601, [], []),
                       'C': Class('C', 'java/lang/Object', ('java/util/List',), 0x601, [], [])}
        self.assertEqual(lm.interface_closure(jar, 'A'), ['A', 'B'])
        with self.assertRaisesRegex(Refusal, 'external'):
            lm.interface_closure(jar, 'C')


class RealListeners:
    path = holder = register = blocks = None

    def setUp(self):
        self.jar, self.code = LightJar(self.path), LightCode()
        import zipfile
        from grid_symbols.scan import parse
        meta = {}
        source = zipfile.ZipFile(self.path)
        for name in ('rqm', 'foz', 'Npn', 'Eo'):
            if name + '.class' in source.namelist():
                meta[name] = parse(source.read(name + '.class'))
        self.jar.classes = meta | {n: None for n in self.jar.classes if n not in meta}
        self.cls = self.code.get(self.jar, self.holder)

    def test_lambda_and_guard(self):
        for flag, field in self.blocks:
            listener = lm.lambda_listener(self.jar, self.cls, field)
            self.assertEqual(listener['equality'], 'identity')
            self.assertNotIn('java/util/List', listener['interfaces'])
            guard = lm.guarded_registration(self.cls, method(self.cls, self.register, '()V'), flag, field)
            self.assertEqual(guard['registrationsPerFlagCycle'], 1)

    def test_mutations(self):
        changed = copy.deepcopy(self.cls)
        target = [f for f in changed.fields if f.name == self.blocks[0][1]][0]
        target.flags &= ~0x10
        with self.assertRaisesRegex(Refusal, 'listener-field-final'):
            lm.lambda_listener(self.jar, changed, self.blocks[0][1])
        member = method(self.cls, self.register, '()V')
        from grid_symbols.scan import instructions
        rows = instructions(member.code)
        flag = self.blocks[0][0]
        sets = [r for r in rows if r[1] == 181 and lm.ref(self.cls, r)['name'] == flag]
        before = rows[rows.index(sets[0]) - 1][0]
        cls, changed_member = mutate(self.cls, member, before, 3)
        with self.assertRaisesRegex(Refusal, 'registration'):
            lm.guarded_registration(cls, changed_member, flag, self.blocks[0][1])


@unittest.skipUnless(NEW.exists(), 'the 6.1.4 jar is not present')
class NewListeners(RealListeners, unittest.TestCase):
    path, holder, register, blocks = NEW, 'Hgx', 'BAa', [('Scv', 'jFL'), ('jhH', 'hDc')]


@unittest.skipUnless(OLD.exists(), 'the 6.0.6 jar is not present')
class OldListeners(RealListeners, unittest.TestCase):
    path, holder, register, blocks = OLD, 'tqm', 'Wrf', [('dRD', 'neE'), ('dwY', 'nwQ')]


if __name__ == '__main__':
    unittest.main()
