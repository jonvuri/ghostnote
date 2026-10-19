"""Check the offline evidence and counterexamples. Do not run host code."""

import copy
import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent
manifest = json.loads((ROOT / 'source-inspection.json').read_text())
out = Path(manifest['localOutputDirectory'])
for source in manifest['sources']:
    data = Path(source['path']).read_bytes()
    assert len(data) == source['bytes']
    assert hashlib.sha256(data).hexdigest() == source['sha256']
texts = {}
for item in manifest['outputs']:
    data = (out / item['file']).read_bytes()
    assert len(data) == item['bytes']
    assert hashlib.sha256(data).hexdigest() == item['sha256']
    texts[item['file']] = data.decode()
thin = (out / 'jni-arm64.bin').read_bytes()
assert hashlib.sha256(thin).hexdigest() == manifest['thinSlice']['sha256']
engine = next(item for item in manifest['sources'] if item['name'] == 'engine')
engine_bytes = Path(engine['path']).read_bytes()
for lead in manifest['nativeLeads']['engineTypeNames']:
    value = lead['typeName'].encode() + b'\0'
    for offset in lead['fileOffsets']:
        start = int(offset, 16)
        assert engine_bytes[start:start + len(value)] == value
assert not manifest['nativeLeads']['engineSymbolMatches']
assert manifest['nativeLeads']['jarAsciiNameScan']['classCount'] == 30940

address = texts['jni-get-address.txt']
assert '500350: f9401040' in address and 'ldr\tx0, [x2, #0x20]' in address
assert '500354: d65f03c0' in address
frame = texts['jni-begin-frame.txt']
assert '534004: 910023ea' in frame and 'add\tx10, sp, #0x8' in frame
assert '534038: b82b0148' in frame and 'ldadd\tw11, w8, [x10]' in frame
scope = texts['jni-scope-reader.txt']
for instruction in ('534b00: 7100091f', '534b08: 52800068',
                    '534b0c: 390002c8', '534b20: 294122c9',
                    '534c24: 910052c1', '534c30: 390002df'):
    assert instruction in scope
array = texts['jni-array-reader.txt']
assert '533e18: b9402668' in array and '533e74: b9002675' in array
proxy = texts['com.bitwig.flt.control_surface.proxy.AbstractChannelProxy.txt']
assert 'Bsp.NaF:()D' in proxy and 'Bsp.ffA:()D' in proxy
assert 'VuMeterObserver.sendValue:(D)V' in proxy
observer = texts['com.bitwig.flt.control_surface.proxy.AbstractChannelProxy$VuMeterObserver.txt']
assert 'Method queueCallback:(Ljava/lang/Runnable;)V' in observer
assert 'double 0.3333d' in observer

# Equal visible data do not imply equal provenance. These are countermodels,
# not claims that a particular native interleaving occurred.
valid_zero_cache = {'value': 0.0, 'EbT': 1250, 'callback': None}
decayed_zero_cache = {'value': 0.0, 'EbT': 1250, 'callback': None}
assert valid_zero_cache == decayed_zero_cache
fresh_raw = {'value': 0.0, 'valid': 1, 'documentToken': 9}
stale_raw_other_target_changed = {'value': 0.0, 'valid': 1, 'documentToken': 9}
assert fresh_raw == stale_raw_other_target_changed
coherent_raw = {'value': 0.0, 'valid': 1}
torn_raw = {'value': 0.0, 'valid': 1}
assert coherent_raw == torn_raw
fresh_delivery = {'code': 0, 'callbackReceivedAt': 1250}
old_value_on_binding = {'code': 0, 'callbackReceivedAt': 1250}
assert fresh_delivery == old_value_on_binding


def admissible(packet):
    """Model required evidence fields. No current accessor supplies this row."""
    required = ('target', 'connection', 'valid', 'sequence', 'time',
                'snapshotTime', 'valueGeneration', 'validGeneration', 'coherent')
    if any(packet.get(key) is None for key in required):
        return False
    return (packet['target'] == 'fixture' and packet['connection'] == 'same'
            and packet['valid'] and packet['sequence'] > 4
            and 1000 < packet['time'] <= packet['snapshotTime']
            and packet['snapshotTime'] - packet['time'] <= 250
            and packet['valueGeneration'] == packet['validGeneration']
            and packet['coherent'])


complete = {'target': 'fixture', 'connection': 'same', 'valid': True,
            'sequence': 5, 'time': 1250, 'snapshotTime': 1500,
            'valueGeneration': 5, 'validGeneration': 5, 'coherent': True}
assert admissible(complete)
negative_cases = {
    'invalid-zero': {'valid': False},
    'missing-validity': {'valid': None},
    'stale-sequence': {'sequence': 4},
    'too-old-zero': {'time': 1249},
    'before-window': {'time': 1000},
    'future-time': {'time': 1501},
    'missing-age': {'time': None},
    'torn-zero': {'validGeneration': 6},
    'no-publication-proof': {'coherent': False},
    'wrong-target': {'target': 'master'},
    'reconnected': {'connection': 'new'},
}
for name, changes in negative_cases.items():
    candidate = copy.copy(complete)
    candidate.update(changes)
    assert not admissible(candidate), name

calls = 16 + 11 * 18 + 8 * 2 + 2 + 16
assert calls == 248
assert 11 * 5 + 2 + 2 == 59
assert 8 * (2 + 8) == 80
assert 8 * 9 + 8 * 8 == 136
assert calls * 24 == 5952 and (calls + 136) * 24 == 9216
assert 11 * 750 + 1200 + 432 == 9882
assert 9882 + 1950 + 18000 == 29832
assert 9882 + 1950 + 20000 == 31832
result = {
    'command': 'python3 context/evidence/data/phase9a-observable-design/check_design.py',
    'result': 'pass', 'sourceFiles': len(manifest['sources']),
    'commandOutputHashes': len(manifest['outputs']),
    'ambiguityModels': 4, 'negativeRequirementCases': list(negative_cases),
    'conditionalWireCalls': calls,
    'limit': 'Checks pinned files, selected instruction facts, scalar countermodels, '
             'and cost arithmetic only. Does not prove native producer behavior, '
             'synchronization, all writers, or a working accessor.',
}
(out / 'verification.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
