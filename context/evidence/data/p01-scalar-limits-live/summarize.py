"""Summarize the P01 set_device_controls limit run (E412): each write and revert, and the Diva read times."""
import glob, gzip, json, os, sys

here = os.path.dirname(os.path.abspath(__file__))
run = os.path.join(here, sys.argv[1] if len(sys.argv) > 1 else 'run-1')
rows = {}
for label in ['routes-4x16-set', 'revert-one', 'routes-8x16-set', 'routes-12x16-set', 'routes-16x16-set',
              'route-1x64-set', 'route-1x281-set']:
    [path] = glob.glob(os.path.join(run, f'*-{label}.json.gz'))
    data = json.load(gzip.open(path))
    rows[label] = {'ms': data['ms'], 'turns': data['turns'], 'methods': data['methods'],
                   'verified': data['result'].get('verified')}
reads = [json.load(gzip.open(path))['ms'] for path in glob.glob(os.path.join(run, '*-after-*.json.gz'))]
result = json.load(open(glob.glob(os.path.join(run, '*-result.json'))[0]))
json.dump({'passed': result['passed'], 'cleanup': result['cleanup'], 'rows': rows,
           'divaReadMs': {'count': len(reads), 'min': min(reads), 'max': max(reads)},
           'readbackDifferences': {item['label']: len(item['differences'])
                                   for item in result['results'] if 'differences' in item}}, sys.stdout, indent=1)
print()
