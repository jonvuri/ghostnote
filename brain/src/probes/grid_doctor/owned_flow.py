"""Check relationship collectors with a null display key and a fresh list."""
from grid_symbols.scan import Refusal, ancestors, instructions
from .assertion_guards import requirements
from .migrate import member
from .ownership import constant, method_trace, bootstraps
from .read_dataflow import ReadFlow, NULL


def runtime_parent_bindings(old, target, source_catalog, target_catalog):
    """Derive parent type inputs from paired runtime anchors."""
    from .admission import AdmissionLimits, Work, lineage
    from .migrate import merge
    work = Work(AdmissionLimits())
    targets = {(r['name'], r['id']): r for r in target_catalog['rows']}
    if len(targets) != len(target_catalog['rows']) or len(source_catalog['rows']) > 128:
        raise Refusal('owned-flow-catalog-limit-or-duplicate')
    result, rows = {}, []
    for row in source_catalog['rows']:
        other = targets.get((row['name'], row['id']))
        if row['count'] != 1 or other is None or other['count'] != 1:
            raise Refusal('owned-flow-runtime-anchor-count')
        a, ae = lineage(old, row['matches'][0]['runtimeClass'], work)
        b, be = lineage(target, other['matches'][0]['runtimeClass'], work)
        if len(a) != len(b) or ae != be:
            raise Refusal('owned-flow-runtime-parent-shape')
        result = merge([result, {}], [dict(zip(a, b)), {}])[0]
        rows.append({'className': row['name'], 'classId': row['id'], 'source': a, 'target': b})
    return result, rows


def getter_field(cls, method, result):
    raw = instructions(method.code)
    if method.desc != '()' + result or method.flags not in (1, 17) or method.handlers:
        raise Refusal('owned-flow-getter-signature')
    if [r[1] for r in raw] != [42, 180, 172 if result == 'I' else 176]:
        raise Refusal('owned-flow-getter-body')
    field = constant(cls, int.from_bytes(bytes(raw[1][2]), 'big'))
    if field['descriptor'] != result:
        raise Refusal('owned-flow-getter-field')
    return field['owner'], field['name'], field['descriptor']


def owned_collectors(jar, code, symbols, catalog, properties):
    if any(item['sha256'] != jar.sha256 for item in (symbols, catalog, properties)):
        raise Refusal('owned-flow-input-fingerprint')
    roles = {r['role']: r['reference'] for r in symbols['members']}
    types = symbols['types']
    root = roles['owned-children']
    cls = code.get(jar, root[1])
    method = member(cls, *root[2:])
    expected = '(L' + types['object'] + ';Ljava/util/List;Ljava/lang/String;)V'
    slots = []
    for _, op, args in instructions(method.code):
        if op != 182:
            continue
        ref = constant(cls, int.from_bytes(bytes(args), 'big'))
        if ref['owner'] == types['relationship'] and ref['descriptor'] == expected:
            slots.append((ref['owner'], ref['name'], ref['descriptor']))
    if len(slots) != 1:
        raise Refusal('owned-flow-collector-slot')
    root = roles['property-id']
    cls = code.get(jar, root[1])
    property_field = getter_field(cls, member(cls, *root[2:]), 'I')
    base = code.get(jar, types['property-base'])
    parent_getters = [m for m in base.methods if m.desc == '()L' + types['descriptor-base'] + ';']
    parent_fields = {getter_field(base, m, 'L' + types['descriptor-base'] + ';') for m in parent_getters}
    if len(parent_fields) != 1:
        raise Refusal('owned-flow-parent-field-count')
    parent_field = parent_fields.pop()
    anchors = {(r['name'], r['id']): r['matches'][0] for r in catalog['rows'] if r['count'] == 1}
    if len(properties['properties']) > 128 or sum(len(r['properties']) for r in properties['properties']) > 4096:
        raise Refusal('owned-flow-property-limit')
    owners = set()
    for row in properties['properties']:
        anchor = anchors[row['name'], row['id']]
        receivers = [anchor['runtimeClass'], anchor['descriptor']]
        for prop in row['properties']:
            if prop['matchCount'] != 1:
                raise Refusal('owned-flow-property-count')
            receivers.extend([prop['targetClass'], prop['target'][0]])
        for receiver in receivers:
            owners.update(n for n in ancestors(jar.classes, receiver, 128) if n in jar.classes)
    candidates = {n for n in owners if any(f.desc == 'Z' and f.flags == 4120 for f in jar.classes[n].fields)}
    guards = requirements(jar, candidates, code)
    work = {'instructions': 0, 'states': 0, 'calls': 0}
    paths, methods = [], set()
    for row in properties['properties']:
        anchor = anchors[row['name'], row['id']]
        for prop in row['properties']:
            if types['relationship'] not in ancestors(jar.classes, prop['targetClass'], 128):
                continue
            parent = prop['target'][0]
            if types['descriptor-base'] not in ancestors(jar.classes, parent, 128):
                raise Refusal('owned-flow-property-parent-type')
            flow = ReadFlow(jar, code, guards['fields'], property_field, prop['id'],
                            anchor['descriptor'], work, property_descriptor=(parent_field, parent))
            error, bound = None, None
            try:
                flow.evaluate(*slots[0], ('ref', prop['targetClass'], 'property'),
                              (('ref', anchor['runtimeClass'], 'object'),
                               ('ref', 'java/util/ArrayList', 'fresh-output'), NULL))
                key = (*slots[0], ('ref', prop['targetClass'], 'property'),
                       (('ref', anchor['runtimeClass'], 'object'),
                        ('ref', 'java/util/ArrayList', 'fresh-output'), NULL), False)
                bound = dict(zip(('vendorInstructions', 'vendorCalls', 'externalCalls'), flow.bounds[key]))
            except Refusal as failure:
                error = str(failure)
                if 'limit' in error:
                    raise
            methods.update(flow.methods)
            if len(methods) > 512:
                raise Refusal('owned-flow-trace-limit')
            paths.append({'className': row['name'], 'classId': row['id'],
                          'propertyName': prop['name'], 'propertyId': prop['id'],
                          'propertyClass': prop['targetClass'], 'requiredPropertyParent': parent,
                          'error': error, 'methods': sorted(flow.methods),
                          'normalCollectorBound': bound,
                          'external': sorted(flow.external, key=repr),
                          'requiredStaticDescriptorFields': sorted(flow.static_fields)})
    traces = []
    for owner, name, desc in sorted(methods):
        cls = code.get(jar, owner)
        traces.append(method_trace(jar, cls, member(cls, name, desc),
                                   bootstraps(jar.zip.read(owner + '.class'), cls)))
    return {'sha256': jar.sha256, 'collectorSlot': slots[0], 'propertyIdField': property_field,
            'propertyParentField': parent_field, 'paths': paths, 'methods': traces,
            'assertionGuards': guards, 'work': work, 'boundedAdmission': False, 'writeAuthority': False,
            'limits': ['The display key is null. The output is a fresh exact ArrayList.',
                       'Each property parent field must equal its recorded descriptor singleton.',
                       'Runtime object, property, descriptor, and collection identities need guards.',
                       'External collection operations require size, storage, and mutation bounds.',
                       'The normal collector bound excludes class initialization, external method bodies, and exception paths.',
                       'This check does not prove the ownership list, recursive traversal, or disposal.']}


