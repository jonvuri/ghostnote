#!/usr/bin/env python3
"""Verify the saved V4 sequence and report its measurements. No live calls."""
import copy
import json
import pathlib
from read_semantics import derive, compare_preset

DATA = pathlib.Path(__file__).resolve().parents[2] / 'context/evidence/data/phase9a-grid-read'
STAGES = [
    'live-30-v4-baseline', 'live-31-v4-value60', 'live-32-v4-value50',
    'live-33-v4-undo', 'live-34-v4-repeat60', 'live-35-v4-saved60',
    'live-36-v4-reloaded60', 'live-37-v4-restore50', 'live-38-v4-saved50',
    'live-39-v4-final-baseline',
]
CHANGES = {1: (50, 60), 2: (60, 50), 4: (50, 60), 7: (60, 50)}
VALUES = {50: 0.7937005259840998, 60: 0.8434326653017492}


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
    preset = json.loads((DATA / 'preset-baseline.json').read_text())
    baseline = read(STAGES[0], 'capture-0')
    compare_preset(derive(baseline), preset)
    expected50 = semantic(baseline)
    expected60 = copy.deepcopy(expected50)
    expected60['modules'][3]['parameters'][0]['value'] = VALUES[60]
    rows, workflows = [], []
    for index, stage in enumerate(STAGES):
        before = read(stage, 'capture-0')
        assert nodes(before) == nodes(read(stage, 'capture-1'))
        entry, calls = read(stage, 'entry'), read(stage, 'calls')
        assert entry['hello']['methodsHash'] == '0bf393706e47e7ed'
        assert entry['rig']['gridReadProbe'] == '9a-grid-value-v4'
        assert entry['mark']['project'] == 'gn-grid-spike'
        assert entry['selection'] == read(stage, 'selection-after')
        assert not any('error' in call for call in calls['calls'])
        assert calls['calls'][-1]['method'] == 'probe.gridRead'
        assert read(stage, 'devices') == read(STAGES[0], 'devices')
        assert read(stage, 'files')['preset'] == read(STAGES[0], 'files')['preset']
        captures = ['capture-0', 'capture-1']
        if index in CHANGES:
            old, new = CHANGES[index]
            assert semantic(before) == (expected50 if old == 50 else expected60)
            command = read(stage, 'value-command')
            assert command['writeAttempted'] is True
            assert command['writeStatus'] == 'command-returned; fresh read required'
            assert command['readbackStatus'] == 'not-attempted'
            assert nodes(command) == nodes(before)
            expected = copy.deepcopy(nodes(before))
            changed = 0
            for node in expected:
                for prop in node['properties']:
                    if prop['id'] in (712, 949) and prop.get('value', {}).get('data') == VALUES[old]:
                        prop['value']['data'] = VALUES[new]
                        changed += 1
            assert changed == 2
            for run in range(2):
                after = read(stage, f'value-readback-{run}')
                assert nodes(after) == expected
                assert semantic(after) == (expected50 if new == 50 else expected60)
            captures += ['value-command', 'value-readback-0', 'value-readback-1']
        else:
            assert semantic(before) == (expected60 if index in (3, 5, 6) else expected50)
        expected_calls = 18 if index in CHANGES else 15
        assert calls['sequentialWireCalls'] == len(calls['calls']) == expected_calls
        graph_calls = [c for c in calls['calls'] if c['method'] in ('probe.gridRead', 'probe.gridValue')][1:-1]
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
    assert nodes(read(STAGES[1], 'value-readback-0')) == nodes(read(STAGES[3], 'capture-0'))
    assert nodes(read(STAGES[2], 'value-readback-0')) == nodes(read(STAGES[4], 'capture-0'))
    for before, after in [(5, 6), (8, 9)]:
        a, b = derive(read(STAGES[before], 'capture-0')), derive(read(STAGES[after], 'capture-0'))
        assert a.pop('moduleUuids') != b.pop('moduleUuids')
        assert a == b
        assert read(STAGES[before], 'files') == read(STAGES[after], 'files')
    compare_preset(derive(read(STAGES[-1], 'capture-0')), preset)
    outer_before = read('live-29-host-identity', 'capture-0')['graph']['nodes']
    outer_after = read('live-40-v4-host-identity', 'capture-0')['graph']['nodes']
    assert outer_before == outer_after
    return {'result': 'pass', 'writes': 4, 'undo': 'pass', 'redo': 'pass',
            'editedReload': 'pass', 'restoredReload': 'pass', 'outerIdentity': 'equal',
            'scope': 'saved semantic projection; no DSP or complete device-state claim',
            'heapLimit': 'samples only; not peak or retained heap',
            'workflows': workflows, 'captures': rows}


if __name__ == '__main__':
    print(json.dumps(verify(), indent=2))
