"""Deterministic Grid upgrade check for a new Bitwig jar (9b.7, D52).

The check runs the offline stages of the D52 admission policy in order and
stops at the first stage that needs a decision or a missing input:

1. ``fingerprint``: the candidate jar hash, size, and modification time.
2. ``resolve``: the structural resolver with the accepted build's selectors.
   A name-only change resolves. A refusal reports a per-role census and the
   next step. A traced table from an agent session can continue the check.
3. ``body-change``: each role body compared with the accepted build as data.
4. ``census``: the owned-tree class set, when the build-specific collector
   and module reports are supplied.
5. ``guards``: the D52 runtime guard resources, when a verified guard plan is
   supplied.

Every stage reads class files as data. No vendor class is loaded or
initialized, and no host request is sent. The output never grants write
authority. The consent-gated doctor on a scratch track remains the only way
to accept a fingerprint; see ``brain/src/grid/admission.ts`` for the
product gate that consumes the accepted cache.
"""
import argparse
from collections import defaultdict
import hashlib
import json
from pathlib import Path
import time

from grid_symbols.scan import Jar, Refusal, class_trace, rss_bytes
from grid_symbols.resolve import resolve, validate
from .body_change import closure_rows, role_rows
from .guarded_candidate import adjusted_selectors, prepare_resources
from .owned_census import FORMAT as CENSUS_FORMAT, census_report, collector_for, compare as compare_census

FORMAT = 'grid-doctor-upgrade-v1'
BASELINE_FORMAT = 'grid-doctor-upgrade-baseline-v1'
MAX_SECONDS = 300
MAX_RSS = 768 * 1024**2
MAX_REPORT = 2 * 1024**2
MAX_INPUT = 8 * 1024**2
UNCHANGED = ('same-body', 'field-same')
NEXT_STEPS = {
    'already-accepted': 'The baseline cache covers this fingerprint. No upgrade work is needed.',
    'resolution-refused': 'Trace the changed structure in an agent session (the 9b.6a to 9b.6g procedure), '
                          'record the traced table, then rerun with --traced-table.',
    'name-only-change': 'Bundle candidate.json and selectors.json in the probe extension, obtain ordinary '
                        'operator consent (D53), and run one consent-gated doctor pass on this fingerprint. '
                        'Supply --collector-report, --module-report, and --guard-plan to prepare the D52 guards first.',
    'changed-bodies': 'Trace each changed body (bounded trace, one question per body), decide under D52, derive '
                      'the guard pins, then rerun with --guard-plan, --collector-report, and --module-report.',
    'prepared': 'Bundle the prepared resources in the probe extension, obtain ordinary operator consent (D53), '
                'and run one consent-gated doctor pass on this fingerprint.',
    'input-required': 'Supply the named input and rerun the check.',
}
CONDITIONS = [
    'Every stage reads class files as data. No vendor class is loaded or initialized. No host request is sent.',
    'A resolved or traced table is a candidate. The consent-gated doctor must pass on the fingerprint before '
    'any Grid write; the product gate reads only the accepted cache.',
    'Equal body digests prove equal local logic modulo renaming only. Callee bodies are compared only when a '
    'traced closure report is supplied.',
    'The census is an over-approximation under its reachability rules; the live guard still refuses an '
    'unknown exact class.',
]


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def read_json(path, limit=MAX_INPUT):
    path = Path(path)
    if path.stat().st_size > limit:
        raise Refusal('upgrade-input-size:' + path.name)
    return json.loads(path.read_bytes())


def fingerprint_of(path):
    """The doctor fingerprint: SHA-256, byte size, and modification time in nanoseconds."""
    path = Path(path)
    stat = path.stat()
    if stat.st_size > 64 * 1024 * 1024:
        raise Refusal('upgrade-jar-size')
    with path.open('rb') as source:
        digest = hashlib.file_digest(source, 'sha256').hexdigest()
    text = f'{digest}:{stat.st_size}:{stat.st_mtime_ns}'
    return {'path': str(path.resolve()), 'sha256': digest, 'bytes': stat.st_size,
            'mtimeNs': str(stat.st_mtime_ns), 'fingerprint': text, 'key': sha256(text.encode())}


# --- baseline --------------------------------------------------------------

