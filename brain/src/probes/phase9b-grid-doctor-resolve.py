"""Resolve the doctor candidates offline, including the separately traced undo roles."""
import argparse
from dataclasses import asdict
import hashlib
import json
from pathlib import Path
import time

from grid_symbols.scan import Jar, Refusal, rss_bytes
from grid_symbols.resolve import resolve, validate

ROOT = Path(__file__).resolve().parents[3]


def rules():
    base = json.loads((Path(__file__).parent / 'grid_symbols/selectors.json').read_text())
    base['members'] += json.loads((Path(__file__).parent / 'grid_doctor/undo-selectors-v20.json').read_text())
    return base


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--jar', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    started = time.perf_counter()
    selectors = rules()
    encoded = (json.dumps(selectors, indent=2) + '\n').encode()
    jar = None
    try:
        jar = Jar(args.jar)
        types, members = resolve(jar, selectors)
        verdict = validate(jar, selectors, types, members)
        jar.check()
        report = {'result': 'pass', 'jarSha256': jar.sha256, 'jarPath': str(args.jar.resolve()),
                  'jarMtimeNs': args.jar.stat().st_mtime_ns, 'jarMtimeNsText': str(args.jar.stat().st_mtime_ns),
                  'selectorSha256': hashlib.sha256(encoded).hexdigest(),
                  'scanElapsedMs': round((time.perf_counter() - started) * 1000, 3),
                  'timingsMs': jar.timings, 'counts': jar.stats, 'limits': asdict(jar.limits),
                  'peakRssBytes': rss_bytes(), 'verdict': verdict, 'types': types, 'members': members,
                  'liveInvariants': {r['role']: r['liveInvariant'] for r in selectors['members']},
                  'bridgeCalls': 0, 'nativeCommands': 0, 'vendorClassesInitialized': 0}
    except (Refusal, ValueError, KeyError, IndexError, OSError) as error:
        report = {'result': 'refused', 'reason': str(error), 'writeAuthority': False}
    finally:
        if jar:
            jar.close()
    (args.output / 'selectors.json').write_bytes(encoded)
    (args.output / 'candidate.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({k: v for k, v in report.items() if k not in ('types', 'members', 'liveInvariants')}, indent=2))
    return 0 if report['result'] == 'pass' else 1


if __name__ == '__main__':
    raise SystemExit(main())
