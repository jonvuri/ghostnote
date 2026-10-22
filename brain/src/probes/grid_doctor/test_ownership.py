"""Check bounded diagnostic evidence and preserve refusal boundaries."""
import copy
import json
import os
from pathlib import Path
import struct
import tempfile
import unittest

from grid_symbols.scan import Jar, Member, Refusal, parse
from .ownership import TraceLimits, bootstraps, constant, method_trace, scan, validate_seed, write_report

ROOT = Path(__file__).resolve().parents[4]
SEED = ROOT / 'context/evidence/data/phase9b-doctor/614-structural/migration.json'
EXPAND = ['dgJ', 'cQy', 'cQz', 'eTi', 'com/bitwig/ramona/core/zjj',
          'dfb', 'com/bitwig/ramona/core/oDc', 'com/bitwig/ramona/core/bnq']


def bootstrap_class(duplicate=False):
    # A class file with one method handle, one dynamic constant, and no code.
    cp = [(1, 'Owner'), (7, 1), (1, 'java/lang/Object'), (7, 3),
          (1, 'BootstrapMethods'), (1, 'callback'), (1, '()V'), (12, (6, 7)),
          (10, (2, 8)), (15, (6, 9)), (18, (0, 8))]
    data = bytearray(struct.pack('>IHHH', 0xcafebabe, 0, 61, len(cp) + 1))
    for tag, value in cp:
        data.append(tag)
        if tag == 1:
            encoded = value.encode()
            data += struct.pack('>H', len(encoded)) + encoded
        elif tag in (7, 8, 16):
            data += struct.pack('>H', value)
        elif tag == 15:
            data += struct.pack('>BH', *value)
        else:
            data += struct.pack('>HH', *value)
    data += struct.pack('>HHHHHHH', 1, 2, 4, 0, 0, 0, 2 if duplicate else 1)
    attribute = struct.pack('>HHH', 1, 10, 0)
    for _ in range(2 if duplicate else 1):
        data += struct.pack('>HI', 5, len(attribute)) + attribute
    return bytes(data)


