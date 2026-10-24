"""9b.7 temporary-file cleanup: verify each session-owned /tmp file against its evidence, preserve the small
unreferenced development files in one archive, write the inventory, then delete the temporary copies.

Run once from any directory. The report and archive paths must not exist. No vendor bytes are preserved:
mutant jars and class dumps are recorded by hash only.
"""
import glob
import hashlib
import json
import os
import shutil
import sys
import zipfile

ROOT = '/Users/jonvuri/Development/ghostnote'
DATA = f'{ROOT}/context/evidence/data/phase9b-doctor'
OUT = f'{DATA}/9b7-tool'
REPORT, ARCHIVE = f'{OUT}/cleanup.json', f'{OUT}/tmp-preserved.zip'
E339_BUILT_5 = 'c08544cd3486543aeb17735cc48423104ff2740321070c7283f8f500b303bcf8'
PRESERVE_TEXT = ('.py', '.sh', '.log', '.txt')
MAX_TEXT, MAX_JSON = 65536, 262144


def sha256(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b''):
            digest.update(chunk)
    return digest.hexdigest()


def manifests():
    rows = {}
    for path in glob.glob(f'{DATA}/614-*/checkpoint-*/development-manifest.json') + \
            glob.glob(f'{DATA}/614-*/development-manifest.json'):
        for row in json.load(open(path)):
            rows.setdefault(row['name'], []).append((row['sha256'], os.path.relpath(path, ROOT)))
    return rows


def captures():
    data = json.load(open(f'{DATA}/live-v20/capture-manifest.json'))
    rows = data if isinstance(data, list) else data['list']
    return {row['file']: row['sha256'] for row in rows}


def diagnosis_equal(path):
    a, b = json.load(open(path)), json.load(open(f'{DATA}/614-preparation/diagnosis.json'))
    ignored = {'inputs', 'elapsedMs', 'peakRssBytes'}
    return {k: a.get(k) for k in a if k not in ignored} == {k: b.get(k) for k in b if k not in ignored} and set(a) == set(b)


def classify(path, name, digest, size, known, capture_rows, inside):
    if name in known and any(s == digest for s, _ in known[name]):
        return 'manifest:' + next(f for s, f in known[name] if s == digest)
    if inside == '/tmp/gn-9b6j-e316-captures' and capture_rows.get(name) == digest:
        return 'e316-capture-manifest'
    if path == '/tmp/gn-9b6h-probe-built-5.bwextension':
        return 'e339-hash' if digest == E339_BUILT_5 else 'hash-mismatch'
    if path == '/tmp/gn-614-development-diagnosis.json':
        return 'diagnosis-equal-to-614-preparation' if diagnosis_equal(path) else 'diagnosis-differs'
    if inside == '/tmp/gn-9b6j-scratch':
        return 'preserved'
    if path == '/tmp/gn-9b3-cZl.txt' or path.endswith('.jar') or path.endswith('.class'):
        return 'hash-only-vendor-derived'
    if name.endswith(PRESERVE_TEXT) and size <= MAX_TEXT:
        return 'preserved'
    if name.endswith('.json') and size <= MAX_JSON and inside is None:
        return 'preserved'
    return 'hash-only'


def main():
    if os.path.exists(REPORT) or os.path.exists(ARCHIVE):
        print('report or archive exists', file=sys.stderr)
        return 2
    known, capture_rows = manifests(), captures()
    targets = sorted(glob.glob('/tmp/gn-9b6g-*')) + ['/tmp/gn-9b6h-probe-built-5.bwextension',
               '/tmp/gn-9b6j-e316-captures', '/tmp/gn-9b6j-scratch'] + sorted(glob.glob('/tmp/gn-614-*')) + \
        ['/tmp/gn-9b3-cZl.txt']
    rows, preserved = [], []
    for target in targets:
        if not os.path.exists(target):
            rows.append({'path': target, 'kind': 'missing'})
            continue
        if os.path.isdir(target):
            for base, _, files in os.walk(target):
                for name in sorted(files):
                    path = os.path.join(base, name)
                    size, digest = os.path.getsize(path), sha256(path)
                    verdict = classify(path, name, digest, size, known, capture_rows, target)
                    rows.append({'path': path, 'kind': 'file', 'inside': target, 'bytes': size, 'sha256': digest,
                                 'verification': verdict})
                    if verdict == 'preserved':
                        preserved.append(path)
        else:
            size, digest = os.path.getsize(target), sha256(target)
            verdict = classify(target, os.path.basename(target), digest, size, known, capture_rows, None)
            rows.append({'path': target, 'kind': 'file', 'bytes': size, 'sha256': digest, 'verification': verdict})
            if verdict == 'preserved':
                preserved.append(target)
    with zipfile.ZipFile(ARCHIVE, 'x', zipfile.ZIP_DEFLATED) as archive:
        for path in preserved:
            archive.write(path, os.path.relpath(path, '/tmp'))
    counts = {}
    for row in rows:
        key = row.get('verification', row['kind']).split(':')[0]
        counts[key] = counts.get(key, 0) + 1
    report = {'format': 'grid-doctor-tmp-cleanup-v1', 'session': '9b.7', 'targets': targets,
              'files': sum(1 for r in rows if r['kind'] == 'file'),
              'bytes': sum(r.get('bytes', 0) for r in rows), 'counts': counts,
              'preservedArchive': {'path': os.path.relpath(ARCHIVE, ROOT), 'files': len(preserved),
                                   'bytes': os.path.getsize(ARCHIVE), 'sha256': sha256(ARCHIVE)},
              'mismatches': [r for r in rows if r.get('verification', '').endswith(('mismatch', 'differs'))],
              'rows': rows}
    if report['mismatches']:
        print(json.dumps(report['mismatches'], indent=1), file=sys.stderr)
        print('mismatch: nothing deleted', file=sys.stderr)
        os.remove(ARCHIVE)
        return 1
    with open(REPORT, 'x') as handle:
        json.dump(report, handle, indent=1)
        handle.write('\n')
    for target in targets:
        if os.path.isdir(target):
            shutil.rmtree(target)
        elif os.path.exists(target):
            os.remove(target)
    report['deleted'] = [t for t in targets if not os.path.exists(t)]
    print(json.dumps({k: report[k] for k in ('files', 'bytes', 'counts', 'preservedArchive')}, indent=1))
    print('remaining:', [t for t in targets if os.path.exists(t)])
    return 0


if __name__ == '__main__':
    sys.exit(main())
