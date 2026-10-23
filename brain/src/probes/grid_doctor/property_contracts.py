"""Bind captured property constructors and concrete descriptor read slots."""
from collections import defaultdict
import json
import zipfile

from grid_symbols.scan import Refusal, instructions
from .contracts import contract, signature_key
from .migrate import bindings, member, merge
from .descriptor_resolution import checked_contract
from .fixed_descriptors import integer
from .ownership import constant, method_trace, bootstraps
from .receiver_trace import Declarations, ReceiverLimits
from .admission import Work


def captured_properties(path):
    result = defaultdict(dict)
    with zipfile.ZipFile(path) as archive:
        if len(archive.infolist()) > 128 or sum(x.file_size for x in archive.infolist()) > 32 * 1024**2:
            raise Refusal('property-capture-limit')
        def visit(value):
            if isinstance(value, dict):
                if {'className', 'classId', 'properties'} <= value.keys():
                    for prop in value['properties']:
                        if 'descriptorClass' not in prop:
                            continue
                        pair, key = (value['className'], value['classId']), (prop['name'], prop['id'])
                        cls = prop['descriptorClass'].replace('.', '/')
                        if key in result[pair] and result[pair][key] != cls:
                            raise Refusal('property-capture-class-conflict')
                        result[pair][key] = cls
                for item in value.values():
                    visit(item)
            elif isinstance(value, list):
                for item in value:
                    visit(item)
        for name in archive.namelist():
            visit(json.loads(archive.read(name)))
    return result


def captured_relationships(path):
    wanted = defaultdict(set)
    with zipfile.ZipFile(path) as archive:
        if len(archive.infolist()) > 128 or sum(x.file_size for x in archive.infolist()) > 32 * 1024**2:
            raise Refusal('property-capture-limit')
        def visit(value):
            if isinstance(value, dict):
                if {'className', 'classId', 'properties'} <= value.keys():
                    for prop in value['properties']:
                        if prop.get('relationship'):
                            wanted[value['className'], value['classId']].add((prop['name'], prop['id']))
                for item in value.values():
                    visit(item)
            elif isinstance(value, list):
                for item in value:
                    visit(item)
        for name in archive.namelist():
            visit(json.loads(archive.read(name)))
    return wanted


def infer_relationship_classes(jar, catalog, wanted, relationship, code, constructor_paths=None):
    """Bind source allocations from each captured relationship name and ID."""
    from grid_symbols.scan import ancestors
    result, rows, decoded, methods = {}, [], 0, 0
    if len(catalog['rows']) > 128 or sum(map(len, wanted.values())) > 4096:
        raise Refusal('property-source-census-limit')
    for row in catalog['rows']:
        if row['count'] != 1:
            raise Refusal('property-source-descriptor-count')
        pair = row['name'], row['id']
        todo, found = set(wanted.get(pair, ())), []
        owner, seen = row['matches'][0]['descriptor'], set()
        while owner in jar.classes and todo:
            if owner in seen or len(seen) >= 128:
                raise Refusal('property-source-parent-cycle-or-depth')
            seen.add(owner)
            cls = code.get(jar, owner)
            hits = defaultdict(list)
            for method in cls.methods:
                methods += 1
                if methods > 1000000:
                    raise Refusal('property-source-method-limit')
                if not method.desc.startswith('()L') and method.name != '<init>':
                    continue
                if (constructor_paths is not None and method.name == '<init>'
                        and method.desc not in constructor_paths.get(pair, {}).get(owner, ())):
                    continue
                raw = instructions(method.code)
                decoded += len(raw)
                if decoded > 2000000:
                    raise Refusal('property-source-instruction-limit')
                for i, (offset, op, args) in enumerate(raw):
                    if op not in (18, 19) or i < 2 or i + 1 >= len(raw):
                        continue
                    label = constant(cls, args[0] if op == 18 else args[0] * 256 + args[1])
                    number = integer(cls, raw[i + 1][1], raw[i + 1][2])
                    if label['tag'] != 8 or (label['value'], number) not in todo:
                        continue
                    if raw[i - 2][1] != 187 or raw[i - 1][1] != 89:
                        continue
                    operands = raw[i - 2][2]
                    allocated = constant(cls, operands[0] * 256 + operands[1])['value']
                    if relationship not in ancestors(jar.classes, allocated, jar.limits.depth):
                        continue
                    hits[label['value'], number].append({'source': [owner, method.name, method.desc],
                                                        'offset': offset, 'class': allocated})
            for key, matches in sorted(hits.items()):
                found.append({'name': key[0], 'id': key[1], 'matches': matches})
                if len(matches) == 1:
                    result.setdefault(pair, {})[key] = matches[0]['class']
                todo.remove(key)
            owner = cls.parent
        rows.append({'name': pair[0], 'id': pair[1], 'properties': found, 'missing': sorted(todo)})
    complete = all(not r['missing'] and all(len(p['matches']) == 1 for p in r['properties']) for r in rows)
    covered = {(r['name'], r['id']) for r in rows}
    if set(wanted) - covered:
        complete = False
    return result, {'sha256': jar.sha256, 'rows': rows, 'completeSourceCensus': complete,
                    'work': {'methods': methods, 'instructions': decoded}, 'boundedAdmission': False}


