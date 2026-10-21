"""Resolve Grid metadata offline. No bridge client or vendor class loader is used."""
import argparse
import hashlib
from dataclasses import asdict
import json
from pathlib import Path
import sys
import time

from grid_symbols.scan import Jar, Limits, Refusal, rss_bytes
from grid_symbols.resolve import resolve, validate

ROOT = Path(__file__).resolve().parents[3]
SELECTORS = Path(__file__).parent / 'grid_symbols/selectors.json'
MANIFEST = ROOT / 'context/plan/phase-9/9b-grid-symbol-manifest.md'
PINNED_SHA = '382c655d0b9e8db6bd433dc6100ef3a4ee23abf6a6615f79c40f0c2645792c93'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--jar', type=Path, required=True)
    parser.add_argument('--report', type=Path, required=True)
    parser.add_argument('--verify-pinned', action='store_true', help='Compare with the 6.0.6 manifest after discovery.')
    args = parser.parse_args()
    started = time.perf_counter()
    jar = None
    try:
        rules = json.loads(SELECTORS.read_text())
        jar = Jar(args.jar)
        types, rows = resolve(jar,rules)
        verdict = validate(jar,rules,types,rows)
        jar.check()
        scan_ms = (time.perf_counter() - started) * 1000
        if args.verify_pinned:
            # The expected names enter only after discovery and validation.
            from grid_symbols.oracle import manifest_rows, pinned, EXTRA, expand, TYPE_NAMES
            if jar.sha256 != PINNED_SHA:
                raise Refusal('pinned-oracle-jar-mismatch')
            source = manifest_rows(MANIFEST)
            expected = pinned(jar,source)
            if rows != expected:
                raise Refusal('pinned-member-table-mismatch')
            for name,role in TYPE_NAMES.items():
                if role in types and types[role] != expand(name):
                    raise Refusal('pinned-type-table-mismatch:' + role)
            if any(expand(n) not in types.values() for n in EXTRA):
                raise Refusal('missing-type-dependency')
            verdict['pinnedTable'] = 'pass'
        report = {'result':'pass', 'jarSha256':jar.sha256,
                  'jarPath':str(args.jar.resolve()), 'jarMtimeNs':args.jar.stat().st_mtime_ns,
                  'selectorSha256':hashlib.sha256(SELECTORS.read_bytes()).hexdigest(), 'scanElapsedMs':round(scan_ms,3),
                  'timingsMs':{k:round(v,3) for k,v in jar.timings.items()},
                  'counts':jar.stats, 'limits':asdict(jar.limits), 'peakRssBytes':rss_bytes(),
                  'verdict':verdict, 'types':types, 'members':rows,
                  'liveInvariants':{r['role']:r['liveInvariant'] for r in rules['members']},
                  'bridgeCalls':0,'nativeCommands':0,'vendorClassesInitialized':0}
    except (Refusal,ValueError,KeyError,IndexError,OSError) as error:
        report = {'result':'refused','reason':str(error),'writeAuthority':False}
    finally:
        if jar is not None:
            jar.close()
    args.report.parent.mkdir(parents=True,exist_ok=True)
    args.report.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k not in ('types','members','liveInvariants')},indent=2))
    return 0 if report['result']=='pass' else 1


if __name__ == '__main__':
    sys.exit(main())
