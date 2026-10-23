"""Check owned collector forms, storage values, serialized graphs, and JDK bounds."""
import copy
from pathlib import Path
import unittest
import zipfile

from grid_symbols.scan import Class, Member, Refusal, parse
from . import owned_collectors as oc
from .test_constructor_variants import pool

OLD = Path('/Users/jonvuri/Bitwig Upgrade Backups/2026-10-21-pre-6.1/apps/Bitwig Studio 6.0.6.app/Contents/Java/bitwig.jar')
NEW = Path('/Applications/Bitwig Studio.app/Contents/Java/bitwig.jar')
JDK = [Path('/tmp/gn-9b6g-runtime-new-arm64-9/java.base'),
       Path('/tmp/gn-9b6g-collection-conditions-runtime-new-1/java.base'),
       Path('/tmp/gn-9b6g-collection-conditions-runtime-new-3/java.base')]
NAMES = {OLD: ('com/bitwig/ramona/core/HEV', 'dpx', 'cYz', 'cYy', 'cYD', 'ffA', 'HEV'),
         NEW: ('com/bitwig/ramona/core/oDc', 'tB1', 'deU', 'deT', 'deX', 'cfM', 'oDc')}


class LightJar:
    """Read single classes from a jar. Never load them."""
    def __init__(self, path):
        self.zip = zipfile.ZipFile(path)
        self.classes = {n[:-6] for n in self.zip.namelist() if n.endswith('.class')}

    def check(self):
        pass


class LightCode:
    def __init__(self):
        self.cache = {}

    def get(self, jar, name):
        if name not in self.cache:
            self.cache[name] = parse(jar.zip.read(name + '.class'), True)
        return self.cache[name]


def method(cls, name, desc):
    return [m for m in cls.methods if (m.name, m.desc) == (name, desc)][0]


def mutate(cls, member, offset, value):
    """Return a copy of one class with one code byte changed."""
    changed = copy.deepcopy(cls)
    target = method(changed, member.name, member.desc)
    code = bytearray(target.code)
    code[offset] = value
    target.code = bytes(code)
    return changed, target


class StoredValueTest(unittest.TestCase):
    def rows_class(self, body):
        cp, typ, ref = pool()
        array = typ('java/util/ArrayList')
        init = ref(10, 'java/util/ArrayList', '<init>', '(I)V')
        field = ref(9, 'Owner', 'items', 'Ljava/util/List;')
        code = bytes(body(array, init, field))
        return Class('Owner', 'java/lang/Object', (), 1, [], [Member('method', 'm', '()V', 1, code)], cp)

    def test_null_fresh_and_unclassified(self):
        from grid_symbols.scan import instructions
        cls = self.rows_class(lambda a, i, f: [42, 1, 181, 0, f, 42, 187, 0, a, 89, 5, 183, 0, i,
                                               181, 0, f, 42, 43, 181, 0, f, 177])
        rows = instructions(cls.methods[0].code)
        stores = [k for k, r in enumerate(rows) if r[1] == 181]
        values = [oc.stored_value(cls, rows, k) for k in stores]
        self.assertEqual(values[0], {'kind': 'null'})
        self.assertEqual(values[1], {'kind': 'fresh', 'class': 'java/util/ArrayList', 'constructor': '(I)V'})
        self.assertEqual(values[2], {'kind': 'unclassified'})

    def test_storage_kinds_refuse_unclassified(self):
        report = {'sites': [{'opcode': 181, 'class': 'A', 'method': ['m', '()V'], 'offset': 1,
                             'stored': {'kind': 'unclassified'}}], 'methodHandles': []}
        with self.assertRaises(Refusal):
            oc.storage_kinds(report, 'java/util/ArrayList')
        variant = {('A', 'm', '()V', 1): {'kind': 'fresh', 'class': 'java/util/ArrayList'}}
        self.assertEqual(oc.storage_kinds(report, 'java/util/ArrayList', variant)[0], ['java/util/ArrayList'])
        report['methodHandles'] = [{'class': 'B'}]
        with self.assertRaises(Refusal):
            oc.storage_kinds(report, 'java/util/ArrayList', variant)


