"""Prepare the 6.1.4 guarded doctor resources from the resolved symbol table.

The output is candidate metadata for the research probe. It grants no write
authority. Every pin is verified against the jar as data. No vendor class is
loaded or initialized, and no host request is sent. The owned-tree classes
come from the checkpoint-17 collector report (9b.6h) or from an owned-census
report (9b.6j). An earlier candidate can be reused byte for byte when this
scan reproduces its table.
"""
import argparse
import copy
from dataclasses import asdict
import hashlib
import json
from pathlib import Path
import time

from grid_symbols.scan import Jar, Refusal, ancestors, instructions, parse, rss_bytes
from grid_symbols.resolve import validate
from .contracts import references

MAX_SECONDS = 120
MAX_RESOURCE = 128 * 1024
RECORDING_EDIT_VARIANT = {'role': 'journal-recording-edit', 'from': 2, 'to': 0,
                          'reason': 'private-to-package-access-only',
                          'evidence': 'E337 and 614-resolution/checkpoint-2 localVariants'}


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def member(cls, name, desc, kind='method'):
    pool = cls.methods if kind == 'method' else cls.fields
    found = [m for m in pool if m.name == name and m.desc == desc]
    if len(found) != 1:
        raise Refusal(f'guard-member-not-unique:{cls.name}.{name}{desc}')
    return found[0]


def adjusted_selectors(rules, table_rows, require_variant=True):
    """Apply the one traced access variant. Refuse any other flag change.

    The 6.1.4 preparation requires the traced variant. The upgrade tool
    (9b.7) accepts a table without any access change.
    """
    adjusted = copy.deepcopy(rules)
    by_role = {r['role']: r for r in table_rows}
    variants = []
    for rule in adjusted['members']:
        row = by_role.get(rule['role'])
        if row is None:
            raise Refusal('guard-table-missing-role:' + rule['role'])
        if row['flags'] != rule['flags']:
            v = RECORDING_EDIT_VARIANT
            if rule['role'] != v['role'] or rule['flags'] != v['from'] or row['flags'] != v['to']:
                raise Refusal('guard-untraced-access-change:' + rule['role'])
            rule['flags'] = v['to']
            variants.append(dict(v))
    if len(variants) > 1 or require_variant and len(variants) != 1:
        raise Refusal('guard-variant-count')
    adjusted['variants'] = variants
    return adjusted


def field_sites(cls, method, owner):
    result = set()
    for r in references(cls, method):
        if r['owner'] == owner and r['opcode'] in (178, 179, 180, 181):
            result.add((r['opcode'], r['name'], r['descriptor']))
    return result


def list_calls(cls, method):
    return {r['name'] for r in references(cls, method)
            if r['owner'] == 'java/util/List' and r['opcode'] == 185}


def verify_field_pin(jar, pin, types):
    owner = types[pin['declaringRole']] if 'declaringRole' in pin else pin['declaring']
    cls = jar.code(owner)
    field = member(cls, pin['name'], pin['descriptor'], 'field')
    if field.flags != pin['flags']:
        raise Refusal('guard-field-flags:' + pin['role'])
    static = bool(field.flags & 8)
    if static != bool(pin.get('static', False)):
        raise Refusal('guard-field-static:' + pin['role'])
    read_ops = {178} if static else {180}
    write_ops = {179} if static else {181}
    checks = {'readers': [], 'writers': []}
    for name, desc in pin.get('readers', []):
        m = member(cls, name, desc)
        sites = field_sites(cls, m, owner)
        if not any(op in read_ops and n == pin['name'] for op, n, _ in sites):
            raise Refusal(f'guard-reader-missing:{pin["role"]}:{name}{desc}')
        checks['readers'].append([name, desc])
    for name, desc in pin.get('writers', []):
        m = member(cls, name, desc)
        sites = field_sites(cls, m, owner)
        if not any(op in write_ops and n == pin['name'] for op, n, _ in sites):
            raise Refusal(f'guard-writer-missing:{pin["role"]}:{name}{desc}')
        checks['writers'].append([name, desc])
    for key, wanted in pin.get('listCalls', {}).items():
        name, desc = key.split('(', 1)
        m = member(cls, name, '(' + desc)
        if not set(wanted) <= list_calls(cls, m):
            raise Refusal(f'guard-list-call-missing:{pin["role"]}:{key}')
        checks.setdefault('listCalls', []).append(key)
    if 'calledFromRole' in pin:
        checks['calledFromRole'] = pin['calledFromRole']
    return {'role': pin['role'], 'declaring': owner, 'name': pin['name'],
            'descriptor': pin['descriptor'], 'flags': pin['flags'], 'static': static,
            'check': pin['check'], 'verified': checks}


