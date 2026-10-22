"""Check inherited reference evidence and preserve admission refusal."""
import copy
import json
import os
from pathlib import Path
from types import SimpleNamespace
import unittest

from grid_symbols.scan import Class, Jar, Limits, Member, Refusal
from .admission import Work
from .receiver_trace import Declarations, ReceiverLimits, trace

ROOT = Path(__file__).resolve().parents[4]
DATA = ROOT / 'context/evidence/data/phase9b-doctor'


def model():
    base = Class('Base', 'java/lang/Object', (), 1,
                 [Member('field', 'flags', 'I', 4)],
                 [Member('method', 'dispatch', '()V', 1)])
    child = Class('Child', 'Base', (), 1, [], [])
    face = Class('Face', 'java/lang/Object', (), 0x601, [], [])
    return SimpleNamespace(classes={c.name: c for c in (base, child, face)},
                           limits=Limits(), check=lambda: None)


class DeclarationTests(unittest.TestCase):
    def setUp(self):
        self.jar = model()
        self.work = Work(ReceiverLimits())
        self.declarations = Declarations(self.jar, self.work)

    def test_inherited_method_preserves_symbolic_owner_and_declaration(self):
        self.assertEqual(self.declarations.find('method', 'Child', 'dispatch', '()V'),
                         {'status': 'declaration', 'owner': 'Base', 'flags': 1})

    def test_override_does_not_alias_the_parent(self):
        self.jar.classes['Child'].methods.append(Member('method', 'dispatch', '()V', 1))
        self.assertEqual(self.declarations.find('method', 'Child', 'dispatch', '()V')['owner'], 'Child')

    def test_unrelated_additions_and_order_do_not_change_the_result(self):
        self.jar.classes['Child'].fields.append(Member('field', 'other', 'I', 1))
        self.jar.classes['Face'].methods.append(Member('method', 'other', '()V', 1))
        self.jar.classes = dict(reversed(list(self.jar.classes.items())))
        self.assertEqual(self.declarations.find('method', 'Child', 'dispatch', '()V')['owner'], 'Base')

    def test_renamed_local_model_preserves_inherited_lookup(self):
        for cls in self.jar.classes.values():
            cls.name = 'New' + cls.name
            if cls.parent in self.jar.classes:
                cls.parent = 'New' + cls.parent
            for method in cls.methods:
                method.name = 'newMethod'
        self.jar.classes = {c.name: c for c in self.jar.classes.values()}
        self.assertEqual(self.declarations.find('method', 'NewChild', 'newMethod', '()V')['owner'], 'NewBase')

    def test_changed_signature_and_missing_superclass_stay_unresolved(self):
        self.jar.classes['Base'].methods[0].desc = '(I)V'
        self.assertEqual(self.declarations.find('method', 'Child', 'dispatch', '()V')['status'], 'external')
        self.jar.classes['Child'].parent = 'Absent'
        self.assertEqual(Declarations(self.jar, self.work).find('method', 'Child', 'dispatch', '(I)V')['status'], 'external')

    def test_duplicate_method_refuses(self):
        self.jar.classes['Base'].methods *= 2
        with self.assertRaisesRegex(Refusal, 'duplicate-declaration'):
            self.declarations.find('method', 'Child', 'dispatch', '()V')

    def test_interface_methods_are_not_inferred(self):
        self.jar.classes['Face'].methods.append(Member('method', 'dispatch', '()V', 1))
        self.assertEqual(self.declarations.find('method', 'Face', 'dispatch', '()V')['status'], 'interface')

    def test_interface_field_precedes_superclass_field(self):
        self.jar.classes['Child'].interfaces = ('Face',)
        self.jar.classes['Face'].fields.append(Member('field', 'flags', 'I', 0x19))
        self.assertEqual(self.declarations.find('field', 'Child', 'flags', 'I')['owner'], 'Face')

    def test_empty_interface_permits_superclass_field(self):
        self.jar.classes['Child'].interfaces = ('Face',)
        self.assertEqual(self.declarations.find('field', 'Child', 'flags', 'I')['owner'], 'Base')

    def test_external_and_ambiguous_interface_fields_do_not_select_parent(self):
        self.jar.classes['Child'].interfaces = ('Absent',)
        self.assertEqual(self.declarations.find('field', 'Child', 'flags', 'I')['status'], 'external-interface')
        self.jar.classes['Other'] = copy.deepcopy(self.jar.classes['Face'])
        self.jar.classes['Other'].name = 'Other'
        for name in ('Face', 'Other'):
            self.jar.classes[name].fields.append(Member('field', 'flags', 'I', 0x19))
        self.jar.classes['Child'].interfaces = ('Face', 'Other')
        result = Declarations(self.jar, self.work).find('field', 'Child', 'flags', 'I')
        self.assertEqual(result['status'], 'ambiguous-interface-field')

    def test_interface_diamond_keeps_one_declaration(self):
        self.jar.classes['Face'].fields.append(Member('field', 'flags', 'I', 0x19))
        self.jar.classes['Other'] = Class('Other', 'java/lang/Object', ('Face',), 0x601, [], [])
        self.jar.classes['Child'].interfaces = ('Face', 'Other')
        self.assertEqual(self.declarations.find('field', 'Child', 'flags', 'I')['owner'], 'Face')

    def test_native_and_abstract_declarations_are_evidence_not_execution(self):
        for flags in (0x101, 0x401):
            self.jar.classes['Base'].methods[0].flags = flags
            result = Declarations(self.jar, self.work).find('method', 'Child', 'dispatch', '()V')
            self.assertEqual(result['flags'], flags)

    def test_lookup_cache_is_bounded(self):
        d = Declarations(self.jar, Work(ReceiverLimits(lookups=1)))
        d.find('method', 'Child', 'dispatch', '()V')
        d.find('method', 'Child', 'dispatch', '()V')
        with self.assertRaisesRegex(Refusal, 'lookups-limit'):
            d.find('method', 'Base', 'dispatch', '()V')

    def test_hierarchy_and_interface_cycles_refuse(self):
        self.jar.classes['Base'].parent = 'Child'
        with self.assertRaisesRegex(Refusal, 'inheritance-cycle'):
            self.declarations.find('method', 'Child', 'dispatch', '()V')
        self.jar = model()
        self.jar.classes['Child'].interfaces = ('Face',)
        self.jar.classes['Face'].interfaces = ('Face',)
        with self.assertRaisesRegex(Refusal, 'interface-cycle-or-depth'):
            Declarations(self.jar, self.work).find('field', 'Child', 'flags', 'I')


