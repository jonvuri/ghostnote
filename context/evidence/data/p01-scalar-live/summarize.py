"""Summarize the P01 scalar-cohort runs (E411): wall time, wire turns and method counts of each write and revert."""
import glob, gzip, json, os, sys

here = os.path.dirname(os.path.abspath(__file__))
labels = ['poly-1-set', 'poly-1-revert', 'poly-8-set', 'poly-44-set', 'remote-64-set', 'nested-eq5-8-set',
          'mixer-set', 'mixer-revert']
summary = {}
for run in ['baseline-head-2', 'change-1', 'change-2']:
    rows = {}
    for label in labels:
        [path] = glob.glob(os.path.join(here, run, f'*-{label}.json.gz'))
        data = json.load(gzip.open(path))
        rows[label] = {'ms': data['ms'], 'turns': data['turns'], 'methods': data['methods']}
    result = json.load(open(glob.glob(os.path.join(here, run, '*-result.json'))[0]))
    summary[run] = {'passed': result['passed'], 'cleanup': result['cleanup'], 'rows': rows}
json.dump(summary, sys.stdout, indent=1)
print()