def bind_properties(old, target, source_catalog, target_catalog, captured, seed, code,
                    constructor_paths=None):
    if seed['sha256'] != target.sha256 or target_catalog['sha256'] != target.sha256 or source_catalog['sha256'] != old.sha256:
        raise Refusal('property-input-jar')
    known = [dict(seed['typeBindings']), {tuple(r['source']): tuple(r['target']) for r in seed['memberBindings']}]
    target_rows = {(r['name'], r['id']): r for r in target_catalog['rows']}
    matched = []
    for row in source_catalog['rows']:
        pair = row['name'], row['id']
        other = target_rows.get(pair)
        if row['count'] != 1 or other is None or other['count'] != 1:
            raise Refusal('property-descriptor-anchor-count')
        a, b = row['matches'][0], other['matches'][0]
        known = merge(known, [{a['runtimeClass']: b['runtimeClass'], a['descriptor']: b['descriptor']}, {}])
        ao, bo = a['descriptor'], b['descriptor']
        for _ in range(128):
            ao, bo = old.classes[ao].parent, target.classes[bo].parent
            if ao not in old.classes or bo not in target.classes:
                if ao != bo:
                    raise Refusal('property-external-parent')
                break
            known = merge(known, [{ao: bo}, {}])
        else:
            raise Refusal('property-parent-depth')
        matched.append((pair, a, b))
    results, traces, comparisons, normalized = [], {}, 0, 0
    for pair, a, b in matched:
        wanted = captured.get(pair, {})
        todo, selected = set(wanted), []
        owner = a['descriptor']
        for _ in range(128):
            if owner not in old.classes or not todo:
                break
            oc, nc = code.get(old, owner), code.get(target, known[0][owner])
            for om in oc.methods:
                if not om.desc.startswith('()L') and om.name != '<init>':
                    continue
                if (constructor_paths is not None and om.name == '<init>'
                        and om.desc not in constructor_paths[0].get(pair, {}).get(owner, ())):
                    continue
                raw = instructions(om.code)
                labels = []
                for i, (_, op, args) in enumerate(raw[:-1]):
                    if op not in (18, 19):
                        continue
                    value = constant(oc, args[0] if op == 18 else args[0] * 256 + args[1])
                    number = integer(oc, raw[i + 1][1], raw[i + 1][2])
                    if value['tag'] == 8 and (value['value'], number) in todo:
                        labels.append((value['value'], number))
                if not labels:
                    continue
                expected = checked_contract(oc, om, old.classes)
                hits = []
                if expected is not None:
                    for nm in nc.methods:
                        if (constructor_paths is not None and nm.name == '<init>'
                                and nm.desc not in constructor_paths[1].get(pair, {}).get(nc.name, ())):
                            continue
                        if signature_key(om, old.classes) != signature_key(nm, target.classes):
                            continue
                        comparisons += 1
                        normalized += len(instructions(nm.code))
                        if comparisons > 100000 or normalized > 2000000:
                            raise Refusal('property-work-limit')
                        value = checked_contract(nc, nm, target.classes)
                        if value is None or value['digest'] != expected['digest']:
                            continue
                        mapped = bindings(expected, value)
                        try:
                            merge(known, mapped)
                        except Refusal as error:
                            if str(error) in ('operation-edge-conflict', 'reference-alias-conflict'):
                                continue
                            raise
                        hits.append((nm, mapped))
                for label in labels:
                    property_class = wanted[label]
                    row = {'name': label[0], 'id': label[1], 'sourceClass': property_class,
                           'source': [owner, om.name, om.desc], 'matchCount': len(hits)}
                    if len(hits) == 1:
                        nm, mapped = hits[0]
                        known = merge(known, mapped)
                        if property_class not in known[0]:
                            raise Refusal('property-unbound-construction-type')
                        row.update(target=[nc.name, nm.name, nm.desc], targetClass=known[0][property_class], digest=expected['digest'])
                        todo.remove(label)
                        for jar, cls, method in [(old, oc, om), (target, nc, nm)]:
                            key = jar.sha256, cls.name, method.name, method.desc
                            if key not in traces:
                                if len(traces) >= 512:
                                    raise Refusal('property-trace-limit')
                                traces[key] = {'jarSha256': jar.sha256, 'trace': method_trace(jar, cls, method,
                                    bootstraps(jar.zip.read(cls.name + '.class'), cls))}
                    selected.append(row)
            owner = oc.parent
        else:
            raise Refusal('property-parent-depth')
        results.append({'name': pair[0], 'id': pair[1], 'properties': selected, 'missing': sorted(todo)})
    concrete = sorted({cls for props in captured.values() for cls in props.values()})
    declarations = Declarations(target, Work(ReceiverLimits()))
    roles = {r['role']: r for r in seed['members']}
    dispatch = []
    for source in concrete:
        dest = known[0].get(source)
        row = {'source': source, 'target': dest, 'slots': [], 'runtimeObserved': False}
        if dest is not None:
            for role in ('scalar-read', 'child-count', 'child-read'):
                ref = roles[role]['reference']
                lookup = roles[role]['lookup']
                from grid_symbols.scan import ancestors
                applicable = lookup in set(ancestors(target.classes, dest, target.limits.depth))
                if not applicable:
                    row['slots'].append({'role': role, 'applicable': False})
                    continue
                found = declarations.find('method', dest, ref[2], ref[3])
                row['slots'].append({'role': role, 'applicable': True, 'declaration': found})
                if found['status'] == 'declaration' and not found['flags'] & (1024 | 256):
                    cls = code.get(target, found['owner'])
                    method = member(cls, ref[2], ref[3])
                    key = target.sha256, cls.name, method.name, method.desc
                    if key not in traces:
                        if len(traces) >= 512:
                            raise Refusal('property-trace-limit')
                        traces[key] = {'jarSha256': target.sha256, 'trace': method_trace(target, cls, method,
                            bootstraps(target.zip.read(cls.name + '.class'), cls))}
        dispatch.append(row)
    return {'sha256': target.sha256, 'properties': results, 'propertyDispatch': dispatch,
            'traces': list(traces.values()), 'typeBindings': known[0],
            'memberBindings': [{'source': list(k), 'target': list(v)} for k, v in known[1].items()],
            'work': {'comparisons': comparisons, 'instructions': normalized, 'traces': len(traces)},
            'completeTable': False, 'boundedAdmission': False, 'writeAuthority': False}


