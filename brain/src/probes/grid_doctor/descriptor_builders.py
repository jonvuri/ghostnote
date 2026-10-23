"""Count generated descriptor registrations without executing vendor code."""
from grid_symbols.scan import Refusal, ancestors, instructions
from .ownership import constant


def lookup(jar, code, owner, name, desc):
    seen = set()
    while owner in jar.classes:
        if owner in seen or len(seen) >= 128:
            raise Refusal('builder-lookup-cycle-or-depth')
        seen.add(owner)
        cls = code.get(jar, owner)
        matches = [m for m in cls.methods if (m.name, m.desc) == (name, desc)]
        if matches:
            if len(matches) != 1:
                raise Refusal('builder-duplicate-method')
            return cls, matches[0]
        owner = cls.parent
    raise Refusal('builder-missing-method')


def registrations(jar, code, receiver, builder, append, attribute=None):
    """Accept a super call followed by fixed getter or field registrations.

    This counts calls to the supplied append method. It does not prove the
    getter body, append body, field initialization, or runtime receiver.
    """
    if builder[2] != '(Ljava/util/List;)V':
        raise Refusal('builder-signature')
    if builder[0] not in set(ancestors(jar.classes, receiver, 128)):
        raise Refusal('builder-root-receiver')
    root, slot = lookup(jar, code, *builder)
    if root.name != builder[0] or slot.flags & (2 | 8 | 256):
        raise Refusal('builder-root-slot')
    chain, properties, attributes, seen = [], [], [], set()
    decoded = 0

    def reference(cls, row):
        return constant(cls, int.from_bytes(bytes(row[2]), 'big'))

    def walk(owner):
        nonlocal decoded
        cls, method = lookup(jar, code, owner, *builder[1:])
        key = cls.name, method.name, method.desc
        if key in seen or len(seen) >= 128:
            raise Refusal('builder-cycle-or-depth')
        seen.add(key)
        raw = instructions(method.code)
        decoded += len(raw)
        if (method.flags & (8 | 256 | 1024) or method.handlers or not raw
                or raw[-1][1] != 177 or len(raw) > 4096 or decoded > 100000):
            raise Refusal('builder-body')
        chain.append(list(key))
        i = 0
        if len(raw) >= 4 and [r[1] for r in raw[:3]] == [42, 43, 183]:
            call = reference(cls, raw[2])
            if (call.get('tag') != 10 or call['owner'] != cls.parent
                    or (call['name'], call['descriptor']) != builder[1:]):
                raise Refusal('builder-super-call')
            walk(cls.parent)
            i = 3
        while i < len(raw) - 1:
            block = raw[i:i + 4]
            if (attribute is not None and len(block) == 4 and
                    [r[1] for r in block] in ([42, 18, 178, 182], [42, 19, 178, 182])):
                operand = block[1][2]
                label = constant(cls, operand[0] if block[1][1] == 18 else
                                 int.from_bytes(bytes(operand), 'big'))
                value, call = reference(cls, block[2]), reference(cls, block[3])
                if (label != {'tag': 8, 'value': 'not_engine'} or value != {
                        'tag': 9, 'owner': 'java/lang/Boolean', 'name': 'TRUE',
                        'descriptor': 'Ljava/lang/Boolean;'} or call['owner'] not in
                        set(ancestors(jar.classes, receiver, 128))):
                    raise Refusal('builder-attribute-operands')
                ac, am = lookup(jar, code, receiver, call['name'], call['descriptor'])
                if ((ac.name, am.name, am.desc) != attribute or am.flags & (2 | 8 | 256 | 1024)
                        or am.desc != '(Ljava/lang/String;Ljava/lang/Object;)V'):
                    raise Refusal('builder-attribute-target')
                attributes.append({'builder': list(key), 'offset': block[0][0],
                                   'name': label['value'], 'value': True, 'target': list(attribute)})
                i += 4
                continue
            block = raw[i:i + 5]
            if (len(block) != 5 or [r[1] for r in block] not in
                    ([42, 42, 182, 43, 182], [42, 42, 180, 43, 182])):
                raise Refusal('builder-registration-shape')
            value, call = reference(cls, block[2]), reference(cls, block[4])
            lineage = set(ancestors(jar.classes, receiver, 128))
            if call['owner'] not in lineage or value['owner'] not in lineage:
                raise Refusal('builder-registration-receiver')
            ac, am = lookup(jar, code, receiver, call['name'], call['descriptor'])
            if ((ac.name, am.name, am.desc) != append or not am.flags & 16
                    or am.flags & (8 | 256 | 1024)):
                raise Refusal('builder-append-target')
            if block[2][1] == 182:
                if value['tag'] != 10 or not value['descriptor'].startswith('()L'):
                    raise Refusal('builder-getter-signature')
                vc, vm = lookup(jar, code, receiver, value['name'], value['descriptor'])
                if vm.flags & (2 | 8 | 256 | 1024):
                    raise Refusal('builder-getter-access')
                source = [vc.name, vm.name, vm.desc]
                kind = 'getter'
            else:
                if value['tag'] != 9 or not value['descriptor'].startswith('L'):
                    raise Refusal('builder-field-signature')
                vc = code.get(jar, value['owner'])
                fields = [f for f in vc.fields if (f.name, f.desc) ==
                          (value['name'], value['descriptor'])]
                if len(fields) != 1 or fields[0].flags & 8:
                    raise Refusal('builder-field-declaration')
                source = [vc.name, fields[0].name, fields[0].desc]
                kind = 'field'
            properties.append({'builder': list(key), 'offset': block[0][0],
                               'kind': kind, 'source': source})
            if len(properties) > 4096:
                raise Refusal('builder-property-limit')
            i += 5

    walk(receiver)
    return {'receiver': receiver, 'chain': chain, 'registrations': properties,
            'attributes': attributes,
            'count': len(properties), 'instructions': decoded,
            'boundedAdmission': False, 'runtimeObserved': False}
