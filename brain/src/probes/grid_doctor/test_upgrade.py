"""Upgrade-check stages on inert in-memory class models. No vendor jar is read and no host request is sent."""
import contextlib
import copy
import io
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest

from grid_symbols.scan import Class, Member, Refusal
from grid_symbols.test_resolve import FakeJar, fixture
from grid_doctor import upgrade
from grid_doctor.test_body_change import model

ACCEPTED = {'fingerprint': None, 'selectorSha256': None, 'hostVersion': '6.0.6', 'verdict': 'accepted',
            'roles': [], 'teardown': {}, 'baselineVerified': True, 'completed': 'now', 'writeAuthority': False}


class InertJar(FakeJar):
    """A fake jar with the file identity that the check reads from a real jar."""

    def __init__(self, classes, path):
        super().__init__(classes)
        self.path = Path(path)
        self.sha256 = upgrade.fingerprint_of(path)['sha256']
        self.stats = {'jarBytes': self.path.stat().st_size}
        self.closed = False

    def close(self):
        self.closed = True


def table_of(jar, rules):
    from grid_symbols.resolve import resolve, validate
    types, rows = resolve(jar, rules)
    return {'types': types, 'members': rows, 'verdict': validate(jar, rules, types, rows)}


class UpgradeTest(unittest.TestCase):
    def setUp(self):
        self.directory = Path(tempfile.mkdtemp(prefix='gn-upgrade-test-'))
        self.old_path = self.directory / 'old.jar'
        self.new_path = self.directory / 'new.jar'
        self.old_path.write_bytes(b'old jar bytes')
        self.new_path.write_bytes(b'new jar bytes')
        self.old_jar, self.rules = fixture()
        for rule in self.rules['members']:
            rule['liveInvariant'] = 'inert-fixture'
        self.old_jar = InertJar(list(self.old_jar.classes.values()), self.old_path)
        self.selectors_bytes = (json.dumps(self.rules, indent=2) + '\n').encode()
        table = table_of(self.old_jar, self.rules)
        self.candidate = {'result': 'pass', 'jarSha256': self.old_jar.sha256, 'jarPath': str(self.old_path),
                          'selectorSha256': upgrade.sha256(self.selectors_bytes), **table}
        accepted = dict(ACCEPTED, fingerprint=upgrade.fingerprint_of(self.old_path)['fingerprint'],
                        selectorSha256=self.candidate['selectorSha256'])
        self.accepted = accepted
        self.sources = self.directory / 'sources'
        self.sources.mkdir()
        (self.sources / 'accepted.json').write_text(json.dumps(accepted))
        (self.sources / 'candidate.json').write_text(json.dumps(self.candidate))
        (self.sources / 'selectors.json').write_bytes(self.selectors_bytes)
        self.baseline = self.directory / 'baseline'
        upgrade.assemble_baseline(self.sources / 'accepted.json', self.sources, self.baseline)

    def jars(self, new_classes):
        """Patch the jar reader so the check opens inert models by path."""
        new = InertJar(new_classes, self.new_path)
        opened = {self.old_path.resolve(): self.old_jar, self.new_path.resolve(): new}

        def open_jar(path):
            return opened[Path(path).resolve()]
        return open_jar, new

    def run_check(self, new_classes, **options):
        open_jar, new = self.jars(new_classes)
        original = upgrade.Jar
        upgrade.Jar = open_jar
        try:
            defaults = dict(baseline=self.baseline, jar=self.new_path, old_jar=None, traced_table=None,
                            closure=None, collector_report=None, module_report=None, read=None,
                            refused_class=None, managed_class_id=1904, guard_plan=None,
                            candidate_directory=None, host_version=None)
            args = SimpleNamespace(**(defaults | options))
            args.output = self.directory / ('out-' + str(len(list(self.directory.iterdir()))))
            report = upgrade.check(args)
        finally:
            upgrade.Jar = original
        self.assertTrue(new.closed)
        if report['stages'].get('body-change', {}).get('status') == 'compared':
            self.assertTrue(self.old_jar.closed)
        self.assertFalse(report['writeAuthority'])
        self.assertEqual(json.loads((args.output / 'upgrade.json').read_text())['result'], report['result'])
        return report, args.output

    def renamed(self, suffix='2', code=None):
        classes = []
        for cls in self.old_jar.classes.values():
            methods = [Member('method', m.name + suffix, m.desc, m.flags, code if code and m.name == 'first' else m.code)
                       for m in cls.methods]
            fields = [Member('field', f.name + suffix, f.desc, f.flags) for f in cls.fields]
            parent = cls.parent + suffix if cls.parent in self.old_jar.classes else cls.parent
            classes.append(Class(cls.name + suffix, parent, cls.interfaces, cls.flags, fields, methods, cls.cp))
        return classes

    def test_fingerprint_and_baseline_provenance(self):
        print_ = upgrade.fingerprint_of(self.old_path)
        self.assertEqual(print_['fingerprint'].split(':')[1], str(self.old_path.stat().st_size))
        self.assertEqual(print_['key'], upgrade.sha256(print_['fingerprint'].encode()))
        loaded = upgrade.load_baseline(self.baseline)
        self.assertEqual(loaded['summary']['hostVersion'], '6.0.6')
        self.assertEqual(set(loaded['summary']['files']), {'accepted.json', 'candidate.json', 'selectors.json'})
        for key, value in (('verdict', 'refused'), ('selectorSha256', 'x'), ('fingerprint', 'y:1:2')):
            broken = dict(self.accepted, **{key: value})
            path = self.directory / f'broken-{key}.json'
            path.write_text(json.dumps(broken))
            with self.assertRaises(Refusal):
                upgrade.assemble_baseline(path, self.sources, self.directory / f'baseline-{key}')
        with self.assertRaisesRegex(Refusal, 'baseline-output-exists'):
            upgrade.assemble_baseline(self.sources / 'accepted.json', self.sources, self.baseline)
        (self.baseline / 'selectors.json').write_bytes(self.selectors_bytes + b'\n')
        with self.assertRaisesRegex(Refusal, 'baseline-file-changed'):
            upgrade.load_baseline(self.baseline)

    def test_same_fingerprint_is_already_accepted(self):
        self.new_path.write_bytes(self.old_path.read_bytes())
        import os
        stat = self.old_path.stat()
        os.utime(self.new_path, ns=(stat.st_atime_ns, stat.st_mtime_ns))
        open_jar, _ = self.jars([])
        args = SimpleNamespace(baseline=self.baseline, jar=self.new_path, output=self.directory / 'same')
        report = upgrade.check(args)
        self.assertEqual(report['result'], 'already-accepted')
        self.assertEqual(list(report['stages']), ['fingerprint'])

    def test_name_only_change_resolves_and_writes_resources(self):
        report, output = self.run_check(self.renamed())
        self.assertEqual(report['result'], 'name-only-change')
        self.assertEqual(report['stages']['resolve']['source'], 'structural-resolver')
        self.assertEqual(report['stages']['body-change']['changed'], [])
        self.assertEqual(report['stages']['census']['status'], 'input-required')
        candidate = json.loads((output / 'candidate.json').read_text())
        self.assertEqual(candidate['types'], {'base': 'Base2', 'child': 'Child2', 'other': 'Other2'})
        self.assertEqual(candidate['members'][0]['name'], 'first2')
        self.assertEqual(candidate['selectorSha256'], self.candidate['selectorSha256'])
        self.assertEqual((output / 'selectors.json').read_bytes(), self.selectors_bytes)
        self.assertEqual(set(report['outputs']), {'selectors.json', 'candidate.json', 'body-change.json', 'upgrade.json'})

    def test_changed_body_is_reported(self):
        # A changed body changes the member trace, so the structural resolver refuses; a traced table continues.
        report, _ = self.run_check(self.renamed(code=bytes([4, 4, 96, 172])))
        self.assertEqual(report['result'], 'resolution-refused')
        traced = {'types': {'base': 'Base2', 'child': 'Child2', 'other': 'Other2'},
                  'members': [dict(self.candidate['members'][0], lookup='Child2', declaring='Base2', name='first2')]}
        path = self.directory / 'traced-changed.json'
        path.write_text(json.dumps(traced))
        report, output = self.run_check(self.renamed(code=bytes([4, 4, 96, 172])), traced_table=path)
        self.assertEqual(report['result'], 'changed-bodies')
        self.assertEqual(report['stages']['body-change']['changed'], [{'role': 'read', 'result': 'changed-body'}])
        body = json.loads((output / 'body-change.json').read_text())
        self.assertEqual(body['summary']['role:changed-body'], 1)
        self.assertFalse(body['writeAuthority'])

    def test_refusal_reports_the_type_census_and_accepts_a_traced_table(self):
        classes = self.renamed()
        classes[0] = Class('Base2', 'java/lang/Object', (), 1, [], classes[0].methods + [
            Member('method', 'added', '()V', 1, bytes([177]))])
        report, _ = self.run_check(classes)
        self.assertEqual(report['result'], 'resolution-refused')
        self.assertIn('expected-one-candidate', report['reason'])
        census = report['stages']['resolve']['typeCensus']
        self.assertEqual(census['missing'], ['base', 'child'])
        self.assertEqual(census['resolved'], ['other'])
        self.assertNotIn('body-change', report['stages'])
        self.assertIn('--traced-table', report['nextStep'])
        traced = {'types': {'base': 'Base2', 'child': 'Child2', 'other': 'Other2'},
                  'members': [dict(self.candidate['members'][0], lookup='Child2', declaring='Base2', name='first2')]}
        path = self.directory / 'traced.json'
        path.write_text(json.dumps(traced))
        report, output = self.run_check(classes, traced_table=path)
        self.assertEqual(report['result'], 'name-only-change')
        self.assertEqual(report['stages']['resolve']['source'], 'traced-table')
        self.assertEqual(report['stages']['resolve']['tracedTable']['memberRoles'], 1)
        self.assertFalse((output / 'candidate.json').exists(), 'a traced table is not a resolver candidate')
        wrong = copy.deepcopy(traced)
        wrong['members'][0]['flags'] = 9
        path.write_text(json.dumps(wrong))
        with self.assertRaisesRegex(Refusal, 'traced-table-member:read'):
            self.run_check(classes, traced_table=path)
        # The complete table is validated: missing types and a foreign receiver refuse before any later stage.
        for broken, reason in ((dict(traced, types={}), 'incomplete-table'),
                               ({'types': dict(traced['types'], child='Other2'), 'members': traced['members']},
                                'wrong-receiver|receiver-inheritance|aliased-type-roles'),
                               ({'types': traced['types'],
                                 'members': [dict(traced['members'][0], lookup='Absent2')]}, 'wrong-receiver')):
            path.write_text(json.dumps(broken))
            with self.assertRaisesRegex(Refusal, reason):
                self.run_check(classes, traced_table=path)

    def test_missing_old_jar_requires_input(self):
        self.old_path.rename(self.directory / 'moved.jar')
        try:
            open_jar, new = self.jars(self.renamed())
            original = upgrade.Jar
            upgrade.Jar = lambda path: new
            try:
                args = SimpleNamespace(baseline=self.baseline, jar=self.new_path, old_jar=None, traced_table=None,
                                       closure=None, output=self.directory / 'missing-old')
                report = upgrade.check(args)
            finally:
                upgrade.Jar = original
            self.assertEqual(report['result'], 'input-required')
            self.assertEqual(report['stages']['body-change']['status'], 'input-required')
        finally:
            (self.directory / 'moved.jar').rename(self.old_path)

    def test_body_change_stage_uses_the_shared_comparison(self):
        old_jar, old_id = model('A')
        new_jar, new_id = model('B', bytes([4, 172]), desc='()I')
        old_table = {'members': [{'role': 'r', 'kind': 'method', 'declaring': old_id[0], 'lookup': old_id[0],
                                  'name': old_id[1], 'descriptor': old_id[2], 'flags': 1}]}
        new_table = {'members': [dict(old_table['members'][0], declaring=new_id[0], lookup=new_id[0],
                                      name=new_id[1], descriptor=new_id[2])]}
        result = upgrade.body_change_stage(old_jar, new_jar, old_table, new_table)
        self.assertEqual(result['summary']['changed'], 1)
        self.assertEqual(result['changed'], [{'role': 'r', 'result': 'changed-body'}])

    def test_cli_refusal_exit_codes(self):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            code = upgrade.main(['check', '--baseline', str(self.baseline), '--jar', str(self.new_path),
                                 '--output', str(self.baseline)])
        self.assertEqual(code, 2)
        self.assertEqual(json.loads(out.getvalue())['reason'], 'upgrade-output-exists')


if __name__ == '__main__':
    unittest.main()
