"""Compare explicit dynamic call payloads as offline trace inputs only."""
from grid_symbols.scan import CP_OPS, Refusal, descriptor, digest, instructions


def dynamic_contract(cls, method, classes, bootstrap, *, exclude_assertions=False):
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

    def structured(value):
        tag = value['tag']
        if tag in (3, 4, 5, 6, 8):
            return [tag, value['value']]
        if tag == 7:
            return [tag, type_key(value['value'])]
        if tag == 16:
            return [tag, descriptor(value['value'], type_key)]
        if tag in (10, 11):
            owner, name, desc = value['owner'], value['name'], value['descriptor']
            owner_key = type_key(owner)
            signature = descriptor(desc, type_key)
            label = name
            if owner in classes and name not in ('<init>', '<clinit>'):
                identity = tag, owner, name, desc
                if identity not in members:
                    members[identity] = 'member-' + str(len(members))
                label = members[identity]
            return [tag, owner_key, label, signature]
        if tag == 15:
            if value['kind'] not in (5, 6, 7, 8, 9):
                raise Refusal('dynamic-implementation-kind')
            return [tag, value['kind'], structured(value['target'])]
        raise Refusal('dynamic-argument-tag:' + str(tag))

    def dynamic(index):
        bi, nt = cls.cp[index][1]
        if bi >= len(bootstrap) or bi < 0:
            raise Refusal('dynamic-missing-entry')
        ni, di = cls.cp[nt][1]
        name, desc = cls.cp[ni][1], cls.cp[di][1]
        entry = bootstrap[bi]
        handle, args = entry['handle'], entry['arguments']
        target = handle.get('target', {})
        if handle.get('tag') != 15 or handle.get('kind') != 6 or target.get('tag') != 10:
            raise Refusal('dynamic-factory-handle')
        lookup = 'Ljava/lang/invoke/MethodHandles$Lookup;Ljava/lang/String;Ljava/lang/invoke/MethodType;'
        if target.get('owner') == 'java/lang/invoke/LambdaMetafactory':
            signature = '(' + lookup + 'Ljava/lang/invoke/MethodType;Ljava/lang/invoke/MethodHandle;Ljava/lang/invoke/MethodType;)Ljava/lang/invoke/CallSite;'
            if target.get('name') != 'metafactory' or target.get('descriptor') != signature:
                raise Refusal('dynamic-lambda-factory')
            if len(args) != 3 or [v.get('tag') for v in args] != [16, 15, 16]:
                raise Refusal('dynamic-lambda-arguments')
            if args[1].get('target', {}).get('tag') not in (10, 11):
                raise Refusal('dynamic-implementation-target')
        elif target.get('owner') == 'java/lang/invoke/StringConcatFactory':
            signature = '(' + lookup + 'Ljava/lang/String;[Ljava/lang/Object;)Ljava/lang/invoke/CallSite;'
            if target.get('name') != 'makeConcatWithConstants' or target.get('descriptor') != signature:
                raise Refusal('dynamic-concat-factory')
            if name != 'makeConcatWithConstants' or not desc.endswith(')Ljava/lang/String;'):
                raise Refusal('dynamic-concat-result')
            if not 1 <= len(args) <= 256 or args[0].get('tag') != 8:
                raise Refusal('dynamic-concat-arguments')
            if any(v.get('tag') not in (3, 4, 5, 6, 7, 8) for v in args):
                raise Refusal('dynamic-concat-constant')
            if args[0]['value'].count('\x02') != len(args) - 1:
                raise Refusal('dynamic-concat-constant-count')
        else:
            raise Refusal('dynamic-unsupported-factory')
        # Retain every payload. A match does not establish bootstrap execution.
        return [18, name, descriptor(desc, type_key), structured(handle),
                [structured(value) for value in args]]

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
            return dynamic(index)
        raise Refusal('contract-unsupported-constant:' + str(tag))

    signature = descriptor(method.desc, type_key)
    raw = instructions(method.code)
    projection = {'field': None, 'ranges': []}
    if exclude_assertions:
        from .conditional_contracts import assertion_ranges
        projection = assertion_ranges(cls, method)
        raw = [row for row in raw if not any(start <= row[0] < end
                                            for start, end in projection['ranges'])]
    ordinal = {offset: i for i, (offset, _, _) in enumerate(raw)}
    ordinal[len(method.code)] = len(raw)
    for start, end in reversed(projection['ranges']):
        ordinal[start] = ordinal[end]
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
            'types': types, 'members': members, 'instructions': len(raw),
            'assertionProjection': projection}