def assemble_baseline(accepted_path, candidate_directory, output, census_path=None):
    """Copy the accepted build's cache and resources into one baseline directory."""
    accepted = read_json(accepted_path)
    candidate_directory = Path(candidate_directory)
    candidate_bytes = (candidate_directory / 'candidate.json').read_bytes()
    selectors_bytes = (candidate_directory / 'selectors.json').read_bytes()
    candidate = json.loads(candidate_bytes)
    if accepted.get('verdict') != 'accepted' or accepted.get('writeAuthority') is not False:
        raise Refusal('baseline-accepted-verdict')
    if candidate.get('result') != 'pass' or candidate.get('selectorSha256') != sha256(selectors_bytes):
        raise Refusal('baseline-candidate-selectors')
    if not accepted['fingerprint'].startswith(candidate['jarSha256'] + ':'):
        raise Refusal('baseline-fingerprint-jar')
    if accepted.get('selectorSha256') != candidate['selectorSha256']:
        raise Refusal('baseline-accepted-selectors')
    files = {'accepted.json': Path(accepted_path).read_bytes(), 'candidate.json': candidate_bytes,
             'selectors.json': selectors_bytes}
    guards_path = candidate_directory / 'guards.json'
    if guards_path.exists():
        guards = json.loads(guards_path.read_bytes())
        if guards.get('candidateSha256') != sha256(candidate_bytes) or guards.get('jarSha256') != candidate['jarSha256']:
            raise Refusal('baseline-guards-provenance')
        files['guards.json'] = guards_path.read_bytes()
    if census_path is not None:
        census = read_json(census_path)
        if census.get('format') != CENSUS_FORMAT or census.get('jarSha256') != candidate['jarSha256']:
            raise Refusal('baseline-census-provenance')
        files['census.json'] = Path(census_path).read_bytes()
    output = Path(output)
    if output.exists():
        raise Refusal('baseline-output-exists')
    output.mkdir(parents=True)
    for name, data in files.items():
        with (output / name).open('xb') as stream:
            stream.write(data)
    summary = {'format': BASELINE_FORMAT, 'fingerprint': accepted['fingerprint'],
               'key': sha256(accepted['fingerprint'].encode()), 'hostVersion': accepted.get('hostVersion'),
               'jarSha256': candidate['jarSha256'], 'jarPath': candidate.get('jarPath'),
               'files': {name: {'bytes': len(data), 'sha256': sha256(data)} for name, data in files.items()},
               'writeAuthority': False}
    with (output / 'baseline.json').open('x') as stream:
        json.dump(summary, stream, indent=2)
        stream.write('\n')
    return summary


def load_baseline(directory):
    directory = Path(directory)
    summary = read_json(directory / 'baseline.json')
    if summary.get('format') != BASELINE_FORMAT:
        raise Refusal('baseline-format')
    loaded = {}
    for name, entry in summary['files'].items():
        data = (directory / name).read_bytes()
        if sha256(data) != entry['sha256']:
            raise Refusal('baseline-file-changed:' + name)
        loaded[name[:-5]] = json.loads(data)
    loaded['summary'] = summary
    return loaded


# --- stages ----------------------------------------------------------------

def type_census(jar, rules):
    """Count the structural candidates of each type role. A refusal reason needs this detail."""
    index = defaultdict(list)
    for name, key in jar.keys.items():
        index[key].append(name)
    rows = {}
    for role, rule in rules['types'].items():
        jar.check()
        candidates = index.get(rule['shape'], [])
        if 'codeTrace' in rule and len(candidates) <= 64:
            candidates = [n for n in candidates if class_trace(jar.code(n), jar.keys) == rule['codeTrace']]
        rows[role] = len(candidates)
    return {'resolved': sorted(r for r, n in rows.items() if n == 1),
            'missing': sorted(r for r, n in rows.items() if n == 0),
            'ambiguous': sorted(r for r, n in rows.items() if n > 1), 'counts': rows}


def resolve_stage(jar, rules):
    try:
        types, rows = resolve(jar, rules)
        verdict = validate(jar, rules, types, rows)
        return {'status': 'resolved', 'source': 'structural-resolver', 'types': types, 'members': rows,
                'verdict': verdict, 'typeRoles': len(types), 'memberRoles': len(rows)}
    except Refusal as error:
        census = type_census(jar, rules)
        return {'status': 'refused', 'reason': str(error), 'typeCensus': census,
                'typeRoles': len(rules['types']), 'memberRoles': len(rules['members'])}


