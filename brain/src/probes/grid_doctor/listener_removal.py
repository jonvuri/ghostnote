"""Check two listener-removal forms under explicit storage and mode guards."""
import re

from grid_symbols.scan import Refusal, instructions
from .conditional_contracts import assertion_ranges
from .descriptor_builders import lookup
from .ownership import constant


def removal_contract(jar, code, cls, method):
    """Keep list and single-listener storage as separate local contracts."""
    if method.flags != 1 or method.handlers or not re.fullmatch(r'\(L[^;]+;\)V', method.desc):
        raise Refusal('listener-removal-method')
    raw = instructions(method.code)
    if not raw or len(raw) > 4096:
        raise Refusal('listener-removal-body-limit')
    guard = assertion_ranges(cls, method)
    if guard['field'] is None:
        raise Refusal('listener-removal-assertion-guard')
    ranges = guard['ranges']
    selected = [r for r in raw if not any(a <= r[0] < b for a, b in ranges)]

    def ref(row):
        return constant(cls, int.from_bytes(bytes(row[2][:2]), 'big'))

    mode = None
    if selected[0][1] == 184:
        if [r[1] for r in selected[:5]] != [184, 153, 42, 43, 184] or len(selected) < 6:
            raise Refusal('listener-removal-mode-prefix')
        predicate, recording = ref(selected[0]), ref(selected[4])
        if (predicate.get('tag') != 10 or predicate['descriptor'] != '()Z'
                or recording.get('tag') != 10 or recording['owner'] != predicate['owner']
                or recording['descriptor'] != '(Ljava/lang/Object;Ljava/lang/Object;)V'):
            raise Refusal('listener-removal-mode-calls')
        branch = selected[1]
        if branch[0] + int.from_bytes(bytes(branch[2]), 'big', signed=True) != selected[5][0]:
            raise Refusal('listener-removal-mode-branch')
        owner, getter = lookup(jar, code, predicate['owner'], predicate['name'], '()Z')
        rows = instructions(getter.code)
        if getter.flags != 9 or getter.handlers or [r[1] for r in rows] != [178, 172]:
            raise Refusal('listener-removal-mode-getter')
        field = constant(owner, int.from_bytes(bytes(rows[0][2]), 'big'))
        if field.get('tag') != 9 or field['owner'] != owner.name or field['descriptor'] != 'Z':
            raise Refusal('listener-removal-mode-field')
        fields = [f for f in owner.fields if (f.name, f.desc) == (field['name'], 'Z')]
        if len(fields) != 1 or not fields[0].flags & 8:
            raise Refusal('listener-removal-mode-field')
        mode = {'getter': [owner.name, getter.name, getter.desc],
                'requiredFalseField': [owner.name, field['name'], 'Z'],
                'getterInstructions': 2, 'excludedRecordingCall': recording}
        selected = selected[5:]
    if len(selected) < 2 or [r[1] for r in selected[:2]] != [42, 180]:
        raise Refusal('listener-removal-storage-read')
    storage = ref(selected[1])
    if (storage.get('tag') != 9 or storage['owner'] != cls.name
            or storage['descriptor'] not in ('Ljava/util/List;', 'Ljava/lang/Object;')):
        raise Refusal('listener-removal-storage-field')
    fields = [f for f in cls.fields if (f.name, f.desc) == (storage['name'], storage['descriptor'])]
    if len(fields) != 1 or fields[0].flags != 2:
        raise Refusal('listener-removal-storage-field')
    single = storage['descriptor'] == 'Ljava/lang/Object;'
    if single != (mode is not None):
        raise Refusal('listener-removal-storage-mode')
    positions = {r[0]: i for i, r in enumerate(selected)}
    tokens = []
    for offset, op, args in selected:
        if op in (153, 166, 199):
            target = offset + int.from_bytes(bytes(args), 'big', signed=True)
            for start, end in ranges:
                if target == start:
                    target = end
            if target not in positions:
                raise Refusal('listener-removal-branch-target')
            tokens.append((op, positions[target]))
        elif op in (180, 181):
            if ref((offset, op, args)) != storage:
                raise Refusal('listener-removal-storage-alias')
            tokens.append((op, 'storage'))
        elif op in (192, 193):
            if ref((offset, op, args)) != {'tag': 7, 'value': 'java/util/List'}:
                raise Refusal('listener-removal-list-type')
            tokens.append((op, 'list'))
        elif op == 185:
            call = ref((offset, op, args))
            pair = call.get('name'), call.get('descriptor')
            if call.get('tag') != 11 or call.get('owner') != 'java/util/List' or pair not in (
                    ('remove', '(Ljava/lang/Object;)Z'), ('isEmpty', '()Z')):
                raise Refusal('listener-removal-list-call')
            if tuple(args[2:]) != ((2, 0) if pair[0] == 'remove' else (1, 0)):
                raise Refusal('listener-removal-interface-arguments')
            tokens.append((op, pair[0]))
        else:
            tokens.append((op, *args))
    old = [(42,), (180, 'storage'), (199, 4), (177,), (42,), (180, 'storage'),
           (43,), (185, 'remove'), (87,), (177,)]
    new = [(42,), (180, 'storage'), (199, 4), (177,),
           (42,), (180, 'storage'), (43,), (166, 12), (42,), (1,), (181, 'storage'), (177,),
           (42,), (180, 'storage'), (78,), (45,), (193, 'list'), (153, 32),
           (45,), (192, 'list'), (77,), (44,), (43,), (185, 'remove'), (87,),
           (44,), (185, 'isEmpty'), (153, 31), (42,), (1,), (181, 'storage'), (177,), (177,)]
    if tokens != (new if single else old):
        raise Refusal('listener-removal-body')
    return {'method': [cls.name, method.name, method.desc],
            'storageField': [cls.name, storage['name'], storage['descriptor']],
            'storageForm': 'single-or-list' if single else 'list',
            'assertionGuard': guard['field'], 'mode': mode,
            # Sum all branch bodies. Each branch is forward and each guard costs two instructions.
            'ownInstructionBound': len(tokens) + 2 * len(ranges) + (2 if mode else 0),
            'vendorCallBound': int(mode is not None), 'listRemoveCallBound': 1,
            'listIsEmptyCallBound': int(single), 'explicitAllocations': 0,
            'boundedAdmission': False, 'runtimeObserved': False,
            'conditions': ['The assertion field must already be initialized and true.',
                           'The tracking field, if present, must remain false.',
                           'Storage must remain null, one non-List listener, or an exact ArrayList.',
                           'The query must be non-null and use Object.equals.',
                           'List size, capacity, JDK bodies, and native array copies need separate bounds.',
                           'Storage identity and capacity are not equivalent between forms.',
                           'A failure propagates. Do not retry an uncertain removal.']}
