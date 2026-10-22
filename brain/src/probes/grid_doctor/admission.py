"""Trace admission boundaries as data. Never emit a candidate table."""
import argparse
from dataclasses import asdict, dataclass
import hashlib
import json
from pathlib import Path
import time

from grid_symbols.scan import Jar, Refusal, instructions, parse, rss_bytes
from .migrate import member
from .ownership import TraceLimits, bootstraps, constant, method_trace, write_report


@dataclass
class AdmissionLimits(TraceLimits):
    hierarchy_edges: int = 4000000


class Work:
    def __init__(self, limits):
        self.limits = limits
        self.counts = dict.fromkeys(('classes', 'methods', 'instructions', 'sites',
                                    'traces', 'hierarchy_edges'), 0)

    def tick(self, key, count=1):
        self.counts[key] += count
        if hasattr(self.limits, key) and self.counts[key] > getattr(self.limits, key):
            raise Refusal('admission-' + key + '-limit')


def lineage(jar, name, work):
    """Follow superclass edges only. Do not infer interface dispatch."""
    result = []
    while name in jar.classes:
        jar.check()
        work.tick('hierarchy_edges')
        if name in result:
            raise Refusal('admission-inheritance-cycle')
        if len(result) >= jar.limits.depth:
            raise Refusal('admission-inheritance-depth')
        result.append(name)
        name = jar.classes[name].parent
    return result, name


def lookup(jar, owner, name, descriptor, work):
    chain, external = lineage(jar, owner, work)
    for declaring in chain:
        matches = [m for m in jar.classes[declaring].methods
                   if (m.name, m.desc) == (name, descriptor)]
        if len(matches) > 1:
            raise Refusal('admission-duplicate-declaration')
        if matches:
            m = matches[0]
            if m.flags & (0x2 | 0x8 | 0x100 | 0x400):
                raise Refusal('admission-nonconcrete-instance-slot')
            return declaring
    raise Refusal('admission-unresolved-superclass-slot:' + str(external))


def slot_census(jar, slot, work):
    """Enumerate in-jar class receivers. This is not a runtime receiver proof."""
    base, name, desc = (slot[k] for k in ('receiverBase', 'name', 'descriptor'))
    if base not in jar.classes:
        raise Refusal('admission-missing-receiver-base')
    declarations, receivers = [], {}
    for cls in jar.classes.values():
        jar.check()
        for method in cls.methods:
            if (method.name, method.desc) == (name, desc):
                declarations.append({'owner': cls.name, 'name': name,
                                     'descriptor': desc, 'flags': method.flags})
        chain, _ = lineage(jar, cls.name, work)
        if base in chain and not cls.flags & (0x200 | 0x400):
            declaring = lookup(jar, cls.name, name, desc, work)
            receivers.setdefault(declaring, []).append(cls.name)
    if not receivers:
        raise Refusal('admission-no-concrete-receivers')
    return {**slot, 'declarations': sorted(declarations, key=lambda r: r['owner']),
            'concreteReceiversByDeclaration': {k: sorted(v) for k, v in sorted(receivers.items())},
            'concreteReceiverCount': sum(map(len, receivers.values()))}


def validate_seed(jar, seed):
    if jar.sha256 != seed['input']['sha256']:
        raise Refusal('admission-seed-jar-hash')
    if not seed.get('methods') or len(seed['methods']) > 512:
        raise Refusal('admission-seed-method-limit')
    bootstrap_cache = {}
    for row in seed['methods']:
        cls = jar.code(row['owner'])
        if cls.name not in bootstrap_cache:
            bootstrap_cache[cls.name] = bootstraps(jar.zip.read(cls.name + '.class'), cls)
        actual = method_trace(jar, cls, member(cls, row['name'], row['descriptor']),
                              bootstrap_cache[cls.name])
        if actual != row:
            raise Refusal('admission-seed-trace-disagreement')