def traced_table(path, jar, selectors):
    """A traced table in candidate form, or one build of a checkpoint symbols report.

    Every member must exist with its declared flags, and the complete table
    must pass the structural validation of the baseline selectors: type
    coverage, receiver and declaring roles, inheritance, signatures, and the
    assignable and distinct relationships. The one traced access variant is
    accepted; any other flag change refuses.
    """
    data = read_json(path)
    if 'builds' in data:
        builds = [b for b in data['builds'] if b.get('sha256') == jar.sha256]
        if len(builds) != 1:
            raise Refusal('traced-table-build')
        table = builds[0]['symbolTable']
    else:
        if data.get('jarSha256') not in (None, jar.sha256):
            raise Refusal('traced-table-jar')
        table = data
    types, rows = table['types'], table['members']
    if not isinstance(types, dict) or not isinstance(rows, list):
        raise Refusal('traced-table-shape')
    for row in rows:
        cls = jar.code(row['declaring'])
        pool = cls.methods if row['kind'] == 'method' else cls.fields
        found = [m for m in pool if m.name == row['name'] and m.desc == row['descriptor'] and m.flags == row['flags']]
        if len(found) != 1:
            raise Refusal('traced-table-member:' + row['role'])
    rules = adjusted_selectors(selectors, rows, require_variant=False)
    verdict = validate(jar, rules, types, rows)
    return types, rows, verdict


def body_change_stage(old_jar, new_jar, old_table, new_table, closure=None):
    rows = role_rows(old_jar, new_jar, old_table, new_table, {})
    callees = closure_rows(old_jar, new_jar, closure) if closure is not None else []
    changed = [{'role': r['role'], 'result': r['result']} for r in rows if r['result'] not in UNCHANGED]
    changed += [{'label': r['label'], 'result': r['result']} for r in callees if r['result'] not in UNCHANGED]
    summary = {'roles': len(rows), 'callees': len(callees), 'changed': len(changed)}
    for prefix, items in (('role', rows), ('callee', callees)):
        for row in items:
            key = prefix + ':' + row['result']
            summary[key] = summary.get(key, 0) + 1
    return {'status': 'compared', 'summary': summary, 'changed': changed, 'roles': rows, 'callees': callees}


def census_stage(jar, types, rows, collector_path, module_path, read_path=None,
                 refused_class=None, managed_class_id=1904):
    start = time.perf_counter()
    collector, module = read_json(collector_path), read_json(module_path)
    forms, strong, receivers = collector_for(collector, jar.sha256)
    if module.get('jarSha256') != jar.sha256:
        raise Refusal('census-module-report-jar')
    members = {m['role']: [m['declaring'], m['name'], m['descriptor']] for m in rows}
    roles = dict(types)
    roles['module-factory'] = members['module-factory']
    read = read_json(read_path) if read_path else None
    inputs = {'collector_report': {'path': str(collector_path), 'sha256': sha256(Path(collector_path).read_bytes())},
              'module_report': {'path': str(module_path), 'sha256': sha256(Path(module_path).read_bytes())}}
    if read_path:
        inputs['read'] = {'path': str(read_path), 'sha256': sha256(Path(read_path).read_bytes())}
    return census_report(jar, roles, members['disposal'], forms, strong, module['objects']['root'], start, inputs,
                         receivers=receivers, read=read, refused_class=refused_class,
                         managed_class_id=managed_class_id)


# --- the check -------------------------------------------------------------

def write_json(path, value):
    encoded = (json.dumps(value, indent=2) + '\n').encode()
    if len(encoded) > MAX_REPORT:
        raise Refusal('upgrade-report-limit:' + Path(path).name)
    with Path(path).open('xb') as stream:
        stream.write(encoded)
    return {'bytes': len(encoded), 'sha256': sha256(encoded)}


