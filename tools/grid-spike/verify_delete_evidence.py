#!/usr/bin/env python3
"""Verify the V7 deletion evidence and report measurements. No live calls."""
import copy
import json
import pathlib
from read_semantics import derive, compare_preset

DATA = pathlib.Path(__file__).resolve().parents[2] / 'context/evidence/data/phase9a-grid-delete'
READ_DATA = DATA.with_name('phase9a-grid-read')
STAGES = sorted(p.name for p in DATA.glob('live-*') if 'outer-identity' not in p.name)
DELETES = {73: 'baseline', 76: 'baseline', 78: 'connected', 81: 'connected'}
READ_STATES = {74: 'baseline', 75: 'deleted', 79: 'connected', 80: 'deleted',
               82: 'deleted', 83: 'deleted'}


def read(stage, name='capture-0'):
    return json.loads((DATA / stage / f'{name}.json').read_text())


def nodes(capture):
    derive(capture)
    return capture['graph']['nodes']


def semantic(capture):
    result = derive(capture)
    result.pop('moduleUuids')
    return result


def prop(node, key):
    return next(p for p in node['properties'] if p['id'] == key)


def verify():
    assert len(STAGES) == 14
    baseline = read(STAGES[0])
    preset = json.loads((READ_DATA / 'preset-baseline.json').read_text())
    compare_preset(derive(baseline), preset)
    states = {'baseline': semantic(baseline)}
    states['connected'] = copy.deepcopy(states['baseline'])
    states['connected']['cables'].append({'sourceModule': '0', 'sourcePort': 'OUT',
                                         'destinationModule': '3', 'destinationPort': 'IN'})
    states['deleted'] = copy.deepcopy(states['baseline'])
    states['deleted']['modules'].pop()
    rows, workflows = [], []
    for stage in STAGES:
        number = int(stage.split('-')[1])
        before = read(stage)
        assert nodes(before) == nodes(read(stage, 'capture-1'))
        entry, calls = read(stage, 'entry'), read(stage, 'calls')
        assert entry['hello']['methodsHash'] == '252339a249e3a8ae'
        assert entry['rig']['gridReadProbe'] == '9a-grid-delete-v7'
        assert entry['mark']['project'] == 'gn-grid-spike'
        assert entry['selection'] == read(stage, 'selection-after')
        assert not any('error' in call for call in calls['calls'])
        assert calls['calls'][-1]['method'] == 'probe.gridRead'
        assert read(stage, 'devices') == read(STAGES[0], 'devices')
        assert read(stage, 'files')['preset'] == read(STAGES[0], 'files')['preset']
        captures = ['capture-0', 'capture-1']
        if number in DELETES or number == 77:
            kind = 'cable' if number == 77 else 'delete'
            old = 'baseline' if number == 77 else DELETES[number]
            new = 'connected' if number == 77 else 'deleted'
            assert semantic(before) == states[old]
            command = read(stage, f'{kind}-command')
            assert command['writeAttempted'] is True
            assert command['writeStatus'] == 'command-returned; fresh read required'
            assert command['readbackStatus'] == 'not-attempted'
            assert nodes(command) == nodes(before)
            expected = copy.deepcopy(nodes(before))
            by_id = {n['id']: n for n in expected}
            membership = prop(by_id[before['graph']['root']], 6428)
            modules = membership['refs']
            spare = by_id[modules[3]]
            contents = by_id[prop(spare, 406)['refs'][0]]
            atoms = prop(contents, 173)['refs']
            if kind == 'delete':
                removed = {spare['id'], contents['id'], *atoms}
                assert len(removed) == 8
                expected = [n for n in expected if n['id'] not in removed]
                membership['refs'] = modules[:3]
                membership['count'] = 3
                assert len(expected) == 45
            else:
                sine = by_id[prop(by_id[modules[0]], 406)['refs'][0]]
                source = prop(sine, 173)['refs'][2]
                edge = prop(by_id[atoms[3]], 7125)
                assert edge['refs'] == []
                edge['refs'], edge['count'] = [source], 1
            for run in range(2):
                after = read(stage, f'{kind}-readback-{run}')
                assert nodes(after) == expected
                assert semantic(after) == states[new]
            captures += [f'{kind}-command', f'{kind}-readback-0', f'{kind}-readback-1']
        else:
            assert semantic(before) == states[READ_STATES.get(number, 'baseline')]
        expected_calls = 18 if number in DELETES or number == 77 else 15
        assert calls['sequentialWireCalls'] == len(calls['calls']) == expected_calls
        graph_calls = [c for c in calls['calls'] if c['method'] in
                       ('probe.gridRead', 'probe.gridCable', 'probe.gridModuleDelete')][1:-1]
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
    def capture(number, name='capture-0'):
        return read(next(s for s in STAGES if s.startswith(f'live-{number}-')), name)
    for actual, reference, name in [(74, 72, 'capture-0'), (75, 73, 'delete-readback-0'),
                                     (76, 72, 'capture-0'), (77, 72, 'capture-0'),
                                     (79, 77, 'cable-readback-0'), (80, 78, 'delete-readback-0'),
                                     (81, 77, 'cable-readback-0'), (82, 81, 'delete-readback-0')]:
        assert nodes(capture(actual)) == nodes(capture(reference, name))
    a, b = derive(capture(82)), derive(capture(83))
    assert a.pop('moduleUuids') != b.pop('moduleUuids')
    assert a == b
    assert capture(82, 'files') == capture(83, 'files')
    assert capture(72, 'files') == capture(84, 'files') == capture(86, 'files')
    assert derive(capture(72))['moduleUuids'] != derive(capture(84))['moduleUuids']
    compare_preset(derive(capture(86)), preset)
    outer_before = json.loads((READ_DATA / 'live-40-v4-host-identity/capture-0.json').read_text())['graph']['nodes']
    assert outer_before == read('live-85-outer-identity')['graph']['nodes']
    assert outer_before == read('live-85-outer-identity', 'capture-1')['graph']['nodes']
    return {'result': 'pass', 'deletions': 4, 'cableWrites': 1,
            'isolatedAndConnectedUndoRedo': 'pass', 'editedReload': 'pass',
            'exactProjectBytesRestored': True, 'restoredReload': 'pass', 'outerIdentity': 'equal',
            'scope': 'saved semantic projection; no DSP or complete device-state claim',
            'heapLimit': 'samples only; not peak or retained heap',
            'workflows': workflows, 'captures': rows}


if __name__ == '__main__':
    print(json.dumps(verify(), indent=2))
