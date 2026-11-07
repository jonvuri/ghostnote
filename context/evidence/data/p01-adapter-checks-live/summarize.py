#!/usr/bin/env python3
"""Summarize E407: time, wire turns and method attribution of each composition and its revert, by run."""
import gzip, json, os, sys

root = os.path.dirname(os.path.abspath(__file__))
RUNS = ['attempt-1', 'd44-attempt-1', 'd44-attempt-2', 'd44-attempt-3', 'attempt-2', 'd44-attempt-4']

def load(directory, label):
    name = next(item for item in sorted(os.listdir(directory)) if item.split('-', 1)[1].startswith(label))
    with gzip.open(os.path.join(directory, name)) as handle:
        return json.load(handle)

def attribution(record):
    totals = {}
    for call in record['calls']:
        method = call['method']
        if method == 'batch.run':
            results = json.loads(call['wire']).get('result', {}).get('results', [])
            method = 'batch:' + '+'.join(sorted({item['method'] for item in results if item['method'] != 'cursor.pointTrack'}))
        count, ms = totals.get(method, (0, 0.0))
        totals[method] = (count + 1, ms + call['received'] - call['sent'])
    return sorted(totals.items(), key=lambda item: -item[1][1])

out = {}
for run in RUNS:
    directory = os.path.join(root, run)
    summary = json.load(open(os.path.join(directory, next(n for n in os.listdir(directory) if n.endswith('-result.json')))))
    assert summary['passed'] and summary['cleanup']
    rows = []
    for item in summary['results']:
        compose = load(directory, item['label'] + '-compose')
        rows.append({
            'case': item['label'],
            'compose': {'ms': item['compose']['ms'], 'turns': item['compose']['turns'], 'bytes': item['compose']['bytes']},
            'revert': {'ms': item['revert']['ms'], 'turns': item['revert']['turns']},
            'composeTop': [[method, count, round(ms)] for method, (count, ms) in attribution(compose)[:5]],
            'observed': item['observed'],
        })
    out[run] = rows
json.dump(out, sys.stdout, indent=2)
print()
