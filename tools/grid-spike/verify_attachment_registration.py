#!/usr/bin/env python3
"""Check E287's stopped V10 run. This does not prove V11 registry admission."""
import copy
import json
from verify_factory_evidence import read, ROOT, PROJECT_HASH, PRESET_HASH
from verify_attachment_evidence import expected
from read_semantics import derive, compare_preset


def verify():
    data = ROOT / 'context/evidence/data/phase9a-grid-attachment'
    first, recovery = data / 'live-91-attach-first', data / 'live-92-recovery'
    before, entry, command = [read(first, n) for n in ['capture-0', 'entry', 'attach-command']]
    baseline = read(ROOT / 'context/evidence/data/phase9a-grid-factory/live-87-factory-first', 'capture-0')
    assert before['graph']['nodes'] == baseline['graph']['nodes']
    compare_preset(derive(before), read(ROOT / 'context/evidence/data/phase9a-grid-read', 'preset-baseline'))
    for name in ['capture-1', 'attach-command']:
        value = read(first, name)
        assert value['graph']['nodes'] == before['graph']['nodes'] and value['witness'] == before['witness']
    hello = read(data, 'hello-v10-summary')
    assert hello['result'] == 'ALL PASS' and hello['methodCount'] == 117
    assert hello['methodsHash'] == 'b899e5d3d75a791d' and hello['marker'] == '9a-grid-attachment-v10'
    assert hello['initEpochMs'] > read(data, 'deployment-v10')['deployedAtMs']
    assert entry['stats']['initEpochMs'] == hello['initEpochMs']
    assert command['writeAttempted'] is True
    assert 'managedObjectId' not in command['lifecycle']['attached']
    # Model the proposed receipt only to check the narrow graph delta. V10 did
    # not read the native registry. Do not report this model as a live proof.
    hypothesis = copy.deepcopy(command)
    hypothesis['lifecycle']['attached'].update(managedObjectId=4000, managedObjectRegistered=True)
    uuid, nodes, witness = expected(before, hypothesis)
    rows = []
    for folder, name in [(first, 'capture-0'), (first, 'capture-1'), (recovery, 'recovery-0'), (recovery, 'recovery-1')]:
        value = read(folder, name)
        assert value['graph']['complete'] and value['graph']['errorCount'] == 0
        if folder == recovery:
            derive(value)
            assert value['graph']['nodes'] == nodes and value['witness'] == witness
        rows.append(dict(capture=f'{folder.name}/{name}', documentMs=value['documentTaskNanos'] / 1e6,
                         queueMs=value['queueNanos'] / 1e6, heapSampleDelta=value['heapUsedAfter'] - value['heapUsedBefore'],
                         graphBytes=value['graph']['encodedBytes']))
    assert read(recovery, 'recovery-binding')['epoch'] != before['epoch']
    calls, recovered = read(first, 'calls')['calls'], read(recovery, 'calls')['calls']
    assert len(calls) == 16 and sum('error' in c for c in calls) == 1
    assert 'attachment-independent-readback-disagrees' in calls[14]['error']
    assert len(recovered) == 4 and all('error' not in c for c in recovered)
    exit_state = read(data, 'exit-v10-live')
    assert exit_state['selection'] == entry['selection']
    status = exit_state['status']
    assert status['writeLocked'] and not status['nativeUnfinished']
    assert status['factoryAttempts'] == 1 and status['recoveryUsed'] and status['recoveryReads'] == 2
    assert status['afterReads'] == 0
    files = read(data, 'preservation-v10-live')['files']
    assert files == read(first, 'files')
    assert files['project']['sha256'] == files['backup']['sha256'] == PROJECT_HASH
    assert files['preset']['sha256'] == PRESET_HASH
    life = command['lifecycle']
    return dict(result='V10 insertion returned; exact readback gate stopped at managed ID', uuid=uuid,
                onlyUnexpectedDelta=dict(node=59, property=14, detached='0', recovered='4000'),
                nativeRegistrationProof=False, factoryAttempts=1, recoveryCalls=4, writeLocked=True,
                workflowWireMs=sum(c['ms'] for c in calls), recoveryWireMs=sum(c['ms'] for c in recovered),
                commandWireMs=calls[13]['ms'], commandDocumentMs=command['documentTaskNanos'] / 1e6,
                commandQueueMs=command['queueNanos'] / 1e6,
                nativeMs={s: life[s + 'Nanos'] / 1e6 for s in ['factory', 'start', 'insertion', 'close']},
                commandHeapSampleDelta=command['heapUsedAfter'] - command['heapUsedBefore'], reads=rows,
                limit='V11 registry proof, successful repeat, undo/redo, edited reload, and live baseline restoration remain pending.')


if __name__ == '__main__':
    print(json.dumps(verify(), indent=2))
