"""Summarize E302 captures without treating partial graphs as complete."""
import json
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / 'context/evidence/data/phase9b-survey'


def load(path):
    return json.loads(path.read_text())


def save(name, value):
    (DATA / name).write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n')


def extent(values):
    return [min(values), max(values)] if values else None


def normalized(graph):
    nodes = json.loads(json.dumps(graph['nodes']))
    for n in nodes:
        for p in n['properties']:
            if p['id'] == 14 or p['id'] == 15 and n['className'] == 'module':
                p['value']['data'] = '<instance>'
    return nodes


def main():
    rows = {}
    for folder in ['live-v14', 'live-v14-remaining-2']:
        base = DATA / folder
        for target in sorted(base.glob('preset-*-target.json')):
            prefix = target.stem.removesuffix('-target')
            t = load(target)
            summary_file = base / f'{prefix}-summary.json'
            summary = load(summary_file if summary_file.exists() else base / f'{prefix}-cap-refusal.json')
            captures = sorted(base.glob(f'{prefix}-capture-*.json'), key=lambda p: int(p.stem.rsplit('-', 1)[1]))
            graph = load(captures[-1])['graph'] if captures else None
            rows[t['candidate']['path']] = {'path': t['candidate']['path'], 'flavour': t['target']['deviceName'],
                'graph': summary, 'graphSource': str(base.relative_to(ROOT)),
                'classes': sorted({n['className'] for n in graph['nodes']}) if graph else [],
                'lastCapture': str(captures[-1].relative_to(ROOT)) if captures else None}
    catalog = load(DATA / 'live-v14-catalog/results.json')
    pairs = defaultdict(set)
    schemas = {}
    for i, row in enumerate(catalog):
        preset_path = load(DATA / f'live-v14-catalog/preset-{i}-target.json')['candidate']['path']
        row = {**row, 'presetPath': preset_path}
        rows[preset_path]['catalog'] = row
        for m in row.get('modules', []):
            pairs[m['typeUuid'], m['name']].add(preset_path)
    seed = load(DATA / 'catalog-seed.json')
    files = seed['moduleFiles']
    for row in seed['seenTypes']:
        pairs[row['typeUuid'], row['name']].add('E276 control')
    entries = [{'typeUuid': uuid, 'observedName': name, 'sources': sorted(sources),
                'filenameMatch': name + '.bwmodule' if name + '.bwmodule' in files else None}
               for (uuid, name), sources in sorted(pairs.items())]
    matched = sorted({e['filenameMatch'] for e in entries if e['filenameMatch']})
    save('catalog-first-pass.json', {'evidence': 'E302', 'moduleFiles': files, 'moduleFileCount': len(files),
        'seenTypes': entries, 'uniqueTypeUuids': len({e['typeUuid'] for e in entries}),
        'observedNamePairs': len(entries), 'matchedFilenames': matched,
        'matchedFilenameCount': len(matched), 'unmatchedFilenames': sorted(set(files) - set(matched)),
        'coverageRule': 'Exact observed-name/file-stem overlap only. Names can be edited; filenames do not prove type identity.'})
    for folder in ['live-v14', 'live-v14-remaining-2']:
        for file in (DATA / folder).glob('*schema-*.json'):
            s = load(file)['schema']; key = (s['className'], s['runtimeClass'])
            if key not in schemas:
                schemas[key] = {'className': key[0], 'runtimeClass': key[1], 'classId': s['classId'],
                                'properties': s['properties'], 'source': str(file.relative_to(ROOT))}
    save('observed-schemas.json', {'evidence': 'E302', 'scope': 'First captured schema per descriptor/runtime pair. Counts describe one object.',
                                 'classes': sorted(schemas.values(), key=lambda s: s['className'])})
    runs = []
    for folder in ['live-v14', 'live-v14-remaining', 'live-v14-remaining-2', 'live-v14-catalog', 'live-v14-preserved']:
        base = DATA / folder; calls = load(base / 'calls.json')
        captures = [load(p) for p in base.glob('*capture-*.json')]
        read_calls = [c for c in calls['calls'] if c['method'] == 'probe.gridRead' and c['params']['operation'] == 'read']
        runs.append({'folder': folder, 'calls': calls['count'], 'summedWireMs': calls['wireMs'],
                     'readCalls': len(read_calls), 'captureWireMs': extent([c['ms'] for c in read_calls]),
                     'documentMs': extent([c['documentTaskNanos'] / 1e6 for c in captures]),
                     'queryWork': extent([c['queryWork'] for c in captures]),
                     'graphBytes': extent([c['graph']['encodedBytes'] for c in captures]),
                     'heapSampleDeltaBytes': extent([c['heapUsedAfter'] - c['heapUsedBefore'] for c in captures]),
                     'exit': load(base / 'exit.json')})
    before = load(DATA / 'live-v14/before.json')
    snapshots_equal = all(load(DATA / folder / f'{stage}.json') == before
                          for folder in ['live-v14-remaining-2', 'live-v14-catalog'] for stage in ['before', 'after'])
    original = load(DATA / 'live-v14-preserved/capture-0.json')['graph']
    baseline = load(ROOT / 'context/evidence/data/phase9a-grid-read/live-23-semantic-baseline/capture-0.json')['graph']
    assert snapshots_equal
    assert normalized(original) == normalized(baseline)
    assert all(run['exit']['scratch'] is None and not run['exit']['uncertain'] for run in runs)
    final = load(DATA / 'final-state.json')
    assert final['verified']
    assert final['tracks']['tracks'] == before['tracks'] and final['mixer'] == before['mixer']
    assert all(not final['reader'][key] for key in ['bound', 'busy', 'locked', 'nativeUnfinished', 'foreignOwner'])
    control_calls = load(DATA / 'live-v14/calls.json')['calls']
    control_target = load(DATA / 'live-v14/preset-0-target.json')['target']['trackId']
    control_wire = [c['ms'] for c in control_calls if c['method'] == 'probe.gridRead'
                    and c['params'].get('operation') == 'read' and c['params'].get('trackId') == control_target]
    save('survey-report.json', {'evidence': 'E302', 'presets': list(rows.values()),
        'graphVerdicts': dict(Counter(r['graph']['verdict'] for r in rows.values())),
        'catalogVerdicts': dict(Counter(r['catalog']['verdict'] for r in rows.values())),
        'catalogTypes': len({e['typeUuid'] for e in entries}), 'matchedFilenames': len(matched),
        'schemaClasses': len(schemas), 'runs': runs, 'controlCaptureWireMs': control_wire,
        'originalStateMatches': snapshots_equal, 'preservedGraphMatchesNormalizedBaseline': True,
        'finalReaderReleased': True,
        'engineState': 'Operator reported active at entry. No engine or transport command was sent.',
        'limits': ['One extra candidate had no recognized top-level Grid name; its scratch track was deleted.',
                   'A cursor settle refusal caused no fixture write. Read-only repointing restored its identity.',
                   'Scratch setup can mark the project modified. No save or saved-file preservation claim.']})
    print(json.dumps({'presets': len(rows), 'catalogTypes': len({e['typeUuid'] for e in entries}),
                      'filenameMatches': len(matched), 'schemaClasses': len(schemas), 'runs': runs}, indent=2))


if __name__ == '__main__':
    main()
