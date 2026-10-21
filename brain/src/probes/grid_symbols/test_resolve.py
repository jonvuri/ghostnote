"""Failure tests use inert metadata. The optional jar test never runs vendor code."""
import json
import os
from pathlib import Path
import tempfile
import unittest
import zipfile

from .scan import (Class, Member, Jar, Limits, Refusal, structural_keys,
                   member_traces, descriptor, ancestors, parse, instructions, CallTraces)
from .resolve import resolve, validate
from .oracle import manifest_rows, pinned, expand, TYPE_NAMES, EXTRA


class FakeJar:
    def __init__(self, classes):
        self.classes = {c.name:c for c in classes}
        self.keys = structural_keys(self.classes)
        self.timings, self.stats, self.code_cache = {}, {}, {}
        self.limits = Limits()

    def check(self):
        pass

    def code(self, name):
        self.code_cache[name] = self.classes[name]
        return self.classes[name]


def fixture():
    base = Class('Base','java/lang/Object',(),1,[],[
        Member('method','first','()I',1,bytes([4,172])),
        Member('method','second','()I',1,bytes([5,172]))])
    child = Class('Child','Base',(),17,[],[])
    other = Class('Other','java/lang/Object',(),1,[Member('field','flag','Z',2)],[])
    jar = FakeJar([base,child,other])
    traces = member_traces(base,jar.keys)[0]
    rules = {'types':{role:{'shape':jar.keys[name]} for role,name in
                      [('base','Base'),('child','Child'),('other','Other')]},
             'members':[{'role':'read','lookupType':'child','declaringType':'base',
                         'kind':'method','flags':1,'shape':'()I','signature':'()I',
                         'trace':traces[('first','()I')]}],
             'assignable':[['child','base']], 'distinct':[['base','other']]}
    return jar,rules


