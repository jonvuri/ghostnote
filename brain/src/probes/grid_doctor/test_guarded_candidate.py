"""Guarded candidate preparation refusals on inert inputs. No jar is read."""
import copy
import json
from pathlib import Path
import unittest
import tempfile
from types import SimpleNamespace

from grid_symbols.scan import Refusal
from grid_doctor import guarded_candidate as g

DATA = Path(__file__).resolve().parents[4] / 'context/evidence/data/phase9b-doctor'


class InertMember:
    def __init__(self, name, desc, flags, refs=()):
        self.name, self.desc, self.flags, self.refs = name, desc, flags, refs


class InertClass:
    def __init__(self, name, fields, methods):
        self.name, self.fields, self.methods = name, fields, methods


class GuardedCandidateTest(unittest.TestCase):
    def setUp(self):
        self.rules = json.loads((DATA / 'v20-preparation/selectors.json').read_text())
        self.rows = json.loads((DATA / 'v20-preparation/candidate.json').read_text())['members']

    def test_only_the_traced_access_variant_is_accepted(self):
        rows = copy.deepcopy(self.rows)
        with self.assertRaises(Refusal):
            g.adjusted_selectors(self.rules, rows)  # no variant at all
        row = next(r for r in rows if r['role'] == 'journal-recording-edit')
        row['flags'] = 0
        adjusted = g.adjusted_selectors(self.rules, rows)
        self.assertEqual(adjusted['variants'], [dict(g.RECORDING_EDIT_VARIANT)])
        self.assertEqual(next(r for r in adjusted['members'] if r['role'] == 'journal-recording-edit')['flags'], 0)
        other = copy.deepcopy(rows)
        next(r for r in other if r['role'] == 'disposal')['flags'] = 0
        with self.assertRaises(Refusal):
            g.adjusted_selectors(self.rules, other)
        wrong = copy.deepcopy(rows)
        next(r for r in wrong if r['role'] == 'journal-recording-edit')['flags'] = 1
        with self.assertRaises(Refusal):
            g.adjusted_selectors(self.rules, wrong)
        missing = [r for r in rows if r['role'] != 'members']
        with self.assertRaises(Refusal):
            g.adjusted_selectors(self.rules, missing)

    def test_member_lookup_requires_one_declaration(self):
        cls = InertClass('X', [InertMember('f', 'Z', 2), InertMember('f', 'Z', 2)], [InertMember('m', '()V', 1)])
        self.assertIs(g.member(cls, 'm', '()V'), cls.methods[0])
        with self.assertRaises(Refusal):
            g.member(cls, 'f', 'Z', 'field')
        with self.assertRaises(Refusal):
            g.member(cls, 'absent', '()V')

    def test_owned_tree_requires_one_managed_class(self):
        report = {'builds': [{'sha256': 'abc', 'receivers': [
            {'runtime': 'A', 'className': 'a', 'classId': 1, 'managed': False},
            {'runtime': 'B', 'className': 'module_contents', 'classId': 1904, 'managed': True}]}]}
        path = Path(self.id() + '.json')
        path.write_text(json.dumps(report))
        try:
            class JarLike:
                sha256 = 'abc'
                classes = {'A': None, 'B': None}
            plan = {'managedClassId': 1904, 'managedNodes': 1, 'maxNodes': 256, 'maxDepth': 12, 'source': 't'}
            tree = g.owned_tree(JarLike(), plan, path)
            self.assertEqual(tree['managed'], ['B'])
            self.assertEqual(len(tree['classes']), 2)
            JarLike.classes = {'A': None}
            with self.assertRaises(Refusal):
                g.owned_tree(JarLike(), plan, path)
            JarLike.classes = {'A': None, 'B': None}
            report['builds'][0]['receivers'][1]['classId'] = 1
            path.write_text(json.dumps(report))
            with self.assertRaises(Refusal):
                g.owned_tree(JarLike(), plan, path)
            report['builds'][0]['receivers'][1]['classId'] = 1904
            report['builds'][0]['receivers'][0]['managed'] = True
            path.write_text(json.dumps(report))
            with self.assertRaises(Refusal):
                g.owned_tree(JarLike(), plan, path)
        finally:
            path.unlink()

    def test_prepared_resources_are_consistent(self):
        """The written 6.1.4 resources agree with each other and with the plan."""
        out = DATA / '614-guarded'
        candidate = json.loads((out / 'candidate.json').read_text())
        selectors_bytes = (out / 'selectors.json').read_bytes()
        guards = json.loads((out / 'guards.json').read_text())
        self.assertEqual(candidate['selectorSha256'], g.sha256(selectors_bytes))
        self.assertEqual(guards['candidateSha256'], g.sha256((out / 'candidate.json').read_bytes()))
        self.assertEqual(guards['jarSha256'], candidate['jarSha256'])
        self.assertEqual(guards['planSha256'], g.sha256((out / 'guard-plan.json').read_bytes()))
        self.assertEqual(candidate['source']['hostVersion'], '6.1.4')
        self.assertEqual(len(candidate['types']), 55)
        self.assertEqual(len(candidate['members']), 76)
        self.assertEqual([f['role'] for f in guards['fields']],
                         ['helper-list', 'pending-helper', 'pending-list', 'disposal-tracking-flag', 'listener-tracking-flag'])
        self.assertEqual(guards['ownedTree']['managedNodes'], 1)
        self.assertEqual(len(guards['ownedTree']['classes']), 33)
        self.assertFalse(guards['writeAuthority'])
        self.assertFalse(candidate['verdict']['writeAuthority'])
        self.assertEqual(candidate['verdict']['liveValidation'], 'not-run')

    def test_reuse_requires_the_same_resolved_table_and_selectors(self):
        source = DATA / '614-guarded'
        candidate_bytes = (source / 'candidate.json').read_bytes()
        selectors_bytes = (source / 'selectors.json').read_bytes()
        candidate = json.loads(candidate_bytes)
        jar = SimpleNamespace(sha256=candidate['jarSha256'])
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory)
            (target / 'candidate.json').write_bytes(candidate_bytes)
            (target / 'selectors.json').write_bytes(selectors_bytes)
            def reuse():
                return g.reused_candidate(target, jar, selectors_bytes, candidate['types'],
                                          candidate['members'], candidate['verdict'])
            self.assertEqual(reuse(), candidate_bytes)
            changed = copy.deepcopy(candidate)
            changed['members'][0]['name'] = 'other'
            (target / 'candidate.json').write_text(json.dumps(changed))
            with self.assertRaisesRegex(Refusal, 'candidate-differs'):
                reuse()
            (target / 'candidate.json').write_bytes(candidate_bytes)
            (target / 'selectors.json').write_bytes(selectors_bytes + b' ')
            with self.assertRaisesRegex(Refusal, 'selectors-differ'):
                reuse()

    def test_revised_resources_keep_the_candidate_and_change_only_the_owned_set(self):
        prior, current = DATA / '614-guarded', DATA / '614-census/prepared'
        for name in ('candidate.json', 'selectors.json'):
            self.assertEqual((prior / name).read_bytes(), (current / name).read_bytes())
        old = json.loads((prior / 'guards.json').read_bytes())
        new = json.loads((current / 'guards.json').read_bytes())
        for key in ('types', 'fields', 'candidateSha256', 'jarSha256'):
            self.assertEqual(old[key], new[key])
        for key in ('managed', 'managedNodes', 'maxNodes', 'maxDepth'):
            self.assertEqual(old['ownedTree'][key], new['ownedTree'][key])
        self.assertEqual(len(new['ownedTree']['classes']), 36)
        self.assertEqual(new['ownedTree']['reportSha256'], g.sha256((DATA / '614-census/census-614.json').read_bytes()))
        self.assertEqual(new['planSha256'], g.sha256((DATA / '614-census/guard-plan.json').read_bytes()))


if __name__ == '__main__':
    unittest.main()
