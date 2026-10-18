#!/usr/bin/env python3
"""Verify the saved E286 pre-factory refusal and its single recovery workflow."""
import json
from verify_factory_evidence import read, ROOT, PROJECT_HASH, PRESET_HASH
from read_semantics import derive, compare_preset


def verify():
    data = ROOT / 'context/evidence/data/phase9a-grid-attachment'
    first, recovery = data / 'live-89-attach-first', data / 'live-90-recovery'
    before, entry = read(first, 'capture-0'), read(first, 'entry')
    baseline = read(ROOT / 'context/evidence/data/phase9a-grid-factory/live-87-factory-first', 'capture-0')
    assert before['graph']['nodes'] == baseline['graph']['nodes']
    compare_preset(derive(before), read(ROOT / 'context/evidence/data/phase9a-grid-read', 'preset-baseline'))
    hello = read(data, 'hello-v9-summary')
    assert hello['result'] == 'ALL PASS' and hello['methodCount'] == 117
    assert hello['methodsHash'] == 'b899e5d3d75a791d' and hello['marker'] == '9a-grid-attachment-v9'
    assert hello['initEpochMs'] > read(data, 'deployment-v9')['deployedAtMs']
    status = read(first, 'failure-status')
    assert status['writeLocked'] and not status['nativeUnfinished'] and status['factoryAttempts'] == 0
    assert not status['recoveryUsed']
    assert 'attachment-before-witness-changed' in status['lifecycle']['requestError']
    assert before['witness']['selection'] == {'selected': []}
    rows = []
    for folder, name in [(first, 'capture-0'), (first, 'capture-1'), (recovery, 'recovery-0'), (recovery, 'recovery-1')]:
        value = read(folder, name)
        assert value['graph']['complete'] and value['graph']['errorCount'] == 0
        assert value['graph']['nodes'] == before['graph']['nodes'] and value['witness'] == before['witness']
        assert value['witness']['edit'] == dict(frames=0, instant=0, longer=0, locks=0, lockSet=False, active=False)
        assert value['witness']['parentsVerified']
        rows.append(dict(capture=f'{folder.name}/{name}', documentMs=value['documentTaskNanos'] / 1e6,
                         queueMs=value['queueNanos'] / 1e6, heapSampleDelta=value['heapUsedAfter'] - value['heapUsedBefore'],
                         graphBytes=value['graph']['encodedBytes']))
    assert read(recovery, 'recovery-binding')['epoch'] != before['epoch']
    calls = read(first, 'calls')['calls']
    assert len(calls) == 15 and sum('error' in c for c in calls) == 1
    assert calls[-2]['method'] == 'probe.gridModuleAttach' and 'writeAttempted=false' in calls[-2]['error']
    assert calls[-1]['method'] == 'probe.gridRead'
    recovered = read(recovery, 'calls')['calls']
    assert len(recovered) == 4 and all(c['method'] == 'probe.gridRead' and 'error' not in c for c in recovered)
    exit_state = read(data, 'exit-v9-live')
    assert exit_state['selection'] == entry['selection']
    assert exit_state['revision']['project'] == 'gn-grid-spike'
    assert exit_state['status']['writeLocked'] and not exit_state['status']['nativeUnfinished']
    assert exit_state['status']['factoryAttempts'] == 0 and exit_state['status']['recoveryUsed']
    assert exit_state['status']['recoveryReads'] == 2
    files = read(data, 'preservation-v9-live')['files']
    assert files == read(first, 'files')
    assert files['project']['sha256'] == files['backup']['sha256'] == PROJECT_HASH
    assert files['preset']['sha256'] == PRESET_HASH
    return dict(result='pre-factory refusal and exact baseline recovery verified', factoryAttempts=0,
                insertionAttempts=0, recoveryWorkflowCalls=4, writeLocked=True,
                refusedWorkflowWireMs=sum(c['ms'] for c in calls), recoveryWireMs=sum(c['ms'] for c in recovered), reads=rows,
                limit='No attachment, edit, disposal, undo/redo, or edited reload is proved by these reads.')


if __name__ == '__main__':
    print(json.dumps(verify(), indent=2))