def static_writers(jar, owner, name, desc):
    """Scan every class as data for a static store to the flag."""
    result = []
    token = owner.encode()
    for entry in jar.zip.namelist():
        if not entry.endswith('.class'):
            continue
        jar.check()
        data = jar.zip.read(entry)
        if token not in data:
            continue
        cls = parse(data, True)
        for m in cls.methods:
            for r in references(cls, m):
                if r['opcode'] == 179 and (r['owner'], r['name'], r['descriptor']) == (owner, name, desc):
                    result.append([cls.name, m.name, m.desc])
    return sorted(result)


def verify_disposal_call(jar, types, pin, table_rows):
    """The disposal role body must call the flag reader statically."""
    role = next(r for r in table_rows if r['role'] == pin['calledFromRole'])
    cls = jar.code(role['declaring'])
    body = member(cls, role['name'], role['descriptor'])
    reader = pin['readers'][0]
    if not any(r['opcode'] == 184 and r['owner'] == pin['declaring']
               and (r['name'], r['descriptor']) == tuple(reader) for r in references(cls, body)):
        raise Refusal('guard-disposal-tail-call-missing')


CENSUS_FORMAT = 'grid-doctor-owned-census-v1'


def owned_tree_rows(jar, plan, report):
    """Owned-tree class rows from a collector report (9b.6h) or a census report (9b.6j)."""
    if report.get('format') == CENSUS_FORMAT:
        if report['jarSha256'] != jar.sha256 or report['result'] != 'complete-over-approximation':
            raise Refusal('guard-census-report')
        # A census without pinned receivers or a live read reports None for those checks (9b.7 upgrade tool).
        # A False check is a refusal. The live exact-class guard still refuses an unknown class.
        checks = report['checks']
        if checks['pinnedMissing'] or checks['pinnedReceiversCovered'] is False \
                or checks['detachedReadCovered'] is False or checks['refusedClassCovered'] is False \
                or checks['classCount'] != len(report['classes']) \
                or not 1 <= len(report['classes']) <= 64:
            raise Refusal('guard-census-checks')
        return [{'runtime': c['name'], 'className': c['className'], 'classId': c['classId'],
                 'managed': c['classId'] == plan['managedClassId']} for c in report['classes']]
    build = next(b for b in report['builds'] if b['sha256'] == jar.sha256)
    return build['receivers']


def owned_tree(jar, plan, report_path):
    report = json.loads(report_path.read_bytes())
    classes, managed = [], []
    for r in owned_tree_rows(jar, plan, report):
        name = r['runtime']
        if name not in jar.classes:
            raise Refusal('guard-owned-class-absent:' + name)
        classes.append({'name': name, 'className': r['className'], 'classId': r['classId'],
                        'managed': bool(r['managed'])})
        if r['managed']:
            managed.append(name)
            if r['classId'] != plan['managedClassId']:
                raise Refusal('guard-managed-class-id')
    if len(managed) != plan['managedNodes'] or len(classes) != len({c['name'] for c in classes}):
        raise Refusal('guard-owned-managed-count')
    return {'classes': classes, 'managed': managed, 'managedNodes': plan['managedNodes'],
            'maxNodes': plan['maxNodes'], 'maxDepth': plan['maxDepth'],
            'source': plan['source'], 'reportSha256': sha256(report_path.read_bytes())}


def reused_candidate(directory, jar, selectors_bytes, types, rows, verdict):
    """Reuse the prepared candidate bytes of an earlier session when they match this scan."""
    candidate_bytes = (directory / 'candidate.json').read_bytes()
    prior_selectors = (directory / 'selectors.json').read_bytes()
    candidate = json.loads(candidate_bytes)
    if prior_selectors != selectors_bytes or candidate['selectorSha256'] != sha256(selectors_bytes):
        raise Refusal('guard-reused-selectors-differ')
    if candidate['jarSha256'] != jar.sha256 or candidate['types'] != types or candidate['members'] != rows \
            or candidate['verdict'] != verdict or candidate['result'] != 'pass':
        raise Refusal('guard-reused-candidate-differs')
    return candidate_bytes


