"""Trace receiver slots and incoming symbolic references. Never admit writes."""
import argparse
from dataclasses import asdict, dataclass
import hashlib
import json
from pathlib import Path
import time

from grid_symbols.scan import Jar, Refusal, instructions, parse, rss_bytes
from .admission import AdmissionLimits, Work, lineage, slot_census, validate_seed
from .ownership import bootstraps, constant, method_trace, write_report


@dataclass
class ReceiverLimits(AdmissionLimits):
    lookups: int = 16384


def identity(row):
    return row['owner'], row['name'], row['descriptor']


class Declarations:
    """Find class declarations. This does not select a virtual call target."""
    def __init__(self, jar, work):
        self.jar, self.work, self.cache = jar, work, {}
        self.work.counts.setdefault('lookups', 0)

    def interface_field(self, owner, name, descriptor, path=()):
        self.jar.check()
        self.work.tick('hierarchy_edges')
        if owner in path or len(path) >= self.jar.limits.depth:
            raise Refusal('receiver-interface-cycle-or-depth')
        cls = self.jar.classes.get(owner)
        if cls is None:
            return {'status': 'external-interface', 'owner': owner}
        if not cls.flags & 0x200:
            raise Refusal('receiver-noninterface-parent')
        matches = [m for m in cls.fields if (m.name, m.desc) == (name, descriptor)]
        if len(matches) > 1:
            raise Refusal('receiver-duplicate-declaration')
        if matches:
            return {'status': 'declaration', 'owner': owner, 'flags': matches[0].flags}
        return self.interface_fields(cls.interfaces, name, descriptor, (*path, owner))

    def interface_fields(self, owners, name, descriptor, path=()):
        found = {}
        for owner in owners:
            result = self.interface_field(owner, name, descriptor, path)
            if result and result['status'] != 'declaration':
                return result
            if result:
                found[result['owner']] = result
        if len(found) > 1:
            return {'status': 'ambiguous-interface-field', 'owners': sorted(found)}
        return next(iter(found.values()), None)

    def find(self, kind, owner, name, descriptor):
        key = kind, owner, name, descriptor
        if key in self.cache:
            return self.cache[key]
        self.work.tick('lookups')
        chain, external = lineage(self.jar, owner, self.work)
        result = {'status': 'external', 'owner': external}
        for declaring in chain:
            cls = self.jar.classes[declaring]
            if cls.flags & 0x200:
                result = {'status': 'interface', 'owner': declaring}
                break
            members = cls.fields if kind == 'field' else cls.methods
            matches = [m for m in members if (m.name, m.desc) == (name, descriptor)]
            if len(matches) > 1:
                raise Refusal('receiver-duplicate-declaration')
            if matches:
                result = {'status': 'declaration', 'owner': declaring, 'flags': matches[0].flags}
                break
            if kind == 'field':
                interface = self.interface_fields(cls.interfaces, name, descriptor)
                if interface:
                    result = interface
                    break
        self.cache[key] = result
        return result


