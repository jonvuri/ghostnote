"""Check the two managed-ID bootstrap forms without changing the strict comparator."""
from grid_symbols.scan import CP_OPS, Refusal, descriptor, digest, instructions


def bootstrap_contract(cls, method, classes, bootstrap):
    """Keep local reference aliases, control flow, literals, and handlers."""
    types = {cls.name: 'self'}
    members = {}

    def type_key(name):
        if name.startswith('['):
            return descriptor(name, type_key)
        if name not in classes:
            return name
        if name not in types:
            types[name] = 'type-' + str(len(types))
        return types[name]

    def cp_value(index):
        tag, value = cls.cp[index]
        if tag in (3, 4, 5, 6):
            return [tag, value]
        if tag == 7:
            return ['type', type_key(cls.cp[value][1])]
        if tag == 8:
            # Text is retained. It is never used as a vendor symbol name.
            return ['string', cls.cp[value][1]]
        if tag in (9, 10, 11):
            owner, nt = value
            owner = cls.cp[cls.cp[owner][1]][1]
            ni, di = cls.cp[nt][1]
            name, desc = cls.cp[ni][1], cls.cp[di][1]
            owner_key = type_key(owner)
            signature = descriptor(desc, type_key)
            if owner not in classes or name in ('<init>', '<clinit>'):
                label = name
            else:
                identity = (tag, owner, name, desc)
                if identity not in members:
                    members[identity] = 'member-' + str(len(members))
                label = members[identity]
            return [tag, owner_key, label, signature]
        if tag == 15:
            return [tag, value[0], cp_value(value[1])]
        if tag == 16:
            return [tag, descriptor(cls.cp[value][1], type_key)]
        if tag == 18:
            bi, nt = value
            if bi >= len(bootstrap):
                raise Refusal('bootstrap-missing-entry')
            name_index, desc_index = cls.cp[nt][1]
            name, desc = cls.cp[name_index][1], cls.cp[desc_index][1]
            entry = bootstrap[bi]
            handle, args = entry['handle'], entry['arguments']
            target = handle.get('target', {})
            if handle.get('tag') != 15 or handle.get('kind') != 6 or target.get('tag') != 10:
                raise Refusal('bootstrap-handle')
            lookup = 'Ljava/lang/invoke/MethodHandles$Lookup;Ljava/lang/String;Ljava/lang/invoke/MethodType;'
            if target.get('owner') == 'java/lang/invoke/LambdaMetafactory':
                signature = '(' + lookup + 'Ljava/lang/invoke/MethodType;Ljava/lang/invoke/MethodHandle;Ljava/lang/invoke/MethodType;)Ljava/lang/invoke/CallSite;'
                if target.get('name') != 'metafactory' or target.get('descriptor') != signature:
                    raise Refusal('bootstrap-lambda-factory')
                if name != 'get' or desc != '(L' + cls.name + ';)Ljava/util/function/Supplier;':
                    raise Refusal('bootstrap-captured-receiver')
                if len(args) != 3 or args[0] != {'tag': 16, 'value': '()Ljava/lang/Object;'} or args[2] != {'tag': 16, 'value': '()Ljava/lang/String;'}:
                    raise Refusal('bootstrap-method-types')
                impl = args[1].get('target', {})
                if args[1].get('tag') != 15 or args[1].get('kind') != 5 or impl.get('tag') != 10 or impl.get('owner') != cls.name or impl.get('descriptor') != '()Ljava/lang/String;':
                    raise Refusal('bootstrap-implementation-handle')
                found = [m for m in cls.methods if (m.name, m.desc) == (impl['name'], impl['descriptor'])]
                if len(found) != 1 or found[0].flags != 4098:
                    raise Refusal('bootstrap-implementation-declaration')
                identity = (10, impl['owner'], impl['name'], impl['descriptor'])
                if identity not in members:
                    members[identity] = 'member-' + str(len(members))
                normalized = [type_key(impl['owner']), members[identity], impl['descriptor']]
                return [tag, name, descriptor(desc, type_key), 'managed-id-supplier', normalized,
                        args[0], args[2]]
            if target.get('owner') == 'java/lang/invoke/StringConcatFactory':
                signature = '(' + lookup + 'Ljava/lang/String;[Ljava/lang/Object;)Ljava/lang/invoke/CallSite;'
                if target.get('name') != 'makeConcatWithConstants' or target.get('descriptor') != signature:
                    raise Refusal('bootstrap-concat-factory')
                if name != 'makeConcatWithConstants' or desc != '(Ljava/lang/String;)Ljava/lang/String;':
                    raise Refusal('bootstrap-concat-signature')
                if args != [{'tag': 8, 'value': 'Object of type \x01 has been disposed'}]:
                    raise Refusal('bootstrap-concat-recipe')
                return [tag, name, desc, 'managed-id-description', args]
            raise Refusal('bootstrap-unsupported-factory')
        raise Refusal('contract-unsupported-constant:' + str(tag))

    signature = descriptor(method.desc, type_key)
    raw = instructions(method.code)
    ordinal = {offset: i for i, (offset, _, _) in enumerate(raw)}
    ordinal[len(method.code)] = len(raw)
    tokens = []
    for pos, op, args in raw:
        if op in CP_OPS:
            index = args[0] if op == 18 else args[0] * 256 + args[1]
            tokens.append([op, cp_value(index), list(args[1:] if op == 18 else args[2:])])
        elif op in (*range(153, 169), 198, 199, 200, 201):
            delta = int.from_bytes(bytes(args), 'big', signed=True)
            tokens.append([op, ordinal[pos + delta] - ordinal[pos]])
        elif op == 170:
            default, low, high, *targets = args
            tokens.append([op, low, high, ordinal[pos + default],
                           [ordinal[pos + x] for x in targets]])
        elif op == 171:
            default, *pairs = args
            tokens.append([op, ordinal[pos + default],
                           [[pairs[i], ordinal[pos + pairs[i + 1]]]
                            for i in range(0, len(pairs), 2)]])
        else:
            tokens.append([op, list(args)])
    handlers = [[ordinal[a], ordinal[b], ordinal[c], cp_value(t) if t else 'all']
                for a, b, c, t in method.handlers]
    return {'digest': digest([method.flags, signature, tokens, handlers]),
            'bodyDigest': digest([signature, tokens, handlers]),
            'tokens': tokens, 'handlers': handlers,
            'types': types, 'members': members, 'instructions': len(raw)}