def prepare(args, root):
    """The 9b.6h/9b.6j procedure: inputs from the checkpoint-2 symbol table and the v20 baseline."""
    data = root / 'context/evidence/data/phase9b-doctor'
    raw = {'candidate': (data / 'v20-preparation/candidate.json').read_bytes(),
           'selectors': (data / 'v20-preparation/selectors.json').read_bytes(),
           'symbols': args.symbols.read_bytes(), 'plan': args.plan.read_bytes()}
    inputs = {k: json.loads(v) for k, v in raw.items()}
    if sha256(raw['selectors']) != inputs['candidate']['selectorSha256']:
        raise Refusal('guard-source-selectors')
    old_table = inputs['symbols']['builds'][0]['symbolTable']
    if old_table['types'] != inputs['candidate']['types'] or old_table['members'] != inputs['candidate']['members']:
        raise Refusal('guard-source-table')
    build = inputs['symbols']['builds'][1]
    if build['sha256'] != inputs['plan']['jarSha256']:
        raise Refusal('guard-plan-jar')
    jar = None
    try:
        jar = Jar(args.jar)
        if jar.sha256 != build['sha256']:
            raise Refusal('guard-jar-fingerprint')
        source = {'symbolTable': str(args.symbols), 'symbolTableSha256': sha256(raw['symbols']),
                  'sourceCandidateSha256': sha256(raw['candidate']),
                  'sourceSelectorSha256': sha256(raw['selectors'])}
        return prepare_resources(jar, inputs['plan'], raw['plan'], inputs['selectors'],
                                 build['symbolTable']['types'], build['symbolTable']['members'],
                                 args.collector_report, candidate_directory=args.candidate_directory,
                                 source=source, expected_validation=build['symbolTable']['validation'],
                                 host_version='6.1.4')
    finally:
        if jar is not None:
            jar.close()


def prepare_resources(jar, plan, plan_bytes, base_selectors, types, rows, collector_report_path,
                      candidate_directory=None, source=None, expected_validation=None, require_variant=True,
                      host_version=None):
    """Verify every pin of one table and guard plan against the open jar, then build the three resources.

    The table (``types``, ``rows``) is the resolved or traced table of this
    jar. ``base_selectors`` is the accepted build's selector set. No vendor
    class is loaded. The result grants no write authority.
    """
    start = time.perf_counter()
    if plan['format'] != 'grid-doctor-guard-plan-v1':
        raise Refusal('guard-plan-format')
    if plan['jarSha256'] != jar.sha256:
        raise Refusal('guard-plan-jar')
    selectors = adjusted_selectors(base_selectors, rows, require_variant)
    verdict = validate(jar, selectors, types, rows)
    if expected_validation is not None and verdict != expected_validation:
        raise Refusal('guard-validation-differs')
    for row in rows:
        cls = jar.code(row['declaring'])
        found = member(cls, row['name'], row['descriptor'], row['kind'])
        if found.flags != row['flags']:
            raise Refusal('guard-declaration-flags:' + row['role'])
    jar.check()
    # Guard roles. Each pin is verified against the jar as data.
    guard_types = {}
    for role, pin in plan['types'].items():
        name = pin['name']
        if name not in jar.classes or name in types.values():
            raise Refusal('guard-type-pin:' + role)
        parent = types[pin['parentRole']]
        if jar.classes[name].parent != parent or parent not in set(ancestors(jar.classes, name, jar.limits.depth)):
            raise Refusal('guard-type-parent:' + role)
        journal = types['journal']
        owner, fname, fdesc = pin['pinnedBy']['journalField']
        if owner != journal or member(jar.classes[journal], fname, fdesc, 'field').desc != 'L' + parent + ';':
            raise Refusal('guard-type-journal-field:' + role)
        guard_types[role] = name
    guard_fields = []
    for pin in plan['fields']:
        verified = verify_field_pin(jar, pin, types)
        if pin.get('static'):
            writers = static_writers(jar, pin['declaring'], pin['name'], pin['descriptor'])
            if writers != sorted([[pin['declaring'], n, d] for n, d in pin['writers']]):
                raise Refusal('guard-flag-writers:' + pin['role'])
            verified['staticWriters'] = writers
        if 'calledFromRole' in pin:
            verify_disposal_call(jar, types, pin, rows)
        guard_fields.append(verified)
    tree = owned_tree(jar, plan['ownedTree'], collector_report_path)
    jar.check()
    selectors_bytes = (json.dumps(selectors, indent=2) + '\n').encode()
    raw = {'plan': plan_bytes}
    if candidate_directory is not None:
        candidate_bytes = reused_candidate(candidate_directory, jar, selectors_bytes, types, rows, verdict)
        return finish(start, jar, raw, tree, guard_types, guard_fields, selectors_bytes, candidate_bytes)
    stat = jar.path.stat()
    candidate = {'result': 'pass', 'jarSha256': jar.sha256, 'jarPath': str(jar.path.resolve()),
                 'jarMtimeNs': stat.st_mtime_ns, 'jarMtimeNsText': str(stat.st_mtime_ns),
                 'selectorSha256': sha256(selectors_bytes),
                 'scanElapsedMs': round((time.perf_counter() - start) * 1000, 3),
                 'timingsMs': {k: round(v, 3) for k, v in jar.timings.items()},
                 'counts': jar.stats | {'codeClasses': len(jar.code_cache)}, 'limits': asdict(jar.limits),
                 'peakRssBytes': rss_bytes(), 'verdict': verdict, 'types': types, 'members': rows,
                 'liveInvariants': {r['role']: r['liveInvariant'] for r in selectors['members']},
                 'source': {**(source or {}), 'variants': selectors['variants'],
                            **({'hostVersion': host_version} if host_version else {})},
                 'bridgeCalls': 0, 'nativeCommands': 0, 'vendorClassesInitialized': 0}
    candidate_bytes = (json.dumps(candidate, indent=2) + '\n').encode()
    return finish(start, jar, raw, tree, guard_types, guard_fields, selectors_bytes, candidate_bytes)