@unittest.skipUnless(os.environ.get('GRID_NEW_SYMBOL_JAR'), 'Set GRID_NEW_SYMBOL_JAR for offline integration.')
class ReceiverIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.jar = Jar(Path(os.environ['GRID_NEW_SYMBOL_JAR']))
        cls.seed = json.loads((DATA / '614-admission/trace.json').read_text())
        cls.plan = json.loads((DATA / '614-receivers/trace-plan.json').read_text())
        cls.report = trace(cls.jar, cls.seed, cls.plan)

    @classmethod
    def tearDownClass(cls):
        cls.jar.close()

    def test_complete_scan_keeps_refusal(self):
        self.assertEqual(self.report['work']['classes'], self.jar.stats['classes'])
        self.assertEqual(self.report['work']['methods'], sum(len(c.methods) for c in self.jar.classes.values()))
        self.assertEqual(self.report['result'], 'refused')
        for key in ('completeTable', 'boundedAdmission', 'writeAuthority'):
            self.assertIs(self.report[key], False)

    def test_changed_seed_and_wrong_plan_refuse(self):
        seed = copy.deepcopy(self.seed)
        seed['methods'][0]['instructions'][0]['opcode'] ^= 1
        with self.assertRaisesRegex(Refusal, 'seed-trace-disagreement'):
            trace(self.jar, seed, self.plan)
        with self.assertRaisesRegex(Refusal, 'plan-jar-hash'):
            trace(self.jar, self.seed, {**self.plan, 'jarSha256': 'wrong'})

    def test_missing_and_duplicate_plan_inputs_refuse(self):
        plan = {**self.plan, 'methods': self.plan['methods'] * 2}
        with self.assertRaisesRegex(Refusal, 'duplicate-plan-method|plan-limit'):
            trace(self.jar, self.seed, plan)
        plan = {**self.plan, 'slots': [], 'methods': [{'owner': 'dpN', 'name': 'missing', 'descriptor': '()V'}]}
        with self.assertRaisesRegex(Refusal, 'missing-or-duplicate-method'):
            trace(self.jar, self.seed, plan)

    def test_work_limits_refuse(self):
        for key in ('hierarchy_edges', 'lookups', 'methods', 'instructions', 'sites', 'traces'):
            with self.subTest(key=key), self.assertRaisesRegex(Refusal, key + '-limit'):
                trace(self.jar, self.seed, self.plan, ReceiverLimits(**{key: 0}))

    def test_batch_bootstrap_and_runnable_body_are_retained(self):
        m = next(m for m in self.report['methods'] if (m['owner'], m['name'], m['descriptor']) == ('Dr2', 'ucQ', '()V'))
        dynamic = next(i for i in m['instructions'] if i['offset'] == 104)
        target = dynamic['bootstrap']['arguments'][1]['target']
        self.assertEqual((target['owner'], target['name'], target['descriptor']), ('Dr2', 'cfM', '([LgGV;)V'))
        batch = next(m for m in self.report['methods'] if m['owner'] == 'Dr2' and m['descriptor'] == '([LgGV;)V')
        self.assertTrue(any(r['owner'] == 'gGV' and r['name'] == 'process' for r in batch['references']))

    def test_inherited_descriptor_field_sites_are_retained(self):
        rows = [r for r in self.report['sites'] if r['target']['owner'] == 'dfb'
                and r['target']['name'] == 'FzB' and r['target']['descriptor'] == 'I']
        self.assertTrue(rows)
        self.assertTrue(all(r['resolution']['owner'] == 'deZ' for r in rows))

    def test_flag_override_cannot_be_replaced_by_the_base_bit_test(self):
        slot = next(s for s in self.report['slots'] if s['receiverBase'] == 'dfb' and s['name'] == 'nVd')
        self.assertEqual(slot['concreteReceiversByDeclaration']['deX'], ['deX'])
        method = next(m for m in self.report['methods'] if
                      (m['owner'], m['name'], m['descriptor']) == ('deX', 'nVd', '()Z'))
        self.assertEqual([i['opcode'] for i in method['instructions']], [4, 172])

    def test_round_trip_pump_and_both_waiting_callers_are_retained(self):
        pump = next(m for m in self.report['methods'] if
                    (m['owner'], m['name'], m['descriptor']) == ('dqr', 'UNj', '()V'))
        refs = {(r['offset'], r['owner'], r['name'], r['descriptor']) for r in pump['references']}
        self.assertIn((46, 'dnm', 'cfM', '()LeoG;'), refs)
        self.assertIn((65, 'dpN', 'MRY', '(LeoG;)V'), refs)
        callers = {r['caller'] for r in self.report['sites'] if
                   r['resolution']['owner'] == 'com/bitwig/ramona/core/Rzi'
                   and r['target']['name'] == 'UNj'}
        self.assertEqual(callers, {'cQq', 'com/bitwig/ramona/core/XKG'})

    def test_relationship_parent_step_can_allocate(self):
        method = next(m for m in self.report['methods'] if
                      (m['owner'], m['name'], m['descriptor']) ==
                      ('deU', 'E3', '(Lcom/bitwig/ramona/core/oDc;)Lcom/bitwig/ramona/core/bnq;'))
        self.assertEqual(method['instructions'][0]['constant']['value'], 'com/bitwig/ramona/core/CbE')
        self.assertEqual(method['instructions'][0]['opcode'], 187)


if __name__ == '__main__':
    unittest.main()