class SerializedTest(unittest.TestCase):
    def tree(self):
        return {'classId': 1, 'properties': [{'id': 10, 'value': [
            {'classId': 2, 'properties': [{'id': 20, 'value': {'classId': 3, 'properties': []}}]},
            {'classId': 2, 'properties': [{'id': 21, 'value': {'reference': 3}}]}]}]}

    def test_single_managed_tree(self):
        kinds = {(1, 10): 'STRONG', (2, 20): 'STRONG', (2, 21): 'WEAK'}
        result = oc.serialized_single_managed(self.tree(), kinds, {1: True, 2: False, 3: False})
        self.assertEqual((result['nodes'], result['managedNodes'], result['rootOnlyManagedR']), (4, [1], 3))
        self.assertTrue(result['singleManaged'])

    def test_refusals(self):
        managed = {1: True, 2: False, 3: False}
        with self.assertRaisesRegex(Refusal, 'second-strong-parent'):
            oc.serialized_single_managed(self.tree(), {(1, 10): 'STRONG', (2, 20): 'STRONG', (2, 21): 'STRONG'}, managed)
        with self.assertRaisesRegex(Refusal, 'kind-missing'):
            oc.serialized_single_managed(self.tree(), {(1, 10): 'STRONG'}, managed)
        with self.assertRaisesRegex(Refusal, 'managed-unknown'):
            oc.serialized_single_managed(self.tree(), {(1, 10): 'STRONG', (2, 20): 'STRONG', (2, 21): 'WEAK'}, {1: True})
        two = oc.serialized_single_managed(self.tree(), {(1, 10): 'STRONG', (2, 20): 'STRONG', (2, 21): 'WEAK'},
                                           {1: True, 2: True, 3: False})
        self.assertFalse(two['singleManaged'])
        self.assertIsNone(two['rootOnlyManagedR'])


class FormulaTest(unittest.TestCase):
    def test_coefficients(self):
        jdk = {k: {'instructions': {'1': v}, 'calls': 1, 'allocations': 1, 'natives': {}}
               for k, v in [('outputFrame', 16), ('propertyArray', 44), ('emptyPropertyArray', 6),
                            ('propertyHasNext', 10), ('propertyNext', 22), ('singleAdd', 142),
                            ('listView', 263), ('emptyList', 155)]}
        jdk['mapValues'] = {'instructions': {'1': 245, 'm': 39}, 'calls': 1, 'allocations': 1, 'natives': {}}
        collector = {'ownInstructions': {'constant': 18, 'perProperty': 17}, 'vendorCalls': {'constant': 2}}
        inv = {'runtime': 'R', 'className': 'c', 'single': 1, 'list': 1, 'map': 1,
               'strong': [{'vendorInstructions': 52, 'vendorCalls': 7}] * 3}
        f = oc.collector_formula(inv, jdk, {'ownInstructions': 5, 'vendorCalls': 2}, collector, 'emptyList')
        self.assertEqual(f['vendorInstructions'], 18 + 17 * 3 + 5 + 7 + 3 * 52)
        self.assertEqual(f['jdkInstructions'], {'constant': 16 + 44 + 10 * 4 + 22 * 3 + 142 + 263 + 245, 'perChild': 39})
        self.assertEqual(f['vendorCalls'], 2 + 2 + 21)


class JdkBodyTest(unittest.TestCase):
    def test_back_edge_refused(self):
        cp, typ, ref = pool()
        loop = Member('method', 'spin', '()V', 9, bytes([167, 0, 0]))
        cls = Class('java/util/Spin', 'java/lang/Object', (), 1, [], [loop], cp)
        reader = type('R', (), {'get': lambda self, name: cls})()
        with self.assertRaisesRegex(Refusal, 'back-edge'):
            oc.jdk_body(reader, ('java/util/Spin', 'spin', '()V'))
        self.assertEqual(len(oc.jdk_body(reader, ('java/util/Spin', 'spin', '()V'), 'n')[1]), 1)

    @unittest.skipUnless(all(p.exists() for p in JDK), 'extracted JDK class data is absent')
    def test_bundled_bounds(self):
        bounds = oc.jdk_bounds(oc.JdkReader(JDK))
        self.assertEqual(bounds['outputFrame']['instructions'], {'1': 16})
        self.assertEqual(bounds['callerNext']['instructions'], {'1': 49})
        self.assertEqual(bounds['mapValues']['instructions'], {'1': 245, 'm': 39})
        self.assertEqual(bounds['listView']['natives'], {'getClass': 4, 'arraycopy': 3})


