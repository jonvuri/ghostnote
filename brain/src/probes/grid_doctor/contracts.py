"""Compare local method contracts without whole-class dependencies.

Matches are trace inputs. They do not resolve receivers or authorize writes.
"""
from grid_symbols.scan import CP_OPS, Refusal, descriptor, digest, instructions


def contract(cls, method, classes):
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
        # The existing parser does not retain BootstrapMethods. Do not treat
        # an unchecked dynamic call as equivalent to another dynamic call.
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


def references(cls, method):
    result = []
    for offset, op, args in instructions(method.code):
        if op not in range(178, 186):
            continue
        owner, nt = cls.cp[args[0] * 256 + args[1]][1]
        owner = cls.cp[cls.cp[owner][1]][1]
        ni, di = cls.cp[nt][1]
        result.append({'offset': offset, 'opcode': op, 'owner': owner,
                       'name': cls.cp[ni][1], 'descriptor': cls.cp[di][1]})
    return result


def signature_key(method, classes):
    return method.flags, descriptor(method.desc, lambda n: 'vendor' if n in classes else n)


def matching_methods(source_cls, source_method, source_classes, target_cls, target_classes):
    expected = contract(source_cls, source_method, source_classes)['digest']
    shape = signature_key(source_method, source_classes)
    matches, unsupported = [], []
    for method in target_cls.methods:
        if signature_key(method, target_classes) != shape:
            continue
        try:
            actual = contract(target_cls, method, target_classes)['digest']
        except Refusal as error:
            unsupported.append({'name': method.name, 'descriptor': method.desc, 'reason': str(error)})
            continue
        if actual == expected:
            matches.append(method)
    return matches, unsupported