def finish(start, jar, raw, tree, guard_types, guard_fields, selectors_bytes, candidate_bytes):
    guards = {'format': 'grid-doctor-guards-v1', 'jarSha256': jar.sha256,
              'candidateSha256': sha256(candidate_bytes), 'planSha256': sha256(raw['plan']),
              'types': guard_types, 'fields': guard_fields, 'ownedTree': tree,
              'writeAuthority': False, 'bridgeCalls': 0, 'vendorClassesInitialized': 0}
    guards_bytes = (json.dumps(guards, indent=2) + '\n').encode()
    for name, value in (('candidate', candidate_bytes), ('selectors', selectors_bytes), ('guards', guards_bytes)):
        if len(value) > MAX_RESOURCE:
            raise Refusal('guard-resource-limit:' + name)
    if time.perf_counter() - start > MAX_SECONDS:
        raise Refusal('guard-deadline')
    return {'candidate': candidate_bytes, 'selectors': selectors_bytes, 'guards': guards_bytes}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--jar', type=Path, required=True)
    parser.add_argument('--symbols', type=Path, required=True)
    parser.add_argument('--plan', type=Path, required=True)
    parser.add_argument('--collector-report', type=Path, required=True,
                        help='checkpoint-17 collector report (9b.6h) or an owned-census report (9b.6j)')
    parser.add_argument('--candidate-directory', type=Path, default=None,
                        help='reuse the candidate and selectors bytes of an earlier preparation')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[4]
    outputs = {name: args.output / f'{name}.json' for name in ('candidate', 'selectors', 'guards')}
    if any(p.exists() for p in outputs.values()):
        raise Refusal('guard-output-exists')
    start = time.perf_counter()
    produced = prepare(args, root)
    args.output.mkdir(parents=True, exist_ok=True)
    for name, path in outputs.items():
        with path.open('xb') as stream:
            stream.write(produced[name])
    summary = {name: {'bytes': len(value), 'sha256': sha256(value)} for name, value in produced.items()}
    summary['scanElapsedMs'] = round((time.perf_counter() - start) * 1000, 3)
    summary['peakRssBytes'] = rss_bytes()
    guards = json.loads(produced['guards'])
    summary['guardCounts'] = {'types': len(guards['types']), 'fields': len(guards['fields']),
                              'ownedTreeClasses': len(guards['ownedTree']['classes'])}
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()
