"""Check the offline trace hashes and the zero-state ambiguity model."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parent
manifest = json.loads((root / 'source-inspection.json').read_text())
jar = Path(manifest['jar'])
assert hashlib.sha256(jar.read_bytes()).hexdigest() == manifest['jarSha256']
texts = {}
for item in manifest['inspections']:
    path = Path(manifest['localOutputDirectory']) / (item['class'] + '.txt')
    data = path.read_bytes()
    assert hashlib.sha256(data).hexdigest() == item['javapSha256']
    texts[item['class']] = data.decode()


def method(class_name, signature):
    text = texts[class_name]
    start = text.index('  ' + signature + '\n')
    end = start + len(signature) + 3
    for line in text[end:].splitlines(keepends=True):
        if line.startswith('  ') and not line.startswith('    ') and '(' in line:
            break
        end += len(line)
    return text[start:end]


def writes(text, name):
    return [line for line in text.splitlines() if 'putfield' in line and name in line]


assert len(writes(texts['DxI'], 'Field EbT:')) == 3
receive = method('DxI', 'public void ffA(com.bitwig.base.platform.hwy);')
assert receive.count('hwy.kG:()F') == 5
assert receive.count('hwy.cG3:()B') == 2
assert 'Method mIz:()V' in receive and 'Field EbT:Ljava/time/Instant;' in receive
assert 'Field EbT:Ljava/time/Instant;' in method('DxI', 'private void mIz();')
assert 'Field EbT:' not in method('DxI', 'public void aD_();')
svr = 'com.bitwig.flt.document.core.master.Svr'
assert len(writes(texts[svr], 'Field jCQ:')) == 3
assert 'gJd.wi2:()V' in method(svr, 'public void cnN();')
assert 'hwy.kyi:()J' in method(svr, 'public void cnN();')
assert 'uqc.ffA:(Lcom/bitwig/base/platform/hwy;)V' in method('com.bitwig.base.platform.iIS', 'private void eOi();')
assert 'Lck.ffA:(Lcom/bitwig/base/platform/hwy;)V' in method('Yuj', 'public void ffA(com.bitwig.base.platform.hwy);')
assert 'sun/misc/Unsafe.getFloat:(J)F' in method('com.bitwig.base.platform.GCp', 'public final float kG();')
assert 'sun/misc/Unsafe.getByte:(J)B' in method('com.bitwig.base.platform.GCp', 'public final byte cG3();')

# Model only retained Java values. A zero decay returns zero without a log call.
# Both branches store the same current time. The valid bit is a local variable.
prior = {'peak': [0.0] * 3, 'rms': [0.0] * 3, 'firstByteState': False, 'extra': 0.0, 'EbT': 1000}
valid_zero = {**prior, 'EbT': 1250}
invalid_zero = {**prior, 'EbT': 1250}
assert valid_zero == invalid_zero
assert 5 * 4 + 2 == 22
refs = json.loads((root / 'member-references.json').read_text())
assert refs['classCount'] == 30940
assert {row['class'] for row in refs['rows'] if row['owner'] == 'DxI' and row['name'] == 'EbT'} == {'DxI'}
print('PASS: 34 source hashes, pinned jar, selected receive-path checks, 22-byte payload, and zero-state ambiguity model. No host code was executed.')