def main():
    import argparse
    import hashlib
    import json
    from pathlib import Path
    import time
    from grid_symbols.scan import Jar, rss_bytes
    from .callee_contracts import compare_callees
    from .descriptor_resolution import Code
    from .fixed_read_checkpoint import membership_variants, read
    from .migrate import merge

    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('old-jar', 'new-jar', 'symbols', 'catalog', 'properties', 'read-callees', 'output'):
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        raise Refusal('owned-flow-output-exists')
    started = time.perf_counter()
    reports, hashes = {}, {}
    for name in ('symbols', 'catalog', 'properties', 'read_callees'):
        reports[name], hashes[name] = read(getattr(args, name))

    class BoundedJar(Jar):
        def check(self):
            super().check()
            if time.perf_counter() - started > 120:
                raise Refusal('owned-flow-deadline')

    jars, outputs = [], {}
    try:
        jars = [BoundedJar(args.old_jar), BoundedJar(args.new_jar)]
        for value in reports.values():
            if len(value['builds']) != 2 or any(b['sha256'] != j.sha256 for b, j in zip(value['builds'], jars)):
                raise Refusal('owned-flow-input-fingerprint')
        args.output.mkdir()
        code, summaries = Code(), []

        def save(name, value):
            jars[0].check()
            raw = json.dumps(value, indent=2).encode() + b'\n'
            if len(raw) > 8 * 1024**2:
                raise Refusal('owned-flow-report-limit')
            with (args.output / (name + '.json')).open('xb') as output:
                output.write(raw)
            outputs[name] = {'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw)}

        for i, jar in enumerate(jars):
            symbols, catalog, properties, callees = [reports[k]['builds'][i]
                for k in ('symbols', 'catalog', 'properties', 'read_callees')]
            report = owned_collectors(jar, code, symbols, catalog, properties)
            save('collectors-' + str(i), report)
            if any(p['error'] for p in report['paths']):
                raise Refusal('owned-flow-incomplete')
            parents, rows = runtime_parent_bindings(jars[0], jar, reports['catalog']['builds'][0], catalog)
            seed = {'typeBindings': merge([properties['typeBindings'], {}], [parents, {}])[0],
                    'memberBindings': callees['memberBindings']}
            variants = membership_variants(jar, symbols, code, report['methods'])
            compared = compare_callees(jars[0], jar, report['methods'], seed, code, variants)
            compared['runtimeParentInputs'] = rows
            save('contracts-' + str(i), compared)
            if compared['unmatched']:
                raise Refusal('owned-flow-unmatched-contract')
            summaries.append({'sha256': jar.sha256, 'paths': len(report['paths']),
                              'methods': len(report['methods']), 'work': report['work']})
        summary = {'inputs': hashes, 'outputs': outputs.copy(), 'builds': summaries,
                   'elapsedMs': round((time.perf_counter() - started) * 1000, 3),
                   'peakRssBytes': rss_bytes(), 'boundedAdmission': False, 'writeAuthority': False}
        save('summary', summary)
        print(json.dumps(summary, indent=2))
    finally:
        for jar in jars:
            jar.close()


if __name__ == '__main__':
    main()
