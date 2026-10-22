"""Check the fixed investigation plan and its refusal boundaries."""
import json
import os
from pathlib import Path
import unittest

from grid_symbols.scan import Jar
from .admission import Work, lineage
from .receiver_trace import ReceiverLimits, trace

ROOT = Path(__file__).resolve().parents[4]
DATA = ROOT / 'context/evidence/data/phase9b-doctor'
B = 'com/bitwig/ramona/core/'
M = 'com/bitwig/flt/document/core/master/'


@unittest.skipUnless(os.environ.get('GRID_NEW_SYMBOL_JAR'), 'Set GRID_NEW_SYMBOL_JAR for offline integration.')
class FixtureTraceIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.jar = Jar(Path(os.environ['GRID_NEW_SYMBOL_JAR']))
        cls.plan = json.loads((DATA / '614-fixtures/trace-plan.json').read_text())
        seed = json.loads((DATA / '614-receivers/trace.json').read_text())
        cls.report = trace(cls.jar, seed, cls.plan)
        cls.methods = {(m['owner'], m['name'], m['descriptor']): m for m in cls.report['methods']}

    @classmethod
    def tearDownClass(cls):
        cls.jar.close()

    def method(self, owner, name, desc):
        return self.methods[owner, name, desc]

    def test_complete_scan_reproduces_and_keeps_refusal(self):
        saved = json.loads((DATA / '614-fixtures/trace.json').read_text())
        self.assertEqual(self.report, {key: saved[key] for key in self.report})
        self.assertEqual(self.report['work']['classes'], self.jar.stats['classes'])
        for key in ('completeTable', 'boundedAdmission', 'writeAuthority'):
            self.assertFalse(self.report[key])

    def test_context_hierarchy_is_complete_but_not_a_runtime_binding(self):
        work = Work(ReceiverLimits())
        actual = []
        for cls in self.jar.classes.values():
            if B + 'Rzi' in lineage(self.jar, cls.name, work)[0]:
                actual.append({'owner': cls.name, 'parent': cls.parent, 'flags': cls.flags})
        self.assertEqual(actual, self.plan['contextHierarchy'])
        for owner in ('dqr', 'ql', B + 'JXO'):
            self.assertTrue(self.method(owner, 'UNj', '()V')['instructions'])

    def test_explicit_set_collector_preserves_the_set(self):
        ctor = self.method(B + 'Swj', '<init>', '(L' + B + 'XKG;Ljava/util/Set;)V')
        self.assertTrue(any(r['opcode'] == 181 and r['owner'] == B + 'Swj' and
                            r['descriptor'] == 'Ljava/util/Set;' for r in ctor['references']))
        collector = self.method(B + 'Swj', 'cfM', '(L' + B + 'kJI;)V')
        self.assertTrue(any(r['owner'] == B + 'kJI' and r['name'] == 'cfM' and
                            r['descriptor'] == '(L' + B + 'IOJ;)V' for r in collector['references']))
        begin = self.method(B + 'XKG', 'cfM', '(Ljava/lang/String;Ljava/lang/String;L' +
                            B + 'WzZ;L' + B + 'oDc;L' + B + 'CuM;Z)Z')
        self.assertIn({'offset': 208, 'opcode': 154, 'target': 355}, begin['branches'])
        self.assertTrue(any(r['offset'] == 295 and r['descriptor'] == '(Ljava/util/Set;)Z'
                            for r in begin['references']))

    def test_other_collectors_have_ancestor_walks(self):
        method = self.method(B + 'kJI', 'cfM', '(L' + B + 'oDc;L' + B + 'oDc;)V')
        edges = {(r['offset'], r.get('target')) for r in method['branches']}
        self.assertTrue({(310, 279), (347, 316)} <= edges)
        self.assertTrue(any(r['name'] == 'cj_' for r in method['references']))
        slot = next(s for s in self.report['slots'] if s['receiverBase'] == B + 'WzZ'
                    and s['descriptor'] == '(L' + B + 'kJI;)V')
        self.assertEqual(slot['concreteReceiverCount'], 229)

    def test_ping_request_has_a_concrete_descriptor_and_wait(self):
        descriptor = self.method(M + 'Ljp', 'Yt', '()LdeV;')
        literals = [i.get('constant', {}).get('value') for i in descriptor['instructions']]
        self.assertIn('ping', literals)
        self.assertIn('not_engine', literals)
        self.assertTrue(any(i['opcode'] == 17 and i['args'] == [3, 183]
                            for i in descriptor['instructions']))
        request = self.method('cQq', 'cfM', '(LdeV;L' + B + 'oDc;[Ljava/lang/Object;)Ljava/lang/Object;')
        self.assertTrue(any(r['offset'] == 242 and r['name'] == 'Hnt' for r in request['references']))
        caller = self.method(M + 'AJH', 'bLK', '()V')
        self.assertTrue(any(r['offset'] == 32 and r['descriptor'] == '(LcQq;)V' for r in caller['references']))

    def test_context_getter_has_a_null_override(self):
        slot = next(s for s in self.report['slots'] if s['name'] == 'ULc')
        self.assertEqual(len(slot['concreteReceiversByDeclaration']['dve']), 1106)
        method = self.method('dve', 'ULc', '()L' + B + 'Rzi;')
        self.assertEqual([i['opcode'] for i in method['instructions']], [1, 176])


if __name__ == '__main__':
    unittest.main()
