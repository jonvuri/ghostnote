"""Check superclass evidence and admission refusal boundaries."""
import copy
import json
import os
from pathlib import Path
from types import SimpleNamespace
import unittest

from grid_symbols.scan import Class, Jar, Limits, Member, Refusal
from .admission import AdmissionLimits, Work, lineage, lookup, slot_census, trace, validate_seed

ROOT = Path(__file__).resolve().parents[4]
SEED = ROOT / 'context/evidence/data/phase9b-doctor/614-ownership/trace.json'
PLAN = ROOT / 'context/evidence/data/phase9b-doctor/614-admission/trace-plan.json'


def model():
    def cls(name, parent, methods=(), flags=1):
        return Class(name, parent, (), flags, [], list(methods))
    classes = [cls('Base', 'java/lang/Object', [Member('method', 'parent', '()LBase;', 1)]),
               cls('Child', 'Base'), cls('Leaf', 'Child'),
               cls('Unrelated', 'java/lang/Object', [Member('method', 'parent', '()LBase;', 1)])]
    return SimpleNamespace(classes={c.name: c for c in classes}, limits=Limits(), check=lambda: None)


class AdmissionUnitTests(unittest.TestCase):
    def setUp(self):
        self.jar = model()
        self.work = Work(AdmissionLimits())
        self.slot = {'receiverBase': 'Base', 'name': 'parent', 'descriptor': '()LBase;'}

    def test_lookup_uses_superclass_not_enumeration_or_unrelated_declaration(self):
        row = slot_census(self.jar, self.slot, self.work)
        self.assertEqual(row['concreteReceiversByDeclaration'], {'Base': ['Base', 'Child', 'Leaf']})
        self.jar.classes = dict(reversed(list(self.jar.classes.items())))
        self.jar.classes['Base'].methods.append(Member('method', 'added', '()V', 1))
        self.assertEqual(slot_census(self.jar, self.slot, self.work), row)

    def test_override_is_retained_as_a_distinct_receiver_contract(self):
        self.jar.classes['Child'].methods.append(Member('method', 'parent', '()LBase;', 1))
        row = slot_census(self.jar, self.slot, self.work)
        self.assertEqual(row['concreteReceiversByDeclaration'],
                         {'Base': ['Base'], 'Child': ['Child', 'Leaf']})

    def test_local_census_survives_complete_model_renaming(self):
        names = {n: 'Renamed' + str(i) for i, n in enumerate(self.jar.classes)}
        for cls in self.jar.classes.values():
            cls.name = names[cls.name]
            cls.parent = names.get(cls.parent, cls.parent)
            for method in cls.methods:
                method.name = 'renamedMethod'
                method.desc = '()L' + names['Base'] + ';'
        self.jar.classes = {c.name: c for c in reversed(list(self.jar.classes.values()))}
        row = slot_census(self.jar, {'receiverBase': names['Base'], 'name': 'renamedMethod',
                                    'descriptor': '()L' + names['Base'] + ';'}, self.work)
        self.assertEqual(row['concreteReceiversByDeclaration'],
                         {names['Base']: sorted(names[n] for n in ('Base', 'Child', 'Leaf'))})

    def test_missing_and_duplicate_declarations_refuse(self):
        m = self.jar.classes['Base'].methods.pop()
        with self.assertRaisesRegex(Refusal, 'unresolved-superclass-slot'):
            lookup(self.jar, 'Leaf', 'parent', '()LBase;', self.work)
        self.jar.classes['Base'].methods = [m, m]
        with self.assertRaisesRegex(Refusal, 'duplicate-declaration'):
            lookup(self.jar, 'Leaf', 'parent', '()LBase;', self.work)

    def test_nonconcrete_private_static_and_native_slots_refuse(self):
        for flag in (2, 8, 0x100, 0x400):
            self.jar.classes['Base'].methods[0].flags = flag
            with self.subTest(flag=flag), self.assertRaisesRegex(Refusal, 'nonconcrete-instance-slot'):
                lookup(self.jar, 'Leaf', 'parent', '()LBase;', self.work)

    def test_changed_required_signature_and_receiver_edge_refuse(self):
        self.jar.classes['Base'].methods[0].desc = '()Ljava/lang/Object;'
        with self.assertRaisesRegex(Refusal, 'unresolved-superclass-slot'):
            lookup(self.jar, 'Leaf', 'parent', '()LBase;', self.work)
        self.jar.classes['Leaf'].parent = 'external/Missing'
        with self.assertRaisesRegex(Refusal, 'unresolved-superclass-slot'):
            lookup(self.jar, 'Leaf', 'parent', '()LBase;', self.work)

    def test_cycle_depth_and_work_limits_refuse(self):
        self.jar.classes['Base'].parent = 'Leaf'
        with self.assertRaisesRegex(Refusal, 'inheritance-cycle'):
            lineage(self.jar, 'Leaf', self.work)
        self.jar.classes['Base'].parent = 'java/lang/Object'
        self.jar.limits.depth = 1
        with self.assertRaisesRegex(Refusal, 'inheritance-depth'):
            lineage(self.jar, 'Leaf', self.work)
        with self.assertRaisesRegex(Refusal, 'hierarchy_edges-limit'):
            lineage(self.jar, 'Leaf', Work(AdmissionLimits(hierarchy_edges=0)))

    def test_missing_base_empty_receivers_and_interface_default_do_not_pass(self):
        with self.assertRaisesRegex(Refusal, 'missing-receiver-base'):
            slot_census(self.jar, {**self.slot, 'receiverBase': 'missing'}, self.work)
        for cls in self.jar.classes.values():
            cls.flags = 0x400
        with self.assertRaisesRegex(Refusal, 'no-concrete-receivers'):
            slot_census(self.jar, self.slot, self.work)
        self.jar = model()
        self.jar.classes['Leaf'].parent = 'java/lang/Object'
        self.jar.classes['Leaf'].interfaces = ('Base',)
        with self.assertRaisesRegex(Refusal, 'unresolved-superclass-slot'):
            lookup(self.jar, 'Leaf', 'parent', '()LBase;', self.work)

    def test_wrong_jar_refuses_before_code_access(self):
        with self.assertRaisesRegex(Refusal, 'seed-jar-hash'):
            validate_seed(SimpleNamespace(sha256='wrong'), {'input': {'sha256': 'expected'}})