class RealBodies:
    path = None

    def setUp(self):
        self.jar, self.code = LightJar(self.path), LightCode()
        self.names = NAMES[self.path]
        self.base = self.code.get(self.jar, self.names[0])
        self.collector = method(self.base, self.names[1], oc.KEY)

    def test_collector(self):
        result = oc.collector_contract(self.base, self.collector)
        self.assertEqual(result['ownInstructions'], {'constant': 18, 'perProperty': 17})
        self.assertEqual(result['output'], 'java/util/ArrayList')
        self.assertEqual(result['relationshipSlot'][1], self.names[5])

    def test_collector_mutations(self):
        rows = __import__('grid_symbols.scan', fromlist=['instructions']).instructions(self.collector.code)
        key = [r for r in rows if r[1] == 43][-1][0]
        cls, changed = mutate(self.base, self.collector, key, 1)
        with self.assertRaises(Refusal):
            oc.collector_contract(cls, changed)
        loop = [r for r in rows if r[1] == 167][-1][0]
        cls, changed = mutate(self.base, self.collector, loop + 2, (self.collector.code[loop + 2] - 2) & 255)
        with self.assertRaises(Refusal):
            oc.collector_contract(cls, changed)

    def test_relationship_forms_and_mutation(self):
        desc = '(L' + self.names[0] + ';Ljava/util/List;Ljava/lang/String;)V'
        for owner, form in zip(self.names[2:5], ('single', 'list', 'map')):
            cls = self.code.get(self.jar, owner)
            self.assertEqual(oc.relationship_form(cls, method(cls, self.names[5], desc))['form'], form)
        cls = self.code.get(self.jar, self.names[3])
        member = method(cls, self.names[5], desc)
        changed_cls, changed = mutate(cls, member, len(member.code) - 2, 88)
        with self.assertRaises(Refusal):
            oc.relationship_form(changed_cls, changed)

    def test_property_list_and_strong_filter(self):
        result = oc.collector_contract(self.base, self.collector)
        dcls, plist = oc.property_list_contract(self.jar, self.code, result['descriptorGetter'][2][3:-1],
                                                result['propertyList'], result['relationship'])
        field = dict(zip(('owner', 'name', 'descriptor'), plist['arrayField']), tag=9)
        strong = oc.strong_filter(self.jar, self.code, dcls, field, result['relationship'])
        self.assertEqual(strong['enumNames'][strong['strongField']], 'STRONG')
        other = [k for k, v in strong['enumNames'].items() if v == 'WEAK'][0]
        index = [i for i, item in enumerate(dcls.cp) if item and item[0] == 9
                 and oc.constant(dcls, i).get('name') == strong['strongField']
                 and oc.constant(dcls, i).get('owner') == strong['kindEnum']][0]
        changed = copy.deepcopy(dcls)
        name_and_type = changed.cp[changed.cp[index][1][1]]
        changed.cp.append((1, other))
        changed.cp[changed.cp[index][1][1]] = (12, (len(changed.cp) - 1, name_and_type[1][1]))
        with self.assertRaisesRegex(Refusal, 'not-strong'):
            oc.strong_filter(self.jar, self.code, changed, field, result['relationship'])


@unittest.skipUnless(NEW.exists(), 'the 6.1.4 jar is not present')
class NewBodies(RealBodies, unittest.TestCase):
    path = NEW

    def test_list_getter_and_descriptor(self):
        cls = self.code.get(self.jar, 'com/bitwig/flt/document/core/master/device/i2s')
        member = method(cls, 'SQN', '()Ljava/util/List;')
        self.assertEqual(oc.list_getter_form(cls, member)['field'][1:],
                         ['ejd', 'Ljava/util/List;'])
        changed_cls, changed = mutate(cls, member, len(member.code) - 1, 177)
        with self.assertRaises(Refusal):
            oc.list_getter_form(changed_cls, changed)
        single = oc.descriptor_singleton(self.jar, self.code, 'com/bitwig/flt/document/core/master/device/hpW',
                                         ('com/bitwig/ramona/core/oDc', 'ng_', '()LdeS;'))
        self.assertEqual((single['descriptor'], single['ownInstructions'], single['vendorCalls']),
                         ('com/bitwig/flt/document/core/master/device/fNT', 5, 2))


@unittest.skipUnless(OLD.exists(), 'the 6.0.6 jar is not present')
class OldBodies(RealBodies, unittest.TestCase):
    path = OLD


if __name__ == '__main__':
    unittest.main()


RENAMED = [(Path('/tmp/gn-9b6g-old-renamed-extra.jar'), Path('/tmp/gn-9b6g-old-renamed-map.json'), OLD),
           (Path('/tmp/gn-9b6g-renamed-extra.jar'), Path('/tmp/gn-9b6g-renamed-map.json'), NEW)]


@unittest.skipUnless(all(j.exists() and m.exists() for j, m, _ in RENAMED), 'renamed fixtures are absent')
class RenamedBodies(unittest.TestCase):
    def test_collector_and_forms(self):
        import json
        from .renamed_fixture import rename_member
        for path, mapping, source in RENAMED:
            names = json.loads(mapping.read_text())
            jar, code = LightJar(path), LightCode()
            owner, collector = names[NAMES[source][0]], rename_member(NAMES[source][1])
            base = code.get(jar, owner)
            result = oc.collector_contract(base, method(base, collector, oc.KEY))
            self.assertEqual(result['ownInstructions'], {'constant': 18, 'perProperty': 17})
            desc = '(L' + owner + ';Ljava/util/List;Ljava/lang/String;)V'
            slot = rename_member(NAMES[source][5])
            forms = [oc.relationship_form(code.get(jar, names[n]), method(code.get(jar, names[n]), slot, desc))['form']
                     for n in NAMES[source][2:5]]
            self.assertEqual(forms, ['single', 'list', 'map'])
