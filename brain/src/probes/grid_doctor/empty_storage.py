"""Check ordinary references to a private empty descriptor list."""
from grid_symbols.scan import Refusal, ancestors, instructions
from .migrate import member
from .ownership import constant


def empty_list_references(jar, code, field, scan):
    """Check a complete receiver-trace result for one list field.

    The caller must verify the scan inputs and plan. This check excludes
    reflective and native writes. Runtime initialization needs a guard.
    """
    owner, name, desc = field
    if (scan['input']['sha256'] != jar.sha256 or scan['work']['classes'] != len(jar.classes)
            or scan['work']['methods'] != sum(len(c.methods) for c in jar.classes.values())):
        raise Refusal('empty-storage-scan-coverage')
    cls = code.get(jar, owner)
    fields = [f for f in cls.fields if (f.name, f.desc) == (name, desc)]
    if len(fields) != 1 or fields[0].flags != 18 or desc != 'Ljava/util/List;':
        raise Refusal('empty-storage-field')
    for site in scan['methodHandles'] + scan['unresolvedReferences']:
        ref = site['target']
        if ((ref.get('name'), ref.get('descriptor')) == (name, desc) and
                owner in set(ancestors(jar.classes, ref['owner'], 128))):
            raise Refusal('empty-storage-unresolved-or-handle')
    writes, reads = [], []
    for site in scan['sites']:
        ref = site['target']
        if (site['resolution']['owner'], ref['name'], ref['descriptor']) != field:
            continue
        if site['caller'] != owner:
            raise Refusal('empty-storage-foreign-access')
        method = member(cls, site['method'], site['descriptor'])
        raw = instructions(method.code)
        positions = [i for i, row in enumerate(raw) if row[0] == site['offset']]
        if len(positions) != 1 or len(raw) > 4096:
            raise Refusal('empty-storage-method-shape')
        i = positions[0]
        def ref_at(index):
            return constant(cls, int.from_bytes(bytes(raw[index][2][:2]), 'big'))
        actual = ref_at(i)
        if (actual.get('owner'), actual.get('name'), actual.get('descriptor')) != field:
            raise Refusal('empty-storage-site-disagreement')
        op = raw[i][1]
        if op != site['opcode']:
            raise Refusal('empty-storage-opcode-disagreement')
        if op == 181:
            if (method.name != '<init>' or method.handlers or i < 4 or [x[1] for x in raw[i - 4:i + 1]] !=
                    [42, 187, 89, 183, 181] or ref_at(i - 3) != {
                        'tag': 7, 'value': 'java/util/ArrayList'} or ref_at(i - 1) != {
                        'tag': 10, 'owner': 'java/util/ArrayList', 'name': '<init>',
                        'descriptor': '()V'}):
                raise Refusal('empty-storage-initializer')
            start, end = raw[i - 4][0], raw[i][0]
            for offset, opcode, operands in raw:
                targets = []
                if opcode in (*range(153, 169), 198, 199, 200, 201):
                    targets = [offset + int.from_bytes(bytes(operands), 'big', signed=True)]
                elif opcode == 170:
                    targets = [offset + delta for delta in [operands[0], *operands[3:]]]
                elif opcode == 171:
                    targets = [offset + delta for delta in [operands[0], *operands[2::2]]]
                if opcode in (168, 169, 201) or any(start < dest <= end for dest in targets):
                    raise Refusal('empty-storage-initializer-entry')
            writes.append([owner, method.name, method.desc, site['offset']])
        elif op == 180:
            if i == 0 or i + 1 >= len(raw) or raw[i - 1][1] != 42 or raw[i + 1][1] != 185:
                raise Refusal('empty-storage-reference-escape')
            call = ref_at(i + 1)
            if (call.get('tag') != 11 or call['owner'] != 'java/util/List' or
                    (call['name'], call['descriptor']) not in (
                        ('isEmpty', '()Z'), ('iterator', '()Ljava/util/Iterator;'))):
                raise Refusal('empty-storage-list-operation')
            reads.append([owner, method.name, method.desc, site['offset'], call['name']])
        else:
            raise Refusal('empty-storage-field-opcode')
    if len(writes) != 1 or not reads:
        raise Refusal('empty-storage-reference-count')
    return {'field': list(field), 'initialization': writes[0], 'reads': reads,
            'ordinaryReferenceCheck': True, 'boundedAdmission': False,
            'conditions': ['The scan covers all ordinary field references and method handles.',
                           'The field belongs to a fully initialized descriptor.',
                           'The field contains an exact empty ArrayList.',
                           'Reflective and native mutation require separate exclusion.']}