def trace(jar, seed, plan, limits=None):
    limits = limits or AdmissionLimits()
    validate_seed(jar, seed)
    if plan['jarSha256'] != jar.sha256:
        raise Refusal('admission-plan-jar-hash')
    if len(plan['slots']) > 8 or len(plan['traceOwners']) > 16 or len(plan['methods']) > 128:
        raise Refusal('admission-plan-limit')
    work = Work(limits)
    slots = [slot_census(jar, s, work) for s in plan['slots']]
    required = {(r['owner'], r['name'], r['descriptor']) for r in plan['methods']}
    for slot in slots:
        required.update((r['owner'], r['name'], r['descriptor']) for r in slot['declarations'])
    owners, incoming = set(plan['traceOwners']), set(plan['incomingOwners'])
    if len(incoming) > 16 or not owners | incoming <= jar.classes.keys():
        raise Refusal('admission-plan-owner')
    for owner, name, desc in required:
        if owner not in jar.classes or len([m for m in jar.classes[owner].methods
                                           if (m.name, m.desc) == (name, desc)]) != 1:
            raise Refusal('admission-missing-or-duplicate-required-method')
    found, traces, sites, handles, classes = set(), [], [], [], {}
    for metadata in jar.classes.values():
        jar.check()
        data = jar.zip.read(metadata.name + '.class')
        cls = parse(data, True)
        work.tick('classes')
        bootstrap = None
        for index, cp in enumerate(cls.cp):
            if cp and cp[0] == 15:
                value = constant(cls, index)
                if value['target'].get('owner') in incoming:
                    work.tick('sites')
                    handles.append({'owner': cls.name, 'constantIndex': index, **value})
        for method in cls.methods:
            jar.check()
            work.tick('methods')
            raw = instructions(method.code)
            work.tick('instructions', len(raw))
            has_site = False
            for offset, opcode, args in raw:
                if 178 <= opcode <= 185:
                    ref = constant(cls, args[0] * 256 + args[1])
                    if ref['owner'] in incoming:
                        work.tick('sites')
                        has_site = True
                        sites.append({'caller': cls.name, 'method': method.name,
                                      'descriptor': method.desc, 'offset': offset,
                                      'opcode': opcode, 'target': ref})
            key = (cls.name, method.name, method.desc)
            if key in required or cls.name in owners or has_site:
                work.tick('traces')
                found.add(key)
                if bootstrap is None:
                    bootstrap = bootstraps(data, cls)
                traces.append(method_trace(jar, cls, method, bootstrap))
                classes[cls.name] = {'sha256': hashlib.sha256(data).hexdigest(),
                                     'parent': cls.parent, 'interfaces': list(cls.interfaces),
                                     'flags': cls.flags}
    if required - found:
        raise Refusal('admission-missing-required-method')
    return {'result': 'refused', 'reason': 'history-bounds-and-command-nonreentrancy-unproved',
            'completeTable': False, 'writeAuthority': False, 'boundedAdmission': False,
            'slots': slots, 'methods': traces, 'classes': classes, 'directSites': sites,
            'methodHandles': handles, 'work': work.counts,
            'coverage': {'requiredTypes': 55, 'requiredMembers': 76, 'validatedNewTableMembers': 0},
            'limitsOfEvidence': [
                'The plan pins investigation inputs for this jar. It contains no reusable selectors.',
                'Superclass lookup covers in-jar class receivers only, not external subclasses.',
                'Interface default dispatch, reflection, native code, and external callers are not proved.',
                'Event routing does not prove command non-reentrancy or exclude every mode writer.',
                'No runtime history, descriptor flags, queue state, or mode is measured.',
                'No complete role table, dynamic-call equivalence rule, or live admission is produced.']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('jar', 'seed', 'plan', 'report'):
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    if args.report.exists():
        raise Refusal('admission-report-exists')
    inputs = {}
    for name, limit in (('seed', 8 * 1024**2), ('plan', 64 * 1024)):
        path = getattr(args, name)
        if path.stat().st_size > limit:
            raise Refusal('admission-' + name + '-byte-limit')
        inputs[name] = path.read_bytes()
    started, jar, limits = time.perf_counter(), None, AdmissionLimits()
    report = {'result': 'refused', 'reason': 'incomplete-trace', 'completeTable': False,
              'writeAuthority': False, 'boundedAdmission': False}
    try:
        jar = Jar(args.jar)
        report.update(trace(jar, json.loads(inputs['seed']), json.loads(inputs['plan']), limits))
        jar.check()
    except (Refusal, ValueError, KeyError, IndexError, OSError) as error:
        report['reason'] = str(error)
    finally:
        if jar:
            report['input'] = {'path': str(jar.path), 'sha256': jar.sha256, 'counts': jar.stats,
                               'retainedCodeClasses': len(jar.code_cache), 'limits': asdict(jar.limits)}
            jar.close()
    report.update(inputHashes={k: hashlib.sha256(v).hexdigest() for k, v in inputs.items()},
                  elapsedMs=round((time.perf_counter() - started) * 1000, 3),
                  peakRssBytes=rss_bytes(), traceLimits=asdict(limits),
                  bridgeCalls=0, nativeCommands=0, vendorClassesInitialized=0)
    size = write_report(args.report, report, limits)
    print(json.dumps({k: report[k] for k in ('result', 'reason', 'elapsedMs', 'peakRssBytes')}
                     | {'reportBytes': size}))
    return 0 if 'work' in report else 1


if __name__ == '__main__':
    raise SystemExit(main())
