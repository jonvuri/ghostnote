"""Check census evidence and serialized-tree refusal boundaries without host calls."""
import copy
import json
from pathlib import Path
import unittest
from types import SimpleNamespace

from grid_symbols.scan import Refusal
from grid_doctor.owned_census import serialized_edges, compare
from grid_doctor.guarded_candidate import owned_tree_rows

DATA = Path(__file__).resolve().parents[4] / 'context/evidence/data/phase9b-doctor'


class OwnedCensusTest(unittest.TestCase):
    def test_inline_children_and_back_references(self):
        child = {'classId': 2, 'properties': [{'id': 9, 'value': {'reference': 1}}]}
        root = {'classId': 1, 'properties': [{'id': 8, 'value': [child]}]}
        result = serialized_edges(root)
        self.assertEqual(result['nodes'], [{'objectId': 1, 'classId': 1}, {'objectId': 2, 'classId': 2}])
        self.assertEqual(result['references'], [
            {'source': 1, 'propertyId': 8, 'target': 2, 'kind': 'inline'},
            {'source': 2, 'propertyId': 9, 'target': 1, 'kind': 'reference'}])
        for value in (0, 3, True, '1'):
            child['properties'][0]['value']['reference'] = value
            with self.assertRaises(Refusal):
                serialized_edges(root)

    def test_serialized_depth_refuses(self):
        root = {'classId': 1, 'properties': []}
        for _ in range(64):
            root = {'classId': 1, 'properties': [{'id': 1, 'value': root}]}
        with self.assertRaisesRegex(Refusal, 'tree-limit'):
            serialized_edges(root)

    def test_two_build_sets_and_added_disposal_bodies(self):
        old, new = [json.loads((DATA / f'614-census/census-{build}.json').read_bytes()) for build in ('606', '614')]
        result = compare(old, new)
        self.assertTrue(result['classSetsEqual'])
        self.assertEqual((result['oldCount'], result['newCount']), (36, 36))
        self.assertEqual(new['checks']['added'], ['dgk', 'vta', 'wKx'])
        self.assertEqual(old['checks']['added'], ['FEG', 'tqA', 'vPq'])
        for row in result['rows']:
            self.assertTrue(row['serializedEqual'])
            self.assertTrue(row['strongEqual'])
            self.assertTrue(all(row['disposalBodiesEqual'][:-1]))
            self.assertFalse(row['disposalBodiesEqual'][-1])
            self.assertEqual(row['disposalInstructions'][0][-1], 61)
            self.assertEqual(row['disposalInstructions'][1][-1], 63)
        port = next(c for c in new['classes'] if c['name'] == 'wKx')
        self.assertTrue(any(c['in'] == ['rce', 'bl_', '()V'] and c['via'][0] == 'wKx' for c in port['creations']))
        self.assertEqual(new['checks']['detachedOwnedObjects'], 77)
        self.assertEqual(old['checks']['detachedOwnedObjects'], 77)
        self.assertFalse(new['runtimeObserved'])

    def test_census_input_refusals(self):
        source = json.loads((DATA / '614-census/census-614.json').read_bytes())
        jar = SimpleNamespace(sha256=source['jarSha256'])
        plan = {'managedClassId': 1904}
        self.assertEqual(len(owned_tree_rows(jar, plan, source)), 36)
        for key, value in [('pinnedMissing', ['x']), ('pinnedReceiversCovered', False),
                           ('detachedReadCovered', False), ('refusedClassCovered', False), ('classCount', 35)]:
            changed = copy.deepcopy(source); changed['checks'][key] = value
            with self.assertRaises(Refusal):
                owned_tree_rows(jar, plan, changed)
        for key, value in [('jarSha256', 'other'), ('result', 'refused')]:
            changed = copy.deepcopy(source); changed[key] = value
            with self.assertRaises(Refusal):
                owned_tree_rows(jar, plan, changed)


if __name__ == '__main__':
    unittest.main()
