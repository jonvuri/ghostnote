#!/usr/bin/env python3
"""Summarize E406 attempt 3: time, wire turns and method attribution of each composition and its revert."""
import gzip, json, os, sys

directory = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'attempt-3')

def load(label):
    name = next(item for item in sorted(os.listdir(directory)) if item.split('-', 1)[1].startswith(label))
    with gzip.open(os.path.join(directory, name)) as handle:
        return json.load(handle)

def attribution(record):
    totals = {}
    for call in record['calls']:
        method = call['method']
        if method == 'batch.run':
            results = json.loads(call['wire']).get('result', {}).get('results', [])
            method = 'batch:' + '+'.join(item['method'] for item in results if item['method'] != 'cursor.pointTrack')
        count, ms = totals.get(method, (0, 0.0))
        totals[method] = (count + 1, ms + call['received'] - call['sent'])
    return sorted(totals.items(), key=lambda item: -item[1][1])

summary = json.load(open(os.path.join(directory, next(n for n in os.listdir(directory) if n.endswith('-result.json')))))
assert summary['passed'] and summary['cleanup']
rows = []
for item in summary['results']:
    compose = load(item['label'] + '-compose')
    rows.append({
        'case': item['label'],
        'compose': {'ms': item['compose']['ms'], 'turns': item['compose']['turns'], 'bytes': item['compose']['bytes']},
        'revert': {'ms': item['revert']['ms'], 'turns': item['revert']['turns']},
        'composeTop': [[method, count, round(ms)] for method, (count, ms) in attribution(compose)[:5]],
        'observed': item['observed'],
    })
json.dump(rows, sys.stdout, indent=2)
print()