def main():
    import argparse
    import hashlib
    from pathlib import Path
    import time
    from grid_symbols.scan import Jar, rss_bytes
    from .descriptor_resolution import Code

    parser = argparse.ArgumentParser(description=__doc__)
    for key in ('old-jar', 'new-jar', 'captures', 'catalog', 'symbols', 'report'):
        parser.add_argument('--' + key, type=Path, required=True)
    parser.add_argument('--all-relationships', action='store_true')
    args = parser.parse_args()
    if args.report.exists():
        raise Refusal('property-report-exists')
    raw = {}
    for key in ('catalog', 'symbols'):
        path = getattr(args, key)
        if path.stat().st_size > 8 * 1024**2:
            raise Refusal('property-input-limit')
        raw[key] = path.read_bytes()
    catalogs, symbols = json.loads(raw['catalog']), json.loads(raw['symbols'])
    capture_hash = hashlib.sha256(args.captures.read_bytes()).hexdigest()
    if capture_hash != catalogs['captureSha256']:
        raise Refusal('property-capture-hash')
    captured = None if args.all_relationships else captured_properties(args.captures)
    start, jars = time.perf_counter(), []

    class BoundedJar(Jar):
        def check(self):
            super().check()
            if time.perf_counter() - start > 120:
                raise Refusal('property-deadline')

    try:
        for path in (args.old_jar, args.new_jar):
            jars.append(BoundedJar(path))
        code = Code()
        source_census = None
        if args.all_relationships:
            captured, source_census = infer_relationship_classes(jars[0], catalogs['builds'][0],
                captured_relationships(args.captures), symbols['builds'][0]['types']['relationship'], code)
            if not source_census['completeSourceCensus']:
                raise Refusal('property-source-census-incomplete')
        builds = [bind_properties(jars[0], jar, catalogs['builds'][0], catalogs['builds'][i],
                                  captured, symbols['builds'][i], code) for i, jar in enumerate(jars)]
        report = {'builds': builds, 'captureSha256': capture_hash,
                  'inputHashes': {key: hashlib.sha256(value).hexdigest() for key, value in raw.items()},
                  'elapsedMs': round((time.perf_counter() - start) * 1000, 3), 'peakRssBytes': rss_bytes(),
                  'completeTable': False, 'boundedAdmission': False, 'writeAuthority': False}
        if source_census is not None:
            report['sourceRelationshipCensus'] = source_census
        encoded = json.dumps(report, indent=2).encode() + b'\n'
        if len(encoded) > 8 * 1024**2:
            raise Refusal('property-report-limit')
        with args.report.open('xb') as output:
            output.write(encoded)
        print(json.dumps({'elapsedMs': report['elapsedMs'], 'peakRssBytes': report['peakRssBytes'],
                          'work': [b['work'] for b in builds], 'reportBytes': len(encoded)}))
    finally:
        for jar in jars:
            jar.close()


if __name__ == '__main__':
    main()
