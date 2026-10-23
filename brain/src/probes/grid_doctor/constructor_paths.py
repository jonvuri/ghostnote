"""Select descriptor constructor paths from explicit parent calls."""
from grid_symbols.scan import Refusal, instructions
from .migrate import member
from .ownership import constant
from .read_dataflow import signature


def constructor_path(jar, code, owner, desc='()V'):
    current, seen, rows = (owner, desc), set(), []
    while current[0] in jar.classes:
        if current in seen or len(seen) >= 128:
            raise Refusal('constructor-path-cycle-or-depth')
        seen.add(current)
        cls = code.get(jar, current[0])
        method = member(cls, '<init>', current[1])
        raw = instructions(method.code)
        if (method.flags & (8 | 256 | 1024) or method.handlers or not raw
                or raw[0][1] != 42 or len(raw) > 4096 or signature(method.desc)[1] != 'V'):
            raise Refusal('constructor-path-body')
        call = None
        for i, (offset, op, args) in enumerate(raw[1:], 1):
            if op == 183:
                call = constant(cls, int.from_bytes(bytes(args), 'big'))
                if (call['name'] != '<init>' or call['owner'] not in (cls.name, cls.parent)
                        or i != len(signature(call['descriptor'])[0]) + 1):
                    raise Refusal('constructor-path-receiver')
                break
            # Each permitted operand pushes one argument value.
            if not 1 <= op <= 45:
                raise Refusal('constructor-path-prefix')
            if op in (18, 19, 20):
                value = constant(cls, args[0] if op == 18 else int.from_bytes(bytes(args), 'big'))
                if value['tag'] not in (3, 4, 5, 6, 7, 8):
                    raise Refusal('constructor-path-constant')
        if call is None:
            raise Refusal('constructor-path-parent-call')
        rows.append({'owner': cls.name, 'descriptor': method.desc, 'offset': offset,
                     'parent': call['owner'], 'parentDescriptor': call['descriptor']})
        current = call['owner'], call['descriptor']
    if current != ('java/lang/Object', '()V'):
        raise Refusal('constructor-path-external-parent')
    return rows


def catalog_constructor_paths(jar, catalog, code):
    if len(catalog['rows']) > 128:
        raise Refusal('constructor-path-catalog-limit')
    result, witnesses = {}, []
    for row in catalog['rows']:
        if row['count'] != 1:
            raise Refusal('constructor-path-anchor-count')
        pair = row['name'], row['id']
        if pair in result:
            raise Refusal('constructor-path-duplicate-anchor')
        chain = constructor_path(jar, code, row['matches'][0]['descriptor'])
        selected = {}
        for item in chain:
            selected.setdefault(item['owner'], set()).add(item['descriptor'])
        result[pair] = selected
        witnesses.append({'name': pair[0], 'id': pair[1], 'chain': chain})
    return result, witnesses
