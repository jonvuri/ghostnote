"""Test evidence refusal with synthetic records. No live factory calls."""
import copy
import json
import pathlib
import tempfile
import unittest
import uuid
import verify_factory_evidence as verifier


class FactoryEvidenceTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = pathlib.Path(self.temp.name)
        old = verifier.DATA
        self.addCleanup(setattr, verifier, 'DATA', old)
        verifier.DATA = self.root
        self.put(self.root, 'deployment-v8', {'deployedAtMs': 1, 'hostJarSha256': 'test-jar'})
        source = verifier.ROOT / 'context/evidence/data/phase9a-grid-read/live-28-after-reload/capture-0.json'
        self.live = json.loads(source.read_text())
        self.live.update(marker='9a-grid-factory-v8', jarSha256='test-jar')
        graph = self.live['graph']
        by_id = {n['id']: n for n in graph['nodes']}
        spare = by_id[verifier.prop(by_id[graph['root']], 6428)['refs'][3]]
        body = by_id[verifier.prop(spare, 406)['refs'][0]]
        ids = {spare['id'], body['id'], *verifier.prop(body, 173)['refs']}
        self.detached = copy.deepcopy(graph)
        self.detached['root'] = spare['id']
        self.detached['nodes'] = [copy.deepcopy(n) for n in graph['nodes'] if n['id'] in ids]
        self.folders = [self.make('first'), self.make('repeat')]

    @staticmethod
    def put(folder, name, value):
        (folder / f'{name}.json').write_text(json.dumps(value))

    def make(self, name):
        folder = self.root / name
        folder.mkdir()
        capture = copy.deepcopy(self.live)
        capture['epoch'] = name
        self.put(folder, 'entry', {'hello': {'runtimeProfile': 'phase-8-probe-v1', 'methodCount': 116,
                 'methodsHash': '14aacf5657eac6c2'}, 'rig': {'gridReadProbe': '9a-grid-factory-v8'},
                 'stats': {'initEpochMs': 2}, 'mark': {'project': 'gn-grid-spike'}, 'selection': {}})
        files = {'project': {'sha256': verifier.PROJECT_HASH}, 'preset': {'sha256': verifier.PRESET_HASH}}
        for key in ['files', 'files-after']:
            self.put(folder, key, files)
        self.put(folder, 'selection-after', {})
        for key in ['capture-0', 'capture-1', 'factory-readback-0', 'factory-readback-1']:
            self.put(folder, key, capture)
        detached = copy.deepcopy(self.detached)
        node = next(n for n in detached['nodes'] if n['id'] == detached['root'])
        verifier.prop(node, 15)['value']['data'] = str(uuid.uuid4())
        life = {key: True for key in ['factoryAttempted', 'factoryReturned', 'ownershipProved',
                  'initializationHelpersPresent', 'disposeAttempted', 'disposalVerified']}
        life.update(stage='complete', ownedObjects=8, capture0=detached, capture1=detached,
                    factoryNanos=100, disposalNanos=100)
        capture.update(lifecycle=life, writeStatus='detached-disposed; fresh fixture read required',
                       writeAttempted=True, operationId=name, documentTaskNanos=1000,
                       queueNanos=1, completionNanos=1001, heapUsedBefore=100, heapUsedAfter=200)
        self.put(folder, 'factory-command', capture)
        calls = [{'method': method, 'ms': 24} for method in verifier.CALLS]
        self.put(folder, 'calls', {'calls': calls, 'sequentialWireCalls': 18})
        return folder

    def test_synthetic_pair(self):
        self.assertEqual(verifier.verify(*self.folders)['factoryGate'], 'passed')

    def test_refuse_missing_cleanup_changed_defaults_reused_identity_and_live_delta(self):
        folder = self.folders[1]
        original = verifier.read(folder, 'factory-command')
        for mode in ['cleanup', 'defaults', 'uuid', 'live', 'marker']:
            with self.subTest(mode=mode):
                changed = copy.deepcopy(original)
                if mode == 'cleanup':
                    changed['lifecycle']['disposalVerified'] = False
                elif mode in ['defaults', 'uuid']:
                    for key in ['capture0', 'capture1']:
                        graph = changed['lifecycle'][key]
                        node = next(n for n in graph['nodes'] if n['id'] == graph['root'])
                        if mode == 'defaults':
                            verifier.prop(node, 6679)['value']['data'] = 100
                        else:
                            first = verifier.read(self.folders[0], 'factory-command')['lifecycle']['capture0']
                            verifier.prop(node, 15)['value']['data'] = verifier.detached(first)[0]
                elif mode == 'live':
                    changed['graph']['complete'] = False
                else:
                    changed['marker'] = 'old'
                self.put(folder, 'factory-command', changed)
                with self.assertRaises(AssertionError):
                    verifier.verify(*self.folders)
        self.put(folder, 'factory-command', original)

    def test_refuse_same_call_twice(self):
        with self.assertRaises(AssertionError):
            verifier.verify(self.folders[0], self.folders[0])


if __name__ == '__main__':
    unittest.main()
