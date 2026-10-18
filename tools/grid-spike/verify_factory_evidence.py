#!/usr/bin/env python3
"""Verify two V8 detached factory calls. This program makes no live calls."""
import argparse
import copy
import json
import pathlib
from read_semantics import derive, compare_preset

ROOT = pathlib.Path(__file__).resolve().parents[2]
DATA = ROOT / 'context/evidence/data/phase9a-grid-factory'
PROJECT_HASH = 'af24056e72e9722eacaa80bf01daa02e7fba0c72103f7fd1655f689448da1b4f'
CALLS = ['contract.hello', 'rig.info', 'rig.stats', 'host.info', 'revision.get', 'selection.status',
         'track.list', 'cursor.pointTrack', 'devcursor.status', 'device.list',
         'probe.gridRead', 'probe.gridRead', 'probe.gridRead', 'probe.gridModuleFactory',
         'probe.gridRead', 'probe.gridRead', 'selection.status', 'probe.gridRead']
PRESET_HASH = '1e8f90fc3875dbeb1f38ed88bec59ee783f39bb00fb366194c79504e063c0cc9'


def prop(node, key):
    matches = [p for p in node['properties'] if p['id'] == key]
    assert len(matches) == 1
    return matches[0]


def detached(graph):
    assert graph['complete'] and graph['errorCount'] == 0 and not graph['errors']
    nodes = {n['id']: n for n in graph['nodes']}
    assert len(nodes) == len(graph['nodes']) == 8
    root = nodes[graph['root']]
    assert root['className'] == 'module'
    assert root['runtimeClass'] == 'com.bitwig.flt.document.core.master.device.DbL'
    uuid = prop(root, 15)['value']['data']
    assert prop(root, 404)['value']['data'] == 'Amplify'
    contents = prop(root, 406)
    assert contents['count'] == len(contents['refs']) == 1
    body = nodes[contents['refs'][0]]
    assert body['className'] == 'module_contents'
    assert prop(body, 6369)['value']['data'] == 'a6cd650b-c4de-46c6-8741-c07a0a9bfec2'
    atoms = prop(body, 173)
    assert atoms['count'] == len(atoms['refs']) == len(set(atoms['refs'])) == 6
    assert set(nodes) == {root['id'], body['id'], *atoms['refs']}
    for node in nodes.values():
        for field in node['properties']:
            if field['kind'] == 'relationship':
                assert field['count'] == len(field['refs'])
                assert all(ref in nodes for ref in field['refs'])
        if node['className'] == 'audio_destination_atom':
            assert not prop(node, 7125)['refs']
    defaults = copy.deepcopy(graph['nodes'])
    prop(next(n for n in defaults if n['id'] == graph['root']), 15)['value']['data'] = '<new-instance>'
    return uuid, defaults


def read(folder, name):
    return json.loads((folder / f'{name}.json').read_text())


def verify(first, repeat):
    assert first.resolve() != repeat.resolve()
    preset = json.loads((ROOT / 'context/evidence/data/phase9a-grid-read/preset-baseline.json').read_text())
    deployment = read(DATA, 'deployment-v8')
    rows, defaults, uuids, epochs, operations = [], [], [], [], []
    initial = None
    for folder in [first, repeat]:
        entry, before, command = read(folder, 'entry'), read(folder, 'capture-0'), read(folder, 'factory-command')
        assert entry['hello']['runtimeProfile'] == 'phase-8-probe-v1'
        assert entry['hello']['methodCount'] == 116 and entry['hello']['methodsHash'] == '14aacf5657eac6c2'
        assert entry['rig']['gridReadProbe'] == '9a-grid-factory-v8'
        assert entry['stats']['initEpochMs'] > deployment['deployedAtMs']
        assert entry['mark']['project'] == 'gn-grid-spike'
        assert entry['selection'] == read(folder, 'selection-after')
        files = read(folder, 'files')
        assert files == read(folder, 'files-after')
        assert files['project']['sha256'] == PROJECT_HASH and files['preset']['sha256'] == PRESET_HASH
        compare_preset(derive(before), preset)
        if initial is None:
            initial = before['graph']['nodes']
        assert before['graph']['nodes'] == initial
        for name in ['capture-1', 'factory-command', 'factory-readback-0', 'factory-readback-1']:
            capture = read(folder, name)
            derive(capture)
            assert capture['graph']['nodes'] == initial
            assert capture['epoch'] == before['epoch']
            assert capture['marker'] == '9a-grid-factory-v8'
            assert capture['jarSha256'] == deployment['hostJarSha256']
        life = command['lifecycle']
        assert command['writeStatus'] == 'detached-disposed; fresh fixture read required'
        assert command['writeAttempted'] is True and life['stage'] == 'complete'
        for key in ['factoryAttempted', 'factoryReturned', 'ownershipProved',
                    'initializationHelpersPresent', 'disposeAttempted', 'disposalVerified']:
            assert life[key] is True
        assert 8 <= life['ownedObjects'] <= 256
        uuid, native = detached(life['capture0'])
        assert detached(life['capture1']) == (uuid, native)
        assert uuid not in derive(before)['moduleUuids']
        defaults.append(native); uuids.append(uuid); epochs.append(before['epoch']); operations.append(command['operationId'])
        calls = read(folder, 'calls')
        assert calls['sequentialWireCalls'] == len(calls['calls']) == 18
        assert not any('error' in call for call in calls['calls'])
        assert [call['method'] for call in calls['calls']] == CALLS
        writes = [c for c in calls['calls'] if c['method'] == 'probe.gridModuleFactory']
        assert len(writes) == 1 and calls['calls'][-1]['method'] == 'probe.gridRead'
        rows.append({'folder': folder.name, 'moduleUuid': uuid, 'ownedObjects': life['ownedObjects'],
                     'wireMs': writes[0]['ms'], 'workflowWireMs': sum(c['ms'] for c in calls['calls']),
                     'factoryMs': life['factoryNanos'] / 1e6, 'disposalMs': life['disposalNanos'] / 1e6,
                     'documentMs': command['documentTaskNanos'] / 1e6,
                     'queueMs': command['queueNanos'] / 1e6, 'completionMs': command['completionNanos'] / 1e6,
                     'heapSampleDelta': command['heapUsedAfter'] - command['heapUsedBefore'],
                     'detachedBytes': [life[f'capture{i}']['encodedBytes'] for i in range(2)]})
    assert len(set(uuids)) == len(set(epochs)) == len(set(operations)) == 2
    assert defaults[0] == defaults[1]
    return {'factoryGate': 'passed', 'scope': 'detached Amplify only; live attachment is unproved',
            'cacheLimit': 'repeat defaults agree after disposal; no cache reset or cold-cache claim',
            'heapLimit': 'samples only; peak and retained heap are unmeasured', 'calls': rows}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('first', type=pathlib.Path)
    parser.add_argument('repeat', type=pathlib.Path)
    args = parser.parse_args()
    print(json.dumps(verify(args.first, args.repeat), indent=2))
