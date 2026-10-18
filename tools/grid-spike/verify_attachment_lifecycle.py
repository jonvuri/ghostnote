#!/usr/bin/env python3
"""Check V11 attachment, undo, reload, and restoration records. No live calls."""
import copy
import json
from verify_attachment_evidence import DATA, ROOT, read, verify
from verify_factory_evidence import PROJECT_HASH, PRESET_HASH
from read_semantics import derive, compare_preset


def semantic(capture):
    result = derive(capture)
    result.pop('moduleUuids')
    return result


def witness(capture):
    result = copy.deepcopy(capture['witness'])
    ids = result['moduleUuids']
    assert len(ids) == len(set(ids)) == len(result['rectangles'])
    assert [r['uuid'] for r in result['rectangles']] == ids
    assert result['selection'] == {'selected': []}
    result['moduleUuids'] = list(range(len(ids)))
    for i, rectangle in enumerate(result['rectangles']):
        rectangle['uuid'] = i
    return result


def compare(capture, expected, reloaded=False):
    graph = capture['graph']
    assert graph['complete'] and graph['errorCount'] == 0
    assert semantic(capture) == semantic(expected)
    if reloaded:
        assert witness(capture) == witness(expected)
    else:
        assert graph['nodes'] == expected['graph']['nodes']
        assert capture['witness'] == expected['witness']


def measurements():
    deployment = read(DATA, 'deployment-v11')
    first, repeat = DATA / 'live-94-v11-first', DATA / 'live-98-v11-repeat'
    attached = [verify(p, deployment) for p in [first, repeat]]
    for key in ['uuid', 'epoch', 'operationId']:
        assert attached[0][key] != attached[1][key]
    for folder, row in zip([first, repeat], attached):
        command = read(folder, 'attach-command')
        row.update(commandWireMs=read(folder, 'calls')['calls'][13]['ms'],
                   documentMs=command['documentTaskNanos'] / 1e6,
                   queueMs=command['queueNanos'] / 1e6)
    before = read(first, 'capture-0')
    first_after, repeat_after = [read(p, 'attach-readback-0') for p in [first, repeat]]
    stages = [
        ('live-95-v11-undo-first', before, False),
        ('live-96-v11-redo-first', first_after, False),
        ('live-97-v11-repeat-baseline', before, False),
        ('live-99-v11-saved', repeat_after, False),
        ('live-100-v11-reloaded', repeat_after, True),
        ('live-101-v11-restored', before, True),
        ('live-103-v11-read-repeat', read(DATA / 'live-101-v11-restored', 'capture-0'), False),
    ]
    workflows, captures = [], []
    for name, expected, reloaded in stages:
        folder = DATA / name
        entry, calls = read(folder, 'entry'), read(folder, 'calls')
        assert entry['mark']['project'] == 'gn-grid-spike'
        assert entry['hello']['methodsHash'] == 'b899e5d3d75a791d'
        assert entry['stats']['initEpochMs'] == read(first, 'entry')['stats']['initEpochMs']
        assert entry['selection'] == read(folder, 'selection-after')
        assert read(folder, 'files')['preset']['sha256'] == PRESET_HASH
        assert calls['sequentialWireCalls'] == len(calls['calls']) == 15
        assert not any('error' in c for c in calls['calls'])
        assert calls['calls'][-1]['method'] == 'probe.gridRead'
        workflows.append(dict(folder=name, calls=15, wireMs=sum(c['ms'] for c in calls['calls'])))
        pair = [read(folder, n) for n in ['capture-0', 'capture-1']]
        for capture in pair:
            assert capture['marker'] == '9a-grid-attachment-v11'
            assert capture['jarSha256'] == deployment['hostJarSha256']
            compare(capture, expected, reloaded)
        assert pair[0]['graph']['nodes'] == pair[1]['graph']['nodes']
        assert pair[0]['witness'] == pair[1]['witness']
        captures.extend(pair)
    for name, action in [('undo-first-v11', 'undo'), ('redo-first-v11', 'redo'),
                         ('undo-before-repeat-v11', 'undo')]:
        result = read(DATA, name)
        assert result['action'] == action
        calls = result['calls']
        assert [c['method'] for c in calls] == ['revision.get', 'probe.gridRead', 'app.undoState', 'app.' + action]
        assert calls[0]['result']['project'] == 'gn-grid-spike'
        assert calls[1]['result']['writeLocked'] is False
        assert calls[1]['result']['nativeUnfinished'] is False
        assert calls[3]['result'][action + 'sPerformed'] == 1
    restore = read(DATA, 'baseline-restore-v11')
    assert restore['fixtureClosedObserved'] is True
    assert restore['after'] == dict(bytes=34128, sha256=PROJECT_HASH)
    for stage in ['live-99-v11-saved', 'live-100-v11-reloaded']:
        saved = read(DATA / stage, 'files')['project']
        assert {k: saved[k] for k in ['bytes', 'sha256']} == restore['before']
    assert restore['before']['sha256'] != PROJECT_HASH
    assert read(DATA / 'live-101-v11-restored', 'files')['project']['sha256'] == PROJECT_HASH
    compare_preset(derive(read(DATA / 'live-101-v11-restored', 'capture-0')),
                   read(ROOT / 'context/evidence/data/phase9a-grid-read', 'preset-baseline'))
    outer = DATA / 'live-102-v11-outer'
    original = read(ROOT / 'context/evidence/data/phase9a-grid-delete/live-85-outer-identity', 'capture-0')
    for name in ['capture-0', 'capture-1']:
        assert read(outer, name)['graph']['nodes'] == original['graph']['nodes']
    assert read(outer, 'entry')['selection'] == read(outer, 'selection-after')
    status = read(DATA, 'exit-v11-live')['status']
    assert status['factoryAttempts'] == 2 and status['afterReads'] == 2
    assert not status['writeLocked'] and not status['nativeUnfinished'] and not status['recoveryUsed']
    for folder in [first, repeat]:
        captures.extend(read(folder, name) for name in
                        ['capture-0', 'capture-1', 'attach-readback-0', 'attach-readback-1'])
    return dict(savedEvidenceGate='passed', attachments=attached, readWorkflows=workflows,
                nativeReadCount=len(captures),
                readDocumentMs=[min(c['documentTaskNanos'] / 1e6 for c in captures),
                                max(c['documentTaskNanos'] / 1e6 for c in captures)],
                graphBytes=sorted(set(c['graph']['encodedBytes'] for c in captures)),
                graphWork=sorted(set(c['graph']['work'] for c in captures)),
                queryWork=sorted(set(c['queryWork'] for c in captures)),
                readHeapSampleDelta=sorted(set(c['heapUsedAfter'] - c['heapUsedBefore'] for c in captures)),
                uiEvidence='Separate observations are recorded in ui-witness-v11-live.json.',
                limits='No DSP adoption, cold-cache bound, or general failure atomicity claim.')


if __name__ == '__main__':
    print(json.dumps(measurements(), indent=2))
