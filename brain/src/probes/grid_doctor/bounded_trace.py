"""Reuse the receiver trace with a bounded code cache for large seed reports."""
import argparse
from dataclasses import asdict
import hashlib
import json
from pathlib import Path
import time

from grid_symbols.scan import Jar, Refusal, rss_bytes
from .descriptor_resolution import Code
from .receiver_trace import ReceiverLimits, trace
from .ownership import write_report


class StreamingJar(Jar):
    def __init__(self, path):
        self.reader = Code()
        super().__init__(path)

    def code(self, name):
        return self.reader.get(self, name)

    def close(self):
        super().close()
        self.reader.cache.clear()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for key in ('jar', 'seed', 'plan', 'report'):
        parser.add_argument('--' + key, type=Path, required=True)
    args = parser.parse_args()
    if args.report.exists():
        raise Refusal('bounded-trace-report-exists')
    raw = {}
    for key, limit in [('seed', 8 * 1024**2), ('plan', 64 * 1024)]:
        path = getattr(args, key)
        if path.stat().st_size > limit:
            raise Refusal('bounded-trace-input-limit')
        raw[key] = path.read_bytes()
    start, jar = time.perf_counter(), None
    limits = ReceiverLimits()
    report = {'result': 'refused', 'reason': 'incomplete-trace', 'completeTable': False,
              'boundedAdmission': False, 'writeAuthority': False}
    try:
        jar = StreamingJar(args.jar)
        report.update(trace(jar, json.loads(raw['seed']), json.loads(raw['plan']), limits))
        jar.check()
    except (Refusal, ValueError, KeyError, IndexError, OSError) as error:
        report['reason'] = str(error)
    finally:
        if jar:
            report['input'] = {'path': str(jar.path), 'sha256': jar.sha256, 'counts': jar.stats,
                               'retainedCodeClasses': len(jar.reader.cache), 'limits': asdict(jar.limits)}
            jar.close()
    report.update(inputHashes={key: hashlib.sha256(value).hexdigest() for key, value in raw.items()},
                  limits=asdict(limits), elapsedMs=round((time.perf_counter() - start) * 1000, 3),
                  peakRssBytes=rss_bytes())
    size = write_report(args.report, report, limits)
    print(json.dumps({key: report[key] for key in ('result', 'reason', 'elapsedMs', 'peakRssBytes')} |
                     {'reportBytes': size}))
    return 0 if 'work' in report else 2


if __name__ == '__main__':
    raise SystemExit(main())