@unittest.skipUnless(os.environ.get('GRID_NEW_SYMBOL_JAR'), 'Set GRID_NEW_SYMBOL_JAR for offline integration.')
class AdmissionIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.jar = Jar(Path(os.environ['GRID_NEW_SYMBOL_JAR']))
        cls.seed = json.loads(SEED.read_text())
        cls.plan = json.loads(PLAN.read_text())
        cls.report = trace(cls.jar, cls.seed, cls.plan)

    @classmethod
    def tearDownClass(cls):
        cls.jar.close()

    def test_complete_census_has_no_admission_authority(self):
        self.assertEqual(self.report['work']['classes'], self.jar.stats['classes'])
        self.assertEqual(self.report['work']['methods'], sum(len(c.methods) for c in self.jar.classes.values()))
        self.assertEqual(self.report['result'], 'refused')
        for key in ('writeAuthority', 'completeTable', 'boundedAdmission'):
            self.assertIs(self.report[key], False)

    def test_changed_seed_instructions_refuse(self):
        seed = copy.deepcopy(self.seed)
        seed['methods'][0]['instructions'][0]['opcode'] ^= 1
        with self.assertRaisesRegex(Refusal, 'seed-trace-disagreement'):
            validate_seed(self.jar, seed)

    def test_plan_identity_required_methods_and_limits_refuse(self):
        with self.assertRaisesRegex(Refusal, 'plan-jar-hash'):
            trace(self.jar, self.seed, {**self.plan, 'jarSha256': 'wrong'})
        with self.assertRaisesRegex(Refusal, 'plan-owner'):
            trace(self.jar, self.seed, {**self.plan, 'traceOwners': ['missing'], 'slots': []})
        with self.assertRaisesRegex(Refusal, 'missing-or-duplicate-required-method'):
            trace(self.jar, self.seed, {**self.plan, 'slots': [], 'methods': [
                {'owner': 'thz', 'name': 'missing', 'descriptor': '()V'}]})
        for key in ('hierarchy_edges', 'methods', 'instructions', 'sites', 'traces'):
            with self.subTest(key=key), self.assertRaisesRegex(Refusal, key + '-limit'):
                trace(self.jar, self.seed, self.plan, AdmissionLimits(**{key: 0}))

    def test_inherited_ancestor_walk_and_parent_getter_are_retained(self):
        slots = {r['name']: r for r in self.report['slots']}
        self.assertEqual(set(slots['LaE']['concreteReceiversByDeclaration']), {'com/bitwig/ramona/core/AVL'})
        method = next(m for m in self.report['methods'] if m['owner']=='com/bitwig/ramona/core/AVL'
                      and m['name']=='LaE' and m['descriptor']=='(Lcom/bitwig/ramona/core/OLR;)Z')
        self.assertIn({'offset': 73, 'opcode': 167, 'target': 55}, method['branches'])
        self.assertEqual(method['exceptionHandlers'], [])
        self.assertEqual(slots['J_']['concreteReceiverCount'], slots['LaE']['concreteReceiverCount'])

    def test_debug_registration_retains_dispatch_mode_and_callback_bootstrap(self):
        owner = 'com/bitwig/flt/app/agent_debug/lBQ'
        method = next(m for m in self.report['methods'] if m['owner']==owner
                      and m['name']=='FzB' and m['descriptor']=='()V')
        rows = method['instructions']
        self.assertTrue(any(i.get('constant', {}).get('value')=='leaks' for i in rows))
        mode = next(i for i in rows if i['offset']==78)['constant']
        self.assertEqual((mode['owner'], mode['name']), ('com/bitwig/flt/app/agent_debug/pYi','MRY'))
        callback = next(i for i in rows if i['offset']==112)['bootstrap']['arguments'][1]['target']
        self.assertEqual((callback['owner'], callback['name']), (owner, 'Hnt'))
        dispatch = next(m for m in self.report['methods'] if m['owner']==owner
                        and m['descriptor']=='(Lcom/bitwig/flt/app/agent_debug/RKg;Lcom/bitwig/flt/app/agent_debug/CuM;)Ljava/lang/Object;')
        self.assertTrue(any(r['owner']=='dpN' and r['name']=='asyncExec' for r in dispatch['references']))


if __name__ == '__main__':
    unittest.main()