def check(args):
    start = time.perf_counter()
    output = Path(args.output)
    if output.exists():
        raise Refusal('upgrade-output-exists')
    baseline = load_baseline(args.baseline)
    report = {'format': FORMAT, 'baseline': {'directory': str(Path(args.baseline).resolve()),
                                             'fingerprint': baseline['summary']['fingerprint'],
                                             'hostVersion': baseline['summary']['hostVersion']},
              'stages': {}, 'outputs': {}, 'writeAuthority': False, 'bridgeCalls': 0,
              'nativeCommands': 0, 'vendorClassesInitialized': 0, 'conditions': CONDITIONS}
    stages = report['stages']
    output.mkdir(parents=True)

    def finish(verdict, reason=None):
        report['result'] = verdict
        report['nextStep'] = NEXT_STEPS[verdict]
        if reason:
            report['reason'] = reason
        report['elapsedMs'] = round((time.perf_counter() - start) * 1000, 3)
        report['peakRssBytes'] = rss_bytes()
        if report['elapsedMs'] > MAX_SECONDS * 1000 or report['peakRssBytes'] > MAX_RSS:
            report['result'] = 'refused'
            report['reason'] = 'upgrade-limit'
        report['outputs']['upgrade.json'] = write_json(output / 'upgrade.json', report)
        return report

    # 1. fingerprint
    candidate = fingerprint_of(args.jar)
    stages['fingerprint'] = {'status': 'derived', **candidate,
                             'sameAsBaseline': candidate['fingerprint'] == baseline['summary']['fingerprint']}
    if stages['fingerprint']['sameAsBaseline']:
        return finish('already-accepted')

    # 2. resolve
    selectors = baseline['selectors']
    new_jar = old_jar = None
    try:
        new_jar = Jar(Path(args.jar))
        if new_jar.sha256 != candidate['sha256']:
            raise Refusal('upgrade-jar-changed')
        resolved = resolve_stage(new_jar, selectors)
        stages['resolve'] = {k: v for k, v in resolved.items() if k not in ('types', 'members')}
        if resolved['status'] == 'refused':
            if args.traced_table is None:
                return finish('resolution-refused', resolved['reason'])
            types, rows, verdict = traced_table(args.traced_table, new_jar, selectors)
            stages['resolve']['tracedTable'] = {'path': str(args.traced_table),
                                                'sha256': sha256(Path(args.traced_table).read_bytes()),
                                                'typeRoles': len(types), 'memberRoles': len(rows),
                                                'verdict': verdict}
            stages['resolve']['source'] = 'traced-table'
        else:
            types, rows = resolved['types'], resolved['members']
            stat = Path(args.jar).stat()
            encoded = (json.dumps(selectors, indent=2) + '\n').encode()
            table = {'result': 'pass', 'jarSha256': new_jar.sha256, 'jarPath': candidate['path'],
                     'jarMtimeNs': stat.st_mtime_ns, 'jarMtimeNsText': str(stat.st_mtime_ns),
                     'selectorSha256': sha256(encoded), 'counts': new_jar.stats, 'verdict': resolved['verdict'],
                     'types': types, 'members': rows,
                     'liveInvariants': {r['role']: r['liveInvariant'] for r in selectors['members']},
                     'source': {'upgradeTool': FORMAT, 'baselineFingerprint': baseline['summary']['fingerprint']},
                     'bridgeCalls': 0, 'nativeCommands': 0, 'vendorClassesInitialized': 0}
            with (output / 'selectors.json').open('xb') as stream:
                stream.write(encoded)
            report['outputs']['selectors.json'] = {'bytes': len(encoded), 'sha256': sha256(encoded)}
            report['outputs']['candidate.json'] = write_json(output / 'candidate.json', table)

        # 3. body change
        old_path = Path(args.old_jar) if args.old_jar else Path(baseline['candidate']['jarPath'])
        if not old_path.exists():
            stages['body-change'] = {'status': 'input-required',
                                     'reason': 'old-jar-missing:' + str(old_path)}
            return finish('input-required', 'The accepted build jar is needed for the body comparison; pass --old-jar.')
        old_jar = Jar(old_path)
        if old_jar.sha256 != baseline['summary']['jarSha256']:
            raise Refusal('upgrade-old-jar-mismatch')
        old_table = {'types': baseline['candidate']['types'], 'members': baseline['candidate']['members']}
        closure = read_json(args.closure) if args.closure else None
        bodies = body_change_stage(old_jar, new_jar, old_table, {'types': types, 'members': rows}, closure)
        stages['body-change'] = {'status': 'compared', 'summary': bodies['summary'], 'changed': bodies['changed'],
                                 'oldJar': {'path': str(old_path.resolve()), 'sha256': old_jar.sha256}}
        report['outputs']['body-change.json'] = write_json(output / 'body-change.json', {
            'format': 'grid-doctor-body-change-v1', 'result': 'compared', 'upgradeTool': FORMAT,
            'oldJarSha256': old_jar.sha256, 'newJarSha256': new_jar.sha256, **bodies,
            'writeAuthority': False, 'boundedAdmission': False})
        old_jar.close()
        old_jar = None
        verdict = 'name-only-change' if not bodies['changed'] else 'changed-bodies'

        # 4. census
        if args.collector_report is None or args.module_report is None:
            stages['census'] = {'status': 'input-required',
                                'reason': 'collector-report-and-module-report-required'}
            return finish(verdict)
        census = census_stage(new_jar, types, rows, args.collector_report, args.module_report,
                              read_path=args.read, refused_class=args.refused_class,
                              managed_class_id=args.managed_class_id)
        stages['census'] = {'status': census['result'], 'checks': census['checks'],
                            'classes': sorted(c['name'] for c in census['classes'])}
        if 'census' in baseline:
            comparison = compare_census(baseline['census'], census)
            stages['census']['comparison'] = {
                'classSetsEqual': comparison['classSetsEqual'], 'oldCount': comparison['oldCount'],
                'newCount': comparison['newCount'],
                'changedDisposalBodies': [r['className'] for r in comparison['changedDisposalBodies']],
                'changedDisposalChains': [r['className'] for r in comparison['changedDisposalChains']]}
            report['outputs']['census-comparison.json'] = write_json(output / 'census-comparison.json', comparison)
        report['outputs']['census.json'] = write_json(output / 'census.json', census)
        if census['result'] != 'complete-over-approximation':
            return finish(verdict, 'census-refused')

        # 5. guards
        if args.guard_plan is None:
            stages['guards'] = {'status': 'input-required', 'reason': 'guard-plan-required'}
            return finish(verdict)
        plan_bytes = Path(args.guard_plan).read_bytes()
        plan = json.loads(plan_bytes)
        prepared = prepare_resources(
            new_jar, plan, plan_bytes, selectors, types, rows, output / 'census.json',
            candidate_directory=Path(args.candidate_directory) if args.candidate_directory else None,
            source={'upgradeTool': FORMAT, 'baselineFingerprint': baseline['summary']['fingerprint'],
                    'tracedTable': stages['resolve'].get('tracedTable')},
            require_variant=False, host_version=args.host_version)
        directory = output / 'prepared'
        directory.mkdir()
        for name, data in prepared.items():
            with (directory / f'{name}.json').open('xb') as stream:
                stream.write(data)
            report['outputs'][f'prepared/{name}.json'] = {'bytes': len(data), 'sha256': sha256(data)}
        guards = json.loads(prepared['guards'])
        stages['guards'] = {'status': 'prepared', 'guardsSha256': sha256(prepared['guards']),
                            'candidateSha256': sha256(prepared['candidate']),
                            'types': len(guards['types']), 'fields': len(guards['fields']),
                            'ownedTreeClasses': len(guards['ownedTree']['classes'])}
        return finish('prepared')
    finally:
        for jar in (new_jar, old_jar):
            if jar is not None:
                jar.close()


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest='command', required=True)
    base = sub.add_parser('baseline', help='assemble the accepted build baseline')
    base.add_argument('--accepted', type=Path, required=True, help='the accepted cache record')
    base.add_argument('--candidate-directory', type=Path, required=True,
                      help='directory with candidate.json, selectors.json, and optional guards.json')
    base.add_argument('--census', type=Path, default=None, help='the owned-tree census of the accepted build')
    base.add_argument('--output', type=Path, required=True)
    run = sub.add_parser('check', help='check one candidate jar against the baseline')
    run.add_argument('--baseline', type=Path, required=True)
    run.add_argument('--jar', type=Path, required=True)
    run.add_argument('--output', type=Path, required=True, help='a new directory')
    run.add_argument('--old-jar', type=Path, default=None, help='the accepted build jar, when not at its recorded path')
    run.add_argument('--traced-table', type=Path, default=None,
                     help='a traced table (candidate form or checkpoint symbols) after a resolver refusal')
    run.add_argument('--closure', type=Path, default=None, help='a traced command closure for callee comparison')
    run.add_argument('--collector-report', type=Path, default=None)
    run.add_argument('--module-report', type=Path, default=None)
    run.add_argument('--read', type=Path, default=None, help='a doctor read with the detached capture, if any')
    run.add_argument('--refused-class', default=None)
    run.add_argument('--managed-class-id', type=int, default=1904)
    run.add_argument('--guard-plan', type=Path, default=None)
    run.add_argument('--candidate-directory', type=Path, default=None,
                     help='reuse the candidate and selectors bytes of an earlier preparation')
    run.add_argument('--host-version', default=None)
    args = parser.parse_args(argv)
    try:
        if args.command == 'baseline':
            summary = assemble_baseline(args.accepted, args.candidate_directory, args.output, args.census)
            print(json.dumps(summary, indent=2))
            return 0
        report = check(args)
        print(json.dumps({k: report.get(k) for k in ('result', 'reason', 'nextStep', 'elapsedMs', 'peakRssBytes')}
                         | {'stages': {k: v.get('status') for k, v in report['stages'].items()}}, indent=2))
        return 0 if report['result'] in ('already-accepted', 'name-only-change', 'prepared') else 1
    except (Refusal, OSError, KeyError, ValueError) as error:
        reason = str(error) if isinstance(error, Refusal) else f'{type(error).__name__}: {error}'
        print(json.dumps({'result': 'refused', 'reason': reason, 'writeAuthority': False}, indent=2))
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