def managed_pair(old, target, source_row, target_ref, known, code):
    """Compare both bootstrap bodies. Retain the remaining admission conditions."""
    from .migrate import bindings, member, merge
    from .ownership import bootstraps, method_trace
    from .contracts import references
    from .receiver_trace import Declarations, ReceiverLimits
    from .admission import Work
    from .role_bindings import canonical_edges

    od, nd = Declarations(old, Work(ReceiverLimits())), Declarations(target, Work(ReceiverLimits()))
    traces, pairs = [], []

    def compare(a, b):
        ac, bc = code.get(old, a[0]), code.get(target, b[0])
        am, bm = member(ac, *a[1:]), member(bc, *b[1:])
        ab = bootstraps(old.zip.read(a[0] + '.class'), ac)
        bb = bootstraps(target.zip.read(b[0] + '.class'), bc)
        av, bv = bootstrap_contract(ac, am, old.classes, ab), bootstrap_contract(bc, bm, target.classes, bb)
        mapped = merge(bindings(av, bv), [{a[0]: b[0]}, {(10, *a): (10, *b)}])
        mapped, unresolved = canonical_edges(mapped, od, nd)
        pairs.append({'source': list(a), 'target': list(b), 'digest': av['digest'],
                      'unresolvedDeclarations': unresolved})
        traces.append({'source': method_trace(old, ac, am, ab), 'target': method_trace(target, bc, bm, bb)})
        return mapped, av, bv

    root = source_row['declaring'], source_row['name'], source_row['descriptor']
    dest = tuple(target_ref[1:])
    mapped, av, bv = compare(root, dest)
    current = merge(known, mapped)
    # The only permitted lambda form has one private synthetic supplier.
    implementations = [(a, b) for a, b in mapped[1].items()
                       if a[1] == root[0] and a[3] == '()Ljava/lang/String;']
    if len(implementations) != 1:
        raise Refusal('bootstrap-managed-supplier-count')
    a, b = implementations[0]
    supplier, _, _ = compare(tuple(a[1:]), tuple(b[1:]))
    current = merge(current, supplier)
    # Compare each static assertion entry body. Report initialization separately.
    ac = code.get(old, root[0])
    for ref in references(ac, member(ac, *root[1:])):
        if ref['opcode'] != 184:
            continue
        key = (10, ref['owner'], ref['name'], ref['descriptor'])
        hit = current[1].get(key)
        if hit is None:
            raise Refusal('bootstrap-assertion-binding')
        child, _, _ = compare(tuple(key[1:]), tuple(hit[1:]))
        current = merge(current, child)
    initializers = []
    for a, b in [(root[0], dest[0])] + [(r['source'][0], r['target'][0]) for r in pairs[2:]]:
        if any(item['source']['owner'] == a for item in initializers):
            continue
        pair = {}
        for label, jar, owner in [('source', old, a), ('target', target, b)]:
            cls = code.get(jar, owner)
            init = [m for m in cls.methods if m.name == '<clinit>']
            if len(init) != 1:
                raise Refusal('bootstrap-initializer-count')
            pair[label] = method_trace(jar, cls, init[0], bootstraps(jar.zip.read(owner + '.class'), cls))
        initializers.append(pair)
    return {'status': 'exact-two-bootstrap-local-contract', 'pairs': pairs, 'traces': traces,
            'initializers': initializers, 'admitted': False,
            'conditions': [
                'The object class must already be initialized; an existing instance supplies this condition.',
                'The assertion flag is a runtime value. The initialized class file does not prove its value.',
                'A true disabled-assertion flag skips both assertion branches and both dynamic calls.',
                'An enabled assertion path can allocate the captured supplier and initialize assertion helpers.',
                'Supplier evaluation requires a fixed descriptor receiver and can call reporting code.',
                'No reporting, bootstrap initialization, or external runtime bound is established by equality.']}
