#!/usr/bin/env python3
"""Verify the saved V6 retarget sequence and report its measurements. No live calls."""
import copy
import json
import pathlib
from read_semantics import derive, compare_preset

DATA = pathlib.Path(__file__).resolve().parents[2] / 'context/evidence/data/phase9a-grid-retarget'
STAGES = [
    'live-56-baseline', 'live-57-connect', 'live-58-retarget-amplify',
    'live-59-undo-retarget', 'live-60-redo-retarget', 'live-61-retarget-sine',
    'live-62-undo-reverse', 'live-63-redo-reverse', 'live-64-retarget-repeat',
    'live-65-saved-retarget', 'live-66-reloaded-retarget', 'live-67-restore',
    'live-68-saved-baseline', 'live-69-final-reload', 'live-71-read-repeat',
]
CHANGES = {1: ('none', 'sine'), 2: ('sine', 'amplify'),
           5: ('amplify', 'sine'), 8: ('sine', 'amplify'), 11: ('amplify', 'none')}
READ_STATES = {3: 'sine', 4: 'amplify', 6: 'amplify', 7: 'sine',
               9: 'amplify', 10: 'amplify'}
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
    states = {'none': disconnected}
    for name, source in [('sine', '0'), ('amplify', '1')]:
        connected = copy.deepcopy(disconnected)
        connected['cables'].append({'sourceModule': source, 'sourcePort': 'OUT',
                                    'destinationModule': '3', 'destinationPort': 'IN'})
        states[name] = connected
    rows, workflows = [], []
    for index, stage in enumerate(STAGES):
        before = read(stage, 'capture-0')
        assert nodes(before) == nodes(read(stage, 'capture-1'))
        entry, calls = read(stage, 'entry'), read(stage, 'calls')
        assert entry['hello']['methodsHash'] == '9dc11c1f9958f4d8'
        assert entry['rig']['gridReadProbe'] == '9a-grid-retarget-v6'
        assert entry['mark']['project'] == 'gn-grid-spike'
        assert entry['selection'] == read(stage, 'selection-after')
        assert not any('error' in call for call in calls['calls'])
        assert calls['calls'][-1]['method'] == 'probe.gridRead'
        assert read(stage, 'devices') == read(STAGES[0], 'devices')
        assert read(stage, 'files')['preset'] == read(STAGES[0], 'files')['preset']
        captures = ['capture-0', 'capture-1']
        if index in CHANGES:
            old, new = CHANGES[index]
            assert semantic(before) == states[old]
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
            sources = {'none': [], 'sine': [atoms(0)[2]], 'amplify': [atoms(1)[0]]}
            destination = atoms(3)[3]
            edge = prop(by_id[destination], 7125)
            assert edge['refs'] == sources[old]
            edge['refs'] = sources[new]
            edge['count'] = len(edge['refs'])
            for run in range(2):
                after = read(stage, f'cable-readback-{run}')
                assert nodes(after) == expected
                assert semantic(after) == states[new]
            captures += ['cable-command', 'cable-readback-0', 'cable-readback-1']
        else:
            assert semantic(before) == states[READ_STATES.get(index, 'none')]
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
    for undo_or_redo, reference, name in [(3, 1, 'cable-readback-0'), (4, 2, 'cable-readback-0'),
                                          (6, 2, 'cable-readback-0'), (7, 5, 'cable-readback-0')]:
        assert nodes(read(STAGES[undo_or_redo], 'capture-0')) == nodes(read(STAGES[reference], name))
    for before, after in [(9, 10), (12, 13)]:
        a, b = derive(read(STAGES[before], 'capture-0')), derive(read(STAGES[after], 'capture-0'))
        assert a.pop('moduleUuids') != b.pop('moduleUuids')
        assert a == b
        assert read(STAGES[before], 'files') == read(STAGES[after], 'files')
    compare_preset(derive(read(STAGES[-1], 'capture-0')), preset)
    outer_before = json.loads((READ_DATA / 'live-40-v4-host-identity/capture-0.json').read_text())['graph']['nodes']
    outer_after = read('live-70-outer-identity', 'capture-0')['graph']['nodes']
    assert outer_before == outer_after
    return {'result': 'pass', 'writes': 5, 'retargets': 3, 'undoBothDirections': 'pass', 'redoBothDirections': 'pass',
            'editedReload': 'pass', 'restoredReload': 'pass', 'outerIdentity': 'equal',
            'scope': 'saved semantic projection; no DSP or complete device-state claim',
            'heapLimit': 'samples only; not peak or retained heap',
            'workflows': workflows, 'captures': rows}


if __name__ == '__main__':
    print(json.dumps(verify(), indent=2))