def trace(jar, seed, plan, limits=None):
    limits = limits or ReceiverLimits()
    validate_seed(jar, seed)
    if plan['jarSha256'] != jar.sha256:
        raise Refusal('receiver-plan-jar-hash')
    if len(plan['slots']) > 8 or len(plan['methods']) > 128 or len(plan['targets']) > 32:
        raise Refusal('receiver-plan-limit')
    work = Work(limits)
    work.counts['lookups'] = 0
    declarations = Declarations(jar, work)
    required = {identity(r) for r in plan['methods']}
    if len(required) != len(plan['methods']):
        raise Refusal('receiver-duplicate-plan-method')
    targets = set()
    for row in plan['targets']:
        kind = row['kind']
        if kind not in ('field', 'method'):
            raise Refusal('receiver-target-kind')
        result = declarations.find(kind, *identity(row))
        if result['status'] != 'declaration' or result['owner'] != row['owner']:
            raise Refusal('receiver-target-not-declaration')
        key = (kind, *identity(row))
        if key in targets:
            raise Refusal('receiver-duplicate-target')
        targets.add(key)
    slots = [slot_census(jar, s, work) for s in plan['slots']]
    for slot in slots:
        required.update(identity(r) for r in slot['declarations'])
    for owner, name, desc in required:
        if owner not in jar.classes or len([m for m in jar.classes[owner].methods
                                           if (m.name, m.desc) == (name, desc)]) != 1:
            raise Refusal('receiver-missing-or-duplicate-method')
    signatures = {(k, n, d) for k, _, n, d in targets}

    def match(ref):
        kind = 'field' if ref.get('tag') == 9 else 'method'
        if (kind, ref.get('name'), ref.get('descriptor')) not in signatures:
            return None
        found = declarations.find(kind, *identity(ref))
        if found['status'] == 'declaration':
            if (kind, found['owner'], ref['name'], ref['descriptor']) in targets:
                return found
            return None
        # Keep unresolved references separate. They cannot prove absence.
        return found

    methods, sites, handles, unresolved, found_methods, classes = [], [], [], [], set(), {}
    for metadata in jar.classes.values():
        jar.check()
        data = jar.zip.read(metadata.name + '.class')
        cls = parse(data, True)
        work.tick('classes')
        bs = None
        for index, cp in enumerate(cls.cp):
            if cp and cp[0] == 15:
                value = constant(cls, index)
                hit = match(value['target'])
                if hit:
                    work.tick('sites')
                    row = {'caller': cls.name, 'constantIndex': index, **value, 'resolution': hit}
                    (handles if hit['status'] == 'declaration' else unresolved).append(row)
        for method in cls.methods:
            jar.check()
            work.tick('methods')
            raw = instructions(method.code)
            work.tick('instructions', len(raw))
            retain = (cls.name, method.name, method.desc) in required
            for offset, opcode, args in raw:
                if 178 <= opcode <= 185:
                    ref = constant(cls, args[0] * 256 + args[1])
                    hit = match(ref)
                    if hit:
                        work.tick('sites')
                        row = {'caller': cls.name, 'method': method.name, 'descriptor': method.desc,
                               'offset': offset, 'opcode': opcode, 'target': ref, 'resolution': hit}
                        (sites if hit['status'] == 'declaration' else unresolved).append(row)
                        retain = retain or hit['status'] == 'declaration'
            if retain:
                work.tick('traces')
                if bs is None:
                    bs = bootstraps(data, cls)
                methods.append(method_trace(jar, cls, method, bs))
                found_methods.add((cls.name, method.name, method.desc))
                classes[cls.name] = {'sha256': hashlib.sha256(data).hexdigest(),
                                     'parent': cls.parent, 'interfaces': list(cls.interfaces),
                                     'flags': cls.flags}
    if required - found_methods:
        raise Refusal('receiver-missing-required-trace')
    return {'result': 'refused', 'reason': 'runtime-receiver-and-command-closure-unproved',
            'completeTable': False, 'boundedAdmission': False, 'writeAuthority': False,
            'slots': slots, 'methods': methods, 'classes': classes, 'sites': sites,
            'methodHandles': handles, 'unresolvedReferences': unresolved, 'work': work.counts,
            'coverage': {'requiredTypes': 55, 'requiredMembers': 76, 'validatedNewTableMembers': 0},
            'limitsOfEvidence': [
                'The explicit plan is investigation input, not a reusable role selector.',
                'A symbolic declaration is not a runtime virtual receiver or reachable-path proof.',
                'Interface lookup, external callers, reflection, and native callbacks remain unproved.',
                'No command closure, history growth bound, or tracking-mode exclusion is established.',
                'No runtime descriptor, history, or mode is measured. No live table is emitted.']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('jar', 'seed', 'plan', 'report'):
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    if args.report.exists():
        raise Refusal('receiver-report-exists')
    inputs = {}
    for name, limit in (('seed', 8 * 1024**2), ('plan', 64 * 1024)):
        path = getattr(args, name)
        if path.stat().st_size > limit:
            raise Refusal('receiver-' + name + '-byte-limit')
        inputs[name] = path.read_bytes()
    started, jar, limits = time.perf_counter(), None, ReceiverLimits()
    report = {'result': 'refused', 'reason': 'incomplete-trace', 'completeTable': False,
              'boundedAdmission': False, 'writeAuthority': False}
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
                  limits=asdict(limits), elapsedMs=(time.perf_counter() - started) * 1000,
                  peakRssBytes=rss_bytes())
    size = write_report(args.report, report, limits)
    print(json.dumps({k: report[k] for k in ('result', 'reason', 'elapsedMs', 'peakRssBytes')} |
                     {'reportBytes': size}))
    return 0 if 'work' in report else 2


if __name__ == '__main__':
    raise SystemExit(main())