class ResolverTests(unittest.TestCase):
    def test_inherited_candidate(self):
        jar,rules = fixture()
        types,rows = resolve(jar,rules)
        self.assertEqual(rows[0]['lookup'],'Child')
        self.assertEqual(rows[0]['declaring'],'Base')
        self.assertEqual(rows[0]['name'],'first')
        self.assertFalse(validate(jar,rules,types,rows)['writeAuthority'])

    def test_missing_type(self):
        jar,rules = fixture()
        del jar.keys['Base']
        with self.assertRaisesRegex(Refusal,'found-0'):
            resolve(jar,rules)

    def test_ambiguous_type(self):
        jar,rules = fixture()
        jar.keys['Duplicate'] = jar.keys['Base']
        with self.assertRaisesRegex(Refusal,'found-2'):
            resolve(jar,rules)

    def test_missing_member_trace(self):
        jar,rules = fixture()
        jar.classes['Base'].methods[0].code = bytes([6,172])
        with self.assertRaisesRegex(Refusal,'read:.*found-0'):
            resolve(jar,rules)

    def test_ambiguous_member_trace(self):
        jar,rules = fixture()
        jar.classes['Base'].methods[1].code = bytes([4,172])
        with self.assertRaisesRegex(Refusal,'read:.*found-2'):
            resolve(jar,rules)

    def test_wrong_receiver(self):
        jar,rules = fixture()
        types,rows = resolve(jar,rules)
        rows[0]['lookup'] = 'Other'
        with self.assertRaisesRegex(Refusal,'wrong-receiver'):
            validate(jar,rules,types,rows)

    def test_receiver_must_inherit_declaration(self):
        jar,rules = fixture()
        rules['members'][0]['lookupType'] = 'other'
        types,rows = resolve(jar,rules)
        with self.assertRaisesRegex(Refusal,'receiver-inheritance'):
            validate(jar,rules,types,rows)

    def test_fabricated_member_is_rejected_by_validation(self):
        jar,rules = fixture()
        types,rows = resolve(jar,rules)
        rows[0]['name'] = 'absent'
        with self.assertRaisesRegex(Refusal,'declaration:read'):
            validate(jar,rules,types,rows)

    def test_wrong_return_type(self):
        jar,rules = fixture()
        types,rows = resolve(jar,rules)
        rows[0]['descriptor'] = '()Z'
        with self.assertRaisesRegex(Refusal,'signature|declaration'):
            validate(jar,rules,types,rows)

    def test_static_does_not_match_instance(self):
        jar,rules = fixture()
        jar.classes['Base'].methods[0].flags |= 8
        with self.assertRaisesRegex(Refusal,'found-0'):
            resolve(jar,rules)

    def test_all_zero_fields_are_ambiguous(self):
        c = Class('Counters','java/lang/Object',(),1,
                  [Member('field',n,'I',2) for n in ('one','two','three')],[])
        keys = structural_keys({'Counters':c})
        traces = member_traces(c,keys)[1]
        self.assertEqual(len(set(traces.values())),1)

    def test_type_names_and_member_order_are_not_selectors(self):
        jar,rules = fixture()
        jar.classes['Base'].methods.reverse()
        for m in jar.classes['Base'].methods:
            m.name = 'renamed_' + m.name
        base = jar.classes.pop('Base')
        base.name = 'Renamed'
        jar.classes[base.name] = base
        jar.classes['Child'].parent = base.name
        jar.keys = structural_keys(jar.classes)
        types,rows = resolve(jar,rules)
        self.assertEqual(rows[0]['name'],'renamed_first')
        self.assertEqual(rows[0]['declaring'],'Renamed')
        validate(jar,rules,types,rows)

    def test_inheritance_bound(self):
        jar,_ = fixture()
        with self.assertRaisesRegex(Refusal,'inheritance-depth'):
            list(ancestors(jar.classes,'Child',0))

    def test_inheritance_cycle(self):
        jar,_ = fixture()
        jar.classes['Base'].parent = 'Child'
        with self.assertRaisesRegex(Refusal,'inheritance-cycle'):
            list(ancestors(jar.classes,'Child'))

    def test_abstract_dispatch_requires_runtime_type(self):
        cp = [None,(1,'Base'),(7,1),(1,'one'),(1,'()I'),(12,(3,4)),
              (10,(2,5)),(1,'two'),(12,(7,4)),(10,(2,8))]
        base = Class('Base','java/lang/Object',(),1025,[],[
            Member('method','first','()I',1,bytes([42,182,0,6,172])),
            Member('method','second','()I',1,bytes([42,182,0,9,172])),
            Member('method','one','()I',1025),Member('method','two','()I',1025)],cp)
        child = Class('Child','Base',(),1,[],[
            Member('method','one','()I',1,bytes([4,172])),
            Member('method','two','()I',1,bytes([5,172]))])
        traces = CallTraces(FakeJar([base,child]))
        self.assertEqual(traces.trace('Base','first','()I'),traces.trace('Base','second','()I'))
        self.assertNotEqual(traces.trace('Base','first','()I',receiver='Child'),
                            traces.trace('Base','second','()I',receiver='Child'))

    def reference_fixture(self):
        jar,rules = fixture()
        jar.classes['Base'].methods[1].code = bytes([4,172])
        caller = Class('Caller','java/lang/Object',(),1,[],[
            Member('method','call','(LBase;)I',1,bytes([43,182,0,6,172]))],
            [None,(1,'Base'),(7,1),(1,'first'),(1,'()I'),(12,(3,4)),(10,(2,5))])
        jar = FakeJar([*jar.classes.values(),caller])
        rules['types']['caller'] = {'shape':jar.keys['Caller']}
        rules['members'][0]['referencedBy'] = 'caller'
        rules['members'].append({'role':'caller','lookupType':'caller','declaringType':'caller',
            'kind':'method','flags':1,'signature':'(@base;)I',
            'shape':descriptor('(LBase;)I',lambda n:jar.keys.get(n,n)),
            'trace':member_traces(caller,jar.keys)[0][('call','(LBase;)I')]})
        return jar,rules

    def test_operation_reference_selects_an_equivalent_getter(self):
        jar,rules = self.reference_fixture()
        types,rows = resolve(jar,rules)
        self.assertEqual(rows[0]['name'],'first')
        validate(jar,rules,types,rows)
        # The method names carry graph identity, but do not select the role.
        jar.classes['Caller'].cp[3] = (1,'second')
        types,rows = resolve(jar,rules)
        self.assertEqual(rows[0]['name'],'second')
        validate(jar,rules,types,rows)

    def test_operation_reference_to_wrong_receiver_is_refused(self):
        jar,rules = self.reference_fixture()
        jar.classes['Caller'].cp[1] = (1,'Other')
        # Retain the changed caller shape so this tests the receiver edge.
        rules['members'][1]['trace'] = member_traces(jar.classes['Caller'],jar.keys)[0][('call','(LBase;)I')]
        with self.assertRaisesRegex(Refusal,'read:.*found-0'):
            resolve(jar,rules)

    def test_truncated_class(self):
        with self.assertRaises(Refusal):
            parse(b'\xca\xfe\xba\xbe')

    def test_truncated_instruction(self):
        with self.assertRaises(Refusal):
            instructions(bytes([184,0]))

    def test_jar_limits(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/'fake.jar'
            with zipfile.ZipFile(path,'w') as z:
                z.writestr('A.class',b'not a class')
            for limits,reason in [(Limits(jar_bytes=1),'jar-byte-limit'),
                                  (Limits(entries=0),'entry-limit'),
                                  (Limits(classes=0),'class-count-limit'),
                                  (Limits(total_bytes=1),'total-class-byte-limit'),
                                  (Limits(class_bytes=1),'class-byte-limit'),
                                  (Limits(rss=1),'scan-rss-limit'),
                                  (Limits(seconds=0),'scan-deadline')]:
                with self.subTest(reason=reason), self.assertRaisesRegex(Refusal,reason):
                    Jar(path,limits)


@unittest.skipUnless(os.environ.get('GRID_SYMBOL_JAR'),'Set GRID_SYMBOL_JAR for the local integration test.')
class PinnedJarTests(unittest.TestCase):
    def test_complete_table_and_renamed_jar_model(self):
        root = Path(__file__).resolve().parents[4]
        rules = json.loads(Path(__file__).with_name('selectors.json').read_text())
        jar = Jar(Path(os.environ['GRID_SYMBOL_JAR']))
        try:
            types,rows = resolve(jar,rules)
            validate(jar,rules,types,rows)
            expected = pinned(jar,manifest_rows(root/'context/plan/phase-9/9b-grid-symbol-manifest.md'))
            self.assertEqual(rows,expected)
            self.assertEqual(len(rows),69)
            self.assertEqual(len(types),55)
            for name,role in TYPE_NAMES.items():
                if role in types:
                    self.assertEqual(types[role],expand(name))
            self.assertTrue(all(expand(n) in types.values() for n in EXTRA))
            renamed,rename_type,rename_member = rename_model(jar)
            new_types,new_rows = resolve(renamed,rules)
            validate(renamed,rules,new_types,new_rows)
            self.assertEqual(new_types,{r:rename_type[n] for r,n in types.items()})
            for old,new in zip(rows,new_rows):
                self.assertEqual(new['name'],rename_member(old['name']))
                self.assertEqual(new['lookup'],rename_type[old['lookup']])
                self.assertEqual(new['declaring'],rename_type[old['declaring']])
        finally:
            jar.close()


def rename_model(jar):
    """Rename the entire inert jar model and every loaded code reference."""
    names = {name:f'renamed/Type{i}' for i,name in enumerate(reversed(jar.classes))}
    def member(name):
        return name if name.startswith('<') else 'renamed_' + name
    def desc(value):
        return descriptor(value,lambda n:names.get(n,n))
    renamed = {}
    # Reuse metadata to keep the test below the scan RSS limit.
    for name,c in list(jar.classes.items()):
        c = jar.code_cache.get(name,c)
        if c.cp:
            original = list(c.cp)
            for i,entry in enumerate(original):
                if entry is None:
                    continue
                tag,value = entry
                if tag == 7:
                    value = original[value][1]
                    renamed_value = names.get(value,desc(value))
                    c.cp[i] = (7,len(c.cp))
                    c.cp.append((1,renamed_value))
                elif tag == 12:
                    ni,di = value
                    c.cp[i] = (12,(ni,len(c.cp)))
                    c.cp.append((1,desc(original[di][1])))
                elif tag == 16:
                    c.cp[i] = (16,len(c.cp))
                    c.cp.append((1,desc(original[value][1])))
            # Use separate constants so a shared external method name stays intact.
            for i,entry in enumerate(original):
                if entry is None or entry[0] not in (9,10,11):
                    continue
                owner,nt = entry[1]
                owner_name = original[original[owner][1]][1]
                if owner_name not in names:
                    continue
                ni,di = original[nt][1]
                new_name = len(c.cp)
                c.cp.append((1,member(original[ni][1])))
                new_desc = len(c.cp)
                c.cp.append((1,desc(original[di][1])))
                new_nt = len(c.cp)
                c.cp.append((12,(new_name,new_desc)))
                c.cp[i] = (entry[0],(entry[1][0],new_nt))
        c.name = names[name]
        c.parent = names.get(c.parent,c.parent)
        c.interfaces = tuple(names.get(n,n) for n in reversed(c.interfaces))
        for m in (*c.fields,*c.methods):
            m.name,m.desc = member(m.name),desc(m.desc)
        c.fields.reverse()
        c.methods.reverse()
        renamed[c.name] = c
    model = FakeJar(list(reversed(list(renamed.values()))))
    return model,names,member


if __name__ == '__main__':
    unittest.main()
