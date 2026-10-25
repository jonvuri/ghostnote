"""Run from any directory; writes JSON only to stdout, never to Bitwig sources."""
import collections
import hashlib
import json
import statistics
import time
from pathlib import Path
from index_reader import ids, plugins, cache_envelopes

HERE = Path(__file__).resolve().parent
ROOT = Path.home() / 'Library/Application Support/Bitwig/Bitwig Studio/index'
JAR = Path('/Applications/Bitwig Studio.app/Contents/Java/bitwig.jar')
PIN = '5c2b1895bbb9e7d08d9216de421985bb1f24b2ee62762c9451b4fe847df2469f'
TABLES = ['categories', 'device-creators', 'vst3-device-ids', 'clap-device-ids']
SCOPES = [('vst3', 'arm64', Path('/Library/Audio/Plug-Ins/VST3')),
          ('vst3', 'x64', Path('/Library/Audio/Plug-Ins/VST3')),
          ('clap', 'arm64', Path('/Library/Audio/Plug-Ins/CLAP')),
          ('clap', 'arm64', Path.home() / 'Library/Audio/Plug-Ins/CLAP')]


def digest(data):
    return hashlib.sha256(data).hexdigest()


def signature(path):
    s = path.stat()
    return (s.st_dev, s.st_ino, s.st_size, s.st_mtime_ns, s.st_ctime_ns)


def read_stable(path):
    before = signature(path)
    if before[2] > 32 * 1024 * 1024:
        raise ValueError('input exceeds bound')
    data = path.read_bytes()
    if before != signature(path) or len(data) != before[2]:
        raise ValueError(f'changed while reading {path}')
    return data, before


def index_path(kind, arch, root):
    # EX.cfM(Pi): MD5 of exact path string concatenated with Fi ordinal 7.
    key = hashlib.md5((str(root) + '7').encode('utf-8')).hexdigest().upper()
    return ROOT / f'{key}-{kind}-{arch}.index'


def load():
    paths = [ROOT / (t + '.ids') for t in TABLES]
    paths += [index_path(*s) for s in SCOPES]
    snapshots = {p: read_stable(p) for p in paths}
    tables = {t: ids(snapshots[ROOT / (t + '.ids')][0]) for t in TABLES}
    rows = []
    for kind, arch, root in SCOPES:
        path = index_path(kind, arch, root)
        for row in plugins(snapshots[path][0], kind, arch, tables):
            row['index'] = path.name
            row['path'] = str(root / row['relativeBundle'])
            # Keep source name and architecture separate; presentation suffix is explicit.
            row['browserName'] = row['name'] + (' [X64]' if arch == 'x64' else '')
            s = Path(row['path']).stat()
            row['bundleMtimeMatches'] = s.st_mtime_ns // 1_000_000 == row['timestamp']
            rows.append(row)
    # Whole-set stability detects ordinary replacement/rewrite during a multi-file read.
    for p, (_, sig) in snapshots.items():
        if signature(p) != sig:
            raise ValueError(f'source set changed: {p}')
    return rows, snapshots


def main():
    assert digest(JAR.read_bytes()) == PIN
    start = time.perf_counter_ns()
    rows, snapshots = load()
    first_ms = (time.perf_counter_ns() - start) / 1e6
    evidence = json.loads((HERE.parent / 'r05-browser/identity-checks.json').read_text())
    checks = []
    for s in evidence['rows']:
        if s['kind'] not in ('vst3', 'clap'):
            continue
        matches = [r for r in rows if r['kind'] == s['kind'] and r['browserName'] == s['name']
                   and r['path'] == s['pluginPath'] and r['architecture'].upper() == s['architecture']]
        passed = len(matches) == 1 and matches[0]['identity'] == s['id'] and matches[0]['vendor'] == s['vendor']
        assert passed, s['name']
        checks.append(dict(name=s['name'], kind=s['kind'], passed=passed))
    browser_sets = []
    events = [json.loads(line) for line in (HERE.parent / 'r05-browser/attempt-6/events.jsonl').read_text().splitlines()]
    pages = [e['value'] for e in events if e['label'] == 'page-second']
    for kind, page in zip(['vst3', 'clap'], pages, strict=True):
        observed = sorted(r['name'] for r in page['results'] if r['exists'])
        decoded = sorted(r['browserName'] for r in rows if r['kind'] == kind and r['deviceType'] == 3
                         and r['path'].startswith('/Library/Audio/Plug-Ins/'))
        assert observed == decoded and len(decoded) == page['resultCount']
        browser_sets.append(dict(kind=kind, count=len(decoded), exactNameMultisetMatches=True))
    timing = []
    for _ in range(50):
        start = time.perf_counter_ns()
        again, _ = load()
        timing.append((time.perf_counter_ns() - start) / 1e6)
        assert again == rows
    by_name = collections.defaultdict(list)
    for r in rows:
        by_name[r['name']].append(r)
    start = time.perf_counter_ns()
    for _ in range(100000):
        by_name.get('Diva')
    lookup_us = (time.perf_counter_ns() - start) / 100000 / 1000
    cache_summary = []
    for filename, version in [('vst3-metadata-arm64-11', 11), ('clap-metadata-13', 13)]:
        p = Path.home() / 'Library/Caches/Bitwig' / filename
        data, _ = read_stable(p)
        records = cache_envelopes(data, version)
        latest = {r['path']: r for r in records}  # OKo Map.put: later record wins.
        cache_summary.append(dict(file=str(p), sha256=digest(data), records=len(records),
            latestPaths=len(latest), failures=sum(r['failed'] for r in latest.values()),
            duplicatePathRecords=len(records)-len(latest)))
    unsupported = []
    for p in sorted(ROOT.glob('*bitwig-*.index')):
        if not p.name.endswith(('bitwig-devices.index', 'bitwig-presets.index')):
            continue
        data, sig = read_stable(p)
        unsupported.append(dict(file=p.name, size=len(data), sha256=digest(data),
            header=data[:14].hex(), mtimeNs=sig[3], status='additional preamble not decoded'))
    result = dict(jarSha256=PIN, scope='four explicit plug-in roots/architectures; no host calls',
        sources=[dict(path=str(p), size=len(b), sha256=digest(b), mtimeNs=sig[3]) for p,(b,sig) in snapshots.items()],
        counts=dict(collections.Counter(r['index'] for r in rows)),
        instruments=dict(collections.Counter(r['index'] for r in rows if r['deviceType']==3)),
        allBundleMtimesMatch=all(r['bundleMtimeMatches'] for r in rows),
        identityChecks=checks, completeFrozenBrowserNameSets=browser_sets, cacheEnvelopes=cache_summary, unsupported=unsupported,
        timing=dict(firstObservedReadParseAndBundleStatsMs=first_ms, repeatedReadParseAndBundleStatsMs=timing,
                    medianMs=statistics.median(timing), p95Ms=sorted(timing)[47],
                    inMemoryExactNameLookupMeanUs=lookup_us,
                    conditions='OS cache warm/unspecified; Python already started; includes stat for all 407 rows; no cold-cache claim'),
        rows=rows)
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