class OwnershipUnitTests(unittest.TestCase):
    def test_bootstrap_identity_and_dynamic_index_are_retained(self):
        data = bootstrap_class()
        cls = parse(data, True)
        self.assertEqual(constant(cls, 11), {'tag': 18, 'bootstrapIndex': 0,
                                           'name': 'callback', 'descriptor': '()V'})
        rows = bootstraps(data, cls)
        self.assertEqual(rows, [{'handle': {'tag': 15, 'kind': 6, 'target': {
            'tag': 10, 'owner': 'Owner', 'name': 'callback', 'descriptor': '()V'}}, 'arguments': []}])

    def test_missing_bootstrap_refuses_method_trace(self):
        data = bootstrap_class()
        cls = parse(data, True)
        method = Member('method', 'run', '()V', 1, bytes([186, 0, 11, 0, 0, 177]))
        class Source:
            def read(self, _):
                return data
        class Model:
            zip = Source()
        with self.assertRaisesRegex(Refusal, 'missing-bootstrap'):
            method_trace(Model(), cls, method, [])

    def test_duplicate_and_truncated_attributes_refuse(self):
        data = bootstrap_class(True)
        with self.assertRaisesRegex(Refusal, 'duplicate-bootstrap'):
            bootstraps(data, parse(data, True))
        data = bootstrap_class()
        with self.assertRaisesRegex(Refusal, 'truncated-class'):
            bootstraps(data[:-1], parse(data, True))

    def test_report_limit_and_exclusive_creation_preserve_existing_bytes(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'report.json'
            with self.assertRaisesRegex(Refusal, 'report-limit'):
                write_report(path, {'result': 'refused'}, TraceLimits(report_bytes=1))
            self.assertFalse(path.exists())
            path.write_bytes(b'preserve')
            with self.assertRaises(FileExistsError):
                write_report(path, {'result': 'refused'}, TraceLimits())
            self.assertEqual(path.read_bytes(), b'preserve')

    def test_seed_jar_mismatch_refuses_before_any_code_read(self):
        class WrongJar:
            sha256 = 'different'
        with self.assertRaisesRegex(Refusal, 'seed-jar-hash'):
            validate_seed(WrongJar(), {'inputs': [{}, {'sha256': 'expected'}]})


@unittest.skipUnless(os.environ.get('GRID_NEW_SYMBOL_JAR'), 'Set GRID_NEW_SYMBOL_JAR for offline integration.')
class OwnershipIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.jar = Jar(Path(os.environ['GRID_NEW_SYMBOL_JAR']))
        cls.seed = json.loads(SEED.read_text())
        cls.report = scan(cls.jar, cls.seed, EXPAND)

    @classmethod
    def tearDownClass(cls):
        cls.jar.close()

    def test_complete_jar_census_stays_diagnostic(self):
        self.assertEqual(self.report['work']['classes'], self.jar.stats['classes'])
        self.assertEqual(self.report['work']['methods'], sum(len(c.methods) for c in self.jar.classes.values()))
        self.assertFalse(self.report['completeTable'])
        self.assertFalse(self.report['writeAuthority'])
        self.assertEqual(self.report['result'], 'refused')

    def test_seed_trace_changes_and_unlinked_expansion_refuse(self):
        seed = copy.deepcopy(self.seed)
        seed['disposal']['new']['flags'] ^= 1
        with self.assertRaisesRegex(Refusal, 'seed-trace-disagreement'):
            validate_seed(self.jar, seed)
        with self.assertRaisesRegex(Refusal, 'unlinked-expansion'):
            scan(self.jar, self.seed, ['missing'])

    def test_work_limits_refuse(self):
        for key in ('methods', 'instructions', 'sites', 'traces'):
            with self.subTest(key=key), self.assertRaisesRegex(Refusal, key + '-limit'):
                scan(self.jar, self.seed, limits=TraceLimits(**{key: 0}))

    def test_mode_writers_and_debug_caller_are_in_census(self):
        writes = [s for s in self.report['directSites'] if s['opcode'] == 179 and
                  s['target']['owner'] == 'thz' and s['target']['name'] == 'Hnt']
        self.assertEqual({(s['caller'], s['method']) for s in writes}, {('thz', 'cfM'), ('thz', 'MRY')})
        callers = [s for s in self.report['directSites'] if s['target']['owner'] == 'thz' and
                   s['target']['descriptor'] == '()V' and s['caller'] != 'thz']
        self.assertEqual({s['caller'] for s in callers}, {'com/bitwig/flt/app/agent_debug/tfK'})
        drain = next(m for m in self.report['methods'] if m['owner'] == 'thz' and m['name'] == 'IwV')
        self.assertIn({'offset': 21, 'opcode': 167, 'target': 0}, drain['branches'])

    def test_set_census_covers_constructors_and_all_three_hooks(self):
        sites = [s for s in self.report['directSites'] if s['target']['owner'] == 'dfI' and
                 s['target']['name'] == 'dnz' and s['target']['tag'] == 9]
        self.assertEqual(len(sites), 8)
        self.assertEqual({s['method'] for s in sites}, {'<init>', 'aboutToInsertItem',
                         'aboutToRemoveItem', 'aboutToChangeOneToOneRelationship'})
        self.assertEqual(sum(s['opcode'] == 181 for s in sites), 2)

    def test_cleanup_bootstrap_points_to_traced_predicate(self):
        cleanup = next(m for m in self.report['methods'] if m['owner'] == 'dgJ' and m['name'] == 'FzB')
        dynamic = next(i for i in cleanup['instructions'] if i['opcode'] == 186)
        self.assertEqual(dynamic['constant']['tag'], 18)
        handle = dynamic['bootstrap']['arguments'][1]
        self.assertEqual(handle['kind'], 6)
        target = handle['target']
        self.assertEqual((target['owner'], target['name']), ('dgJ', 'cfM'))
        self.assertTrue(any((m['owner'], m['name'], m['descriptor']) ==
                            (target['owner'], target['name'], target['descriptor'])
                            for m in self.report['methods']))
        self.assertEqual(cleanup['exceptionHandlers'], [])


if __name__ == '__main__':
    unittest.main()
