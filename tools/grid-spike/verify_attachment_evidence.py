#!/usr/bin/env python3
"""Check saved V11 attachment evidence. This program makes no live calls."""
import argparse
import copy
import json
import pathlib
from verify_factory_evidence import detached, prop, read, PROJECT_HASH, PRESET_HASH, ROOT
from read_semantics import derive, compare_preset

DATA = ROOT / 'context/evidence/data/phase9a-grid-attachment'
CALLS = ['contract.hello', 'rig.info', 'rig.stats', 'host.info', 'revision.get', 'selection.status',
         'track.list', 'cursor.pointTrack', 'devcursor.status', 'device.list', 'probe.gridRead',
         'probe.gridRead', 'probe.gridRead', 'probe.gridModuleAttach', 'probe.gridRead',
         'probe.gridRead', 'selection.status', 'probe.gridRead']


def expected(before, command):
    life = command['lifecycle']
    assert life['stage'] == 'complete' and life['uncertain'] is False
    for key in ['factoryAttempted', 'factoryReturned', 'ownershipProved', 'initializationHelpersPresent',
                'editStartAttempted', 'editStartReturned', 'editAdmitted', 'editOwned', 'insertionAttempted',
                'insertionReturned', 'closeAttempted', 'closeReturned', 'closeAccepted', 'editClosed']:
        assert life[key] is True, key
    assert life['disposeAttempted'] is False and life['disposalVerified'] is False
    assert life['ownedObjects'] == 77
    uuid, defaults = detached(life['capture0'])
    assert detached(life['capture1']) == (uuid, defaults)
    reference = read(ROOT / 'context/evidence/data/phase9a-grid-factory/live-87-factory-first', 'factory-command')
    assert defaults == detached(reference['lifecycle']['capture0'])[1]
    managed_id = life['attached']['managedObjectId']
    assert type(managed_id) is int and 0 < managed_id <= 0x7fffffff
    assert life['attached']['managedObjectRegistered'] is True
    assert not any(p['id'] == 14 and int(p['value']['data']) == managed_id
                   for n in before['graph']['nodes'] for p in n['properties'])
    nodes = copy.deepcopy(before['graph']['nodes'])
    assert len(nodes) == 53 and [n['id'] for n in nodes] == list(range(53))
    membership = prop(nodes[before['graph']['root']], 6428)
    assert len(membership['refs']) == 4
    assert uuid not in [prop(nodes[i], 15)['value']['data'] for i in membership['refs']]
    membership['refs'].append(53)
    membership['count'] = 5
    for n in copy.deepcopy(life['capture0']['nodes']):
        n['id'] += 53
        for p in n['properties']:
            if 'refs' in p:
                p['refs'] = [i + 53 for i in p['refs']]
        if n['id'] == 53:
            prop(n, 6679)['value']['data'] = '2'
        if n['id'] == 59:
            prop(n, 14)['value']['data'] = str(managed_id)
        nodes.append(n)
    witness = copy.deepcopy(before['witness'])
    attached = life['attached']
    assert attached['uuid'] == uuid and attached['parentsVerified'] and attached['selectionUnchanged']
    rect = attached['rectangle']
    assert rect['uuid'] == uuid and (rect['x'], rect['y']) == (2, 0)
    witness['moduleUuids'].append(uuid)
    witness['rectangles'].append(rect)
    assert witness['parentsVerified'] is True
    assert witness['edit'] == dict(frames=0, instant=0, longer=0, locks=0, lockSet=False, active=False)
    assert len(witness['rectangles']) == 5
    for r in witness['rectangles']:
        assert 1 <= r['width'] <= 8 and 1 <= r['height'] <= 8
    for i, a in enumerate(witness['rectangles']):
        for b in witness['rectangles'][i + 1:]:
            assert not (a['x'] < b['x'] + b['width'] and b['x'] < a['x'] + a['width']
                        and a['y'] < b['y'] + b['height'] and b['y'] < a['y'] + a['height'])
    return uuid, nodes, witness


def verify(folder, deployment):
    entry, before, command = read(folder, 'entry'), read(folder, 'capture-0'), read(folder, 'attach-command')
    assert entry['hello']['runtimeProfile'] == 'phase-8-probe-v1'
    assert entry['hello']['methodCount'] == 117 and entry['hello']['methodsHash'] == 'b899e5d3d75a791d'
    assert entry['rig']['gridReadProbe'] == '9a-grid-attachment-v11'
    assert entry['stats']['initEpochMs'] > deployment['deployedAtMs']
    assert entry['revision']['project'] == 'gn-grid-spike'
    assert entry['selection'] == read(folder, 'selection-after')
    files = read(folder, 'files')
    assert files == read(folder, 'files-after')
    assert files['project']['sha256'] == files['backup']['sha256'] == PROJECT_HASH
    assert files['preset']['sha256'] == PRESET_HASH
    assert read(folder, 'ui-entry')['engineInactive'] is True
    preset = read(ROOT / 'context/evidence/data/phase9a-grid-read', 'preset-baseline')
    compare_preset(derive(before), preset)
    for name in ['capture-1', 'attach-command']:
        value = read(folder, name)
        assert value['graph']['nodes'] == before['graph']['nodes'] and value['witness'] == before['witness']
    uuid, nodes, witness = expected(before, command)
    for name in ['attach-readback-0', 'attach-readback-1']:
        value = read(folder, name)
        derive(value)
        assert value['graph']['complete'] and value['graph']['errorCount'] == 0
        assert value['graph']['nodes'] == nodes and value['witness'] == witness
    for name in ['capture-0', 'capture-1', 'attach-command', 'attach-readback-0', 'attach-readback-1']:
        value = read(folder, name)
        assert value['epoch'] == before['epoch'] and value['marker'] == '9a-grid-attachment-v11'
        assert value['jarSha256'] == deployment['hostJarSha256']
    calls = read(folder, 'calls')
    assert calls['sequentialWireCalls'] == 18 and [c['method'] for c in calls['calls']] == CALLS
    assert not any('error' in c for c in calls['calls'])
    life = command['lifecycle']
    return dict(folder=folder.name, uuid=uuid, epoch=before['epoch'], operationId=command['operationId'],
                workflowWireMs=sum(c['ms'] for c in calls['calls']),
                nativeMs={s: life[s + 'Nanos'] / 1e6 for s in ['factory', 'start', 'insertion', 'close']},
                heapSampleDelta=command['heapUsedAfter'] - command['heapUsedBefore'])


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('first', type=pathlib.Path)
    parser.add_argument('repeat', type=pathlib.Path)
    args = parser.parse_args()
    assert args.first.resolve() != args.repeat.resolve()
    rows = [verify(p, read(DATA, 'deployment-v11')) for p in [args.first, args.repeat]]
    for field in ['uuid', 'epoch', 'operationId']:
        assert rows[0][field] != rows[1][field]
    print(json.dumps(dict(readbackGate='passed', calls=rows,
                         remaining='UI, undo/redo, saved-state reload, and exact baseline restoration'), indent=2))
