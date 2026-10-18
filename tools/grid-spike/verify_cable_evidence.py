#!/usr/bin/env python3
"""Verify the saved V5 cable sequence and report its measurements. No live calls."""
import copy
import json
import pathlib
from read_semantics import derive, compare_preset

DATA = pathlib.Path(__file__).resolve().parents[2] / 'context/evidence/data/phase9a-grid-cables'
STAGES = [
    'live-41-baseline', 'live-42-connect', 'live-43-disconnect',
    'live-44-undo-disconnect', 'live-45-redo-disconnect', 'live-46-connect-repeat',
    'live-47-undo-connect', 'live-48-redo-connect', 'live-49-saved-connected',
    'live-50-reloaded-connected', 'live-51-restore', 'live-52-saved-baseline',
    'live-53-final-reload', 'live-55-read-timing-repeat',
]
CHANGES = {1: (False, True), 2: (True, False), 5: (False, True), 10: (True, False)}
CONNECTED = {3, 7, 8, 9}
READ_DATA = DATA.with_name('phase9a-grid-read')


def read(stage, name):
    return json.loads((DATA / stage / f'{name}.json').read_text())


def nodes(capture):
    derive(capture)
    return capture['graph']['nodes']


def semantic(capture):
    result = derive(capture)
    result.pop('moduleUuids')
    return result


def verify():
    preset = json.loads((READ_DATA / 'preset-baseline.json').read_text())
    baseline = read(STAGES[0], 'capture-0')
    compare_preset(derive(baseline), preset)
    disconnected = semantic(baseline)
    connected = copy.deepcopy(disconnected)
    connected['cables'].append({'sourceModule': '0', 'sourcePort': 'OUT',
                                'destinationModule': '3', 'destinationPort': 'IN'})
    rows, workflows = [], []
    for index, stage in enumerate(STAGES):
        before = read(stage, 'capture-0')
        assert nodes(before) == nodes(read(stage, 'capture-1'))
        entry, calls = read(stage, 'entry'), read(stage, 'calls')
        assert entry['hello']['methodsHash'] == '9dc11c1f9958f4d8'
        assert entry['rig']['gridReadProbe'] == '9a-grid-cable-v5'
        assert entry['mark']['project'] == 'gn-grid-spike'
        assert entry['selection'] == read(stage, 'selection-after')
        assert not any('error' in call for call in calls['calls'])
        assert calls['calls'][-1]['method'] == 'probe.gridRead'
        assert read(stage, 'devices') == read(STAGES[0], 'devices')
        assert read(stage, 'files')['preset'] == read(STAGES[0], 'files')['preset']
        captures = ['capture-0', 'capture-1']
        if index in CHANGES:
            old, new = CHANGES[index]
            assert semantic(before) == (connected if old else disconnected)
            command = read(stage, 'cable-command')
            assert command['writeAttempted'] is True
            assert command['writeStatus'] == 'command-returned; fresh read required'
            assert command['readbackStatus'] == 'not-attempted'
            assert nodes(command) == nodes(before)
            expected = copy.deepcopy(nodes(before))
            by_id = {n['id']: n for n in expected}
            def prop(node, key):
                return next(p for p in node['properties'] if p['id'] == key)
            modules = prop(by_id[before['graph']['root']], 6428)['refs']
            def atoms(index):
                contents = prop(by_id[modules[index]], 406)['refs'][0]
                return prop(by_id[contents], 173)['refs']
            source, destination = atoms(0)[2], atoms(3)[3]
            edge = prop(by_id[destination], 7125)
            assert edge['refs'] == ([source] if old else [])
            edge['refs'] = [source] if new else []
            edge['count'] = len(edge['refs'])
            for run in range(2):
                after = read(stage, f'cable-readback-{run}')
                assert nodes(after) == expected
                assert semantic(after) == (connected if new else disconnected)
            captures += ['cable-command', 'cable-readback-0', 'cable-readback-1']
        else:
            assert semantic(before) == (connected if index in CONNECTED else disconnected)
        expected_calls = 18 if index in CHANGES else 15
        assert calls['sequentialWireCalls'] == len(calls['calls']) == expected_calls
        graph_calls = [c for c in calls['calls'] if c['method'] in ('probe.gridRead', 'probe.gridCable')][1:-1]
        assert len(graph_calls) == len(captures)
        for name, call in zip(captures, graph_calls):
            capture = read(stage, name)
            rows.append({'stage': stage, 'capture': name, 'method': call['method'],
                         'wireMs': call['ms'], 'wireBytes': call['bytes'],
                         'queueMs': capture['queueNanos'] / 1e6,
                         'documentMs': capture['documentTaskNanos'] / 1e6,
                         'completionMs': capture['completionNanos'] / 1e6,
                         'graphBytes': capture['graph']['encodedBytes'],
                         'graphWork': capture['graph']['work'], 'queryWork': capture['queryWork'],
                         'nodes': len(capture['graph']['nodes']),
                         'heapSampleDeltaBytes': capture['heapUsedAfter'] - capture['heapUsedBefore']})
        workflows.append({'stage': stage, 'wireCalls': expected_calls,
                          'sumWireMs': sum(c['ms'] for c in calls['calls'])})
    for undo_or_redo, reference, name in [(3, 1, 'cable-readback-0'), (4, 0, 'capture-0'),
                                          (6, 0, 'capture-0'), (7, 5, 'cable-readback-0')]:
        assert nodes(read(STAGES[undo_or_redo], 'capture-0')) == nodes(read(STAGES[reference], name))
    for before, after in [(8, 9), (11, 12)]:
        a, b = derive(read(STAGES[before], 'capture-0')), derive(read(STAGES[after], 'capture-0'))
        assert a.pop('moduleUuids') != b.pop('moduleUuids')
        assert a == b
        assert read(STAGES[before], 'files') == read(STAGES[after], 'files')
    compare_preset(derive(read(STAGES[-1], 'capture-0')), preset)
    outer_before = json.loads((READ_DATA / 'live-40-v4-host-identity/capture-0.json').read_text())['graph']['nodes']
    outer_after = read('live-54-outer-identity', 'capture-0')['graph']['nodes']
    assert outer_before == outer_after
    return {'result': 'pass', 'writes': 4, 'undoConnectAndDisconnect': 'pass', 'redoConnectAndDisconnect': 'pass',
            'editedReload': 'pass', 'restoredReload': 'pass', 'outerIdentity': 'equal',
            'scope': 'saved semantic projection; no DSP or complete device-state claim',
            'heapLimit': 'samples only; not peak or retained heap',
            'workflows': workflows, 'captures': rows}


if __name__ == '__main__':
    print(json.dumps(verify(), indent=2))
