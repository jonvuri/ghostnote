"""Compare the immutable entry inventory with the current files. Read-only; the report path must not exist."""
import argparse
import hashlib
import json
import os
import sys


def sha256(path: str) -> str:
    digest = hashlib.sha256()
    with open(path, 'rb') as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b''):
            digest.update(chunk)
    return digest.hexdigest()


def check(inventory: dict, session: str, inventory_path: str, note: str) -> dict:
    missing, changed = [], []
    for entry in inventory['files']:
        path = entry['path']
        if not os.path.isfile(path):
            missing.append(path)
            continue
        if os.path.getsize(path) != entry['bytes'] or sha256(path) != entry['sha256']:
            changed.append(path)
    return {
        'format': 'grid-doctor-preservation-v1', 'session': session, 'inventory': inventory_path,
        'checked': len(inventory['files']), 'missing': missing, 'changed': changed,
        'result': 'unchanged' if not missing and not changed else 'differs', 'note': note,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--inventory', required=True)
    parser.add_argument('--session', required=True)
    parser.add_argument('--note', default='')
    parser.add_argument('--report', required=True)
    args = parser.parse_args()
    if os.path.exists(args.report):
        print('report path exists', file=sys.stderr)
        return 2
    with open(args.inventory, encoding='utf-8') as handle:
        inventory = json.load(handle)
    report = check(inventory, args.session, os.path.relpath(args.inventory), args.note)
    with open(args.report, 'x', encoding='utf-8') as handle:
        json.dump(report, handle, indent=2)
        handle.write('\n')
    print(json.dumps({k: report[k] for k in ('checked', 'result', 'missing', 'changed')}))
    return 0


if __name__ == '__main__':
    sys.exit(main())
