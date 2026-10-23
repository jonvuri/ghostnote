"""Bound the traced relationship wrapper constructors under assertion guards."""
from grid_symbols.scan import Refusal, ancestors, instructions
from .assertion_guards import requirements
from .dispatch_paths import reachable
from .migrate import member
from .ownership import bootstraps, constant, method_trace


def wrapper_bound(jar, code, owner, name, desc):
    cls = code.get(jar, owner)
    factory = member(cls, name, desc)
    raw = instructions(factory.code)
    if factory.handlers or [x[1] for x in raw] != [187, 89, 43, 42, 183, 176]:
        raise Refusal('wrapper-factory-shape')

    def ref(cls, args):
        return constant(cls, args[0] * 256 + args[1])

    allocated, constructor = ref(cls, raw[0][2]), ref(cls, raw[4][2])
    if allocated['tag'] != 7 or constructor['owner'] != allocated['value'] or constructor['name'] != '<init>':
        raise Refusal('wrapper-constructor-identity')
    methods, fields, initializers, chain = [], [], [], set()
    count = len(raw)
    current = constructor['owner'], constructor['descriptor']
    while current[0] != 'java/lang/Object':
        if current in chain or len(chain) >= 32:
            raise Refusal('wrapper-constructor-depth-or-cycle')
        chain.add(current)
        cls = code.get(jar, current[0])
        method = member(cls, '<init>', current[1])
        if method.handlers:
            raise Refusal('wrapper-constructor-handler')
        guard = requirements(jar, {cls.name}, code)
        fields.extend(guard['fields']); initializers.extend(guard['initializers'])
        selected = reachable(cls, method, None, set(map(tuple, guard['fields'])))
        calls = []
        for offset, op, args in instructions(method.code):
            if offset not in selected:
                continue
            count += 1
            if op in (42, 43, 44, 45, 177):
                continue
            if op == 183:
                call = ref(cls, args)
                if call['owner'] != cls.parent or call['name'] != '<init>':
                    raise Refusal('wrapper-constructor-other-call')
                calls.append((call['owner'], call['descriptor']))
            elif op == 181:
                field = ref(cls, args)
                if field['owner'] != cls.name:
                    raise Refusal('wrapper-constructor-foreign-field')
            elif op == 178:
                field = ref(cls, args)
                if (field['owner'], field['name'], field['descriptor']) not in guard['fields']:
                    raise Refusal('wrapper-constructor-static-read')
            elif op in (153, 154, 167):
                if offset + int.from_bytes(bytes(args), 'big', signed=True) <= offset:
                    raise Refusal('wrapper-constructor-back-edge')
            else:
                raise Refusal('wrapper-constructor-opcode:' + str(op))
        if len(calls) != 1:
            raise Refusal('wrapper-super-constructor-count')
        methods.append(method_trace(jar, cls, method, bootstraps(jar.zip.read(cls.name + '.class'), cls)))
        current = calls[0]
    if current[1] != '()V':
        raise Refusal('wrapper-object-constructor-signature')
    cls = code.get(jar, owner)
    return {'sha256': jar.sha256, 'factory': method_trace(jar, cls, factory,
                bootstraps(jar.zip.read(owner + '.class'), cls)), 'constructors': methods,
            'requiredTrueFlags': sorted(set(fields)), 'initializers': initializers,
            'objectAllocations': 1, 'constructorInstructionBound': count,
            'vendorConstructorCalls': len(chain), 'externalCalls': [['java/lang/Object', '<init>', '()V']],
            'limits': ['The bound excludes class initialization and the external Object constructor.',
                       'Every assertion field must be initialized and true before the native walk.',
                       'The ancestor walk needs a separate depth and cycle guard.'],
            'boundedAdmission': False, 'writeAuthority': False}


def compare_wrappers(old, target, properties, symbols, seed, code):
    """Bind each captured relationship factory and compare its constructor chain."""
    from .callee_contracts import compare_callees
    relationship = symbols['types']['relationship']
    object_type = symbols['types']['object']
    classes = {p['targetClass'] for row in properties['properties'] for p in row['properties']}
    if len(classes) > 128:
        raise Refusal('wrapper-property-class-limit')
    bounds, methods = [], {}
    for name in sorted(classes):
        if relationship not in ancestors(target.classes, name, target.limits.depth):
            continue
        cls = code.get(target, name)
        candidates = [m for m in cls.methods if m.flags == 1
                      and m.desc.startswith('(L' + object_type + ';)L')
                      and [x[1] for x in instructions(m.code)] == [187, 89, 43, 42, 183, 176]]
        if len(candidates) != 1:
            raise Refusal('wrapper-factory-count')
        bound = wrapper_bound(target, code, name, candidates[0].name, candidates[0].desc)
        bounds.append(bound)
        for trace in [bound['factory'], *bound['constructors'], *bound['initializers']]:
            methods[tuple(trace[k] for k in ('owner', 'name', 'descriptor'))] = trace
    if not bounds:
        raise Refusal('wrapper-no-relationship-factories')
    compared = compare_callees(old, target, list(methods.values()), seed, code)
    return {'sha256': target.sha256, 'bounds': bounds, 'contracts': compared,
            'boundedAdmission': False, 'writeAuthority': False}


def main():
    import argparse
    import hashlib
    import json
    from pathlib import Path
    import time
    from grid_symbols.scan import Jar, rss_bytes
    from .descriptor_resolution import Code
    parser = argparse.ArgumentParser(description=__doc__)
    for key in ('old-jar', 'new-jar', 'symbols', 'properties', 'slots', 'report'):
        parser.add_argument('--' + key, type=Path, required=True)
    args = parser.parse_args()
    if args.report.exists():
        raise Refusal('wrapper-report-exists')
    start = time.perf_counter()
    data, hashes = {}, {}
    for key in ('symbols', 'properties', 'slots'):
        path = getattr(args, key)
        if path.stat().st_size > 8 * 1024**2:
            raise Refusal('wrapper-input-size')
        raw = path.read_bytes()
        data[key] = json.loads(raw)
        hashes[key] = hashlib.sha256(raw).hexdigest()
    old, target = Jar(args.old_jar), Jar(args.new_jar)
    try:
        if data['slots']['sha256'] != target.sha256:
            raise Refusal('wrapper-slots-fingerprint')
        for key in ('symbols', 'properties'):
            builds = data[key]['builds']
            if len(builds) != 2 or [b['sha256'] for b in builds] != [old.sha256, target.sha256]:
                raise Refusal('wrapper-input-fingerprint:' + key)
        result = compare_wrappers(old, target, data['properties']['builds'][1],
                                  data['symbols']['builds'][1], data['slots'], Code())
        old.check(); target.check()
    finally:
        old.close(); target.close()
    result.update(inputHashes=hashes, elapsedMs=round((time.perf_counter() - start) * 1000, 3),
                  peakRssBytes=rss_bytes())
    raw = json.dumps(result, indent=2).encode() + b'\n'
    if result['elapsedMs'] > 120000 or result['peakRssBytes'] > 768 * 1024**2 or len(raw) > 8 * 1024**2:
        raise Refusal('wrapper-report-work-limit')
    with args.report.open('xb') as output:
        output.write(raw)
    print(json.dumps({'factories': len(result['bounds']), 'matched': len(result['contracts']['matched']),
                      'unmatched': result['contracts']['unmatched'], 'elapsedMs': result['elapsedMs'],
                      'peakRssBytes': result['peakRssBytes'], 'reportBytes': len(raw)}))
    return 1 if result['contracts']['unmatched'] else 0


if __name__ == '__main__':
    raise SystemExit(main())
