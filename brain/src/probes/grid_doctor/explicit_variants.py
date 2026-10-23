"""Check three traced local differences. Do not admit their runtime dependencies."""
import copy
import hashlib
from pathlib import Path

from grid_symbols.scan import Refusal, descriptor, digest, parse
from .contracts import contract
from .migrate import bindings, member, merge
from .ownership import bootstraps, method_trace


def disposal_prefix(source, cls, target):
    """Remove only the traced tracking tail from a comparison copy."""
    from .contracts import references
    if source.desc != '()V' or target.desc != '()V' or source.flags != 1 or target.flags != 1 or source.handlers or target.handlers or not source.code or source.code[-1] != 177:
        raise Refusal('variant-disposal-source-or-access')
    refs = references(cls, target)
    tail = [r for r in refs if r['offset'] >= len(source.code) - 1]
    if len(target.code) != len(source.code) + 4 or target.code[-5] != 42 or target.code[-4] != 184 or target.code[-1] != 177:
        raise Refusal('variant-disposal-tail-shape')
    if len(tail) != 1 or tail[0]['opcode'] != 184 or tail[0]['descriptor'] != '(Ljava/lang/Object;)V':
        raise Refusal('variant-disposal-tail-call')
    altered = copy.deepcopy(target)
    altered.code = target.code[:-5] + bytes([177])
    return altered


def jdk_membership(root):
    """Inspect extracted runtime classes as data. Never initialize a Java class."""
    base = Path(root) / 'java.base'
    paths = ['java/util/Collections', 'java/util/Collections$EmptyList',
             'java/util/Collections$EmptySet', 'java/util/Collections$EmptyMap',
             'java/util/AbstractList', 'java/util/AbstractCollection',
             'java/util/AbstractSet', 'java/lang/Object']
    records = []
    for name in paths:
        raw = (base / (name + '.class')).read_bytes()
        if len(raw) > 1024**2:
            raise Refusal('variant-jdk-class-limit')
        cls = parse(raw, True)
        if cls.name != name:
            raise Refusal('variant-jdk-class-identity')
        methods = [m for m in cls.methods if m.name in ('<init>', '<clinit>', 'emptyList')]
        records.append({'name': name, 'parent': cls.parent, 'sha256': hashlib.sha256(raw).hexdigest(),
                        'methods': [{'name': m.name, 'descriptor': m.desc,
                                     'contract': contract(cls, m, {})} for m in methods]})
        if name == 'java/util/Collections':
            getter = member(cls, 'emptyList', '()Ljava/util/List;')
            actual = contract(cls, getter, {})
            expected = [[178, [9, name, 'EMPTY_LIST', 'Ljava/util/List;'], []], [176, []]]
            if getter.flags != 25 or actual['tokens'] != expected or getter.handlers:
                raise Refusal('variant-jdk-empty-list-body')
            fields = [f for f in cls.fields if f.name == 'EMPTY_LIST']
            if len(fields) != 1 or fields[0].desc != 'Ljava/util/List;' or fields[0].flags != 25:
                raise Refusal('variant-jdk-empty-list-field')
    return {'classes': records, 'methodAllocation': 0, 'addedInvocations': 1,
            'initialization': 'Both getstatic and invokestatic require Collections initialization. The field is not a compile-time constant.',
            'runtimeInitialized': 'not-observed', 'latencyMeasured': False}


def variants(old, target, candidate, report, code, jdk):
    known = [report['typeBindings'], {tuple(r['source']): tuple(r['target']) for r in report['memberBindings']}]
    rows = {r['role']: r for r in report['members']}
    result = []
    for role in ('disposal', 'members', 'journal-recording-edit'):
        row = rows[role]
        source = row['source']
        ref = row['reference']
        if ref is None:
            raise Refusal('variant-unbound-role')
        ac, bc = code.get(old, source['declaring']), code.get(target, ref[1])
        am, bm = member(ac, source['name'], source['descriptor']), member(bc, ref[2], ref[3])
        av, bv = contract(ac, am, old.classes), contract(bc, bm, target.classes)
        kind, requirements = 'shared-exact-contract', []
        altered = copy.deepcopy(bm)
        if av['digest'] != bv['digest']:
            if role == 'journal-recording-edit':
                if am.flags != 2 or bm.flags != 0:
                    raise Refusal('variant-recording-access')
                altered.flags = am.flags
                bv = contract(bc, altered, target.classes)
                kind = 'private-to-package-access-only'
                requirements = ['Retain exact lookup receiver and reflective access checks.']
            elif role == 'disposal':
                altered = disposal_prefix(am, bc, bm)
                bv = contract(bc, altered, target.classes)
                kind = 'exact-prefix-plus-tracking-tail'
                requirements = [
                    'The tracking helper must be initialized and disabled before every disposal.',
                    'Mode stability requires command and callback closure; one false read is insufficient.',
                    'Enabled tracking has an uncapped global queue and monitor wait. It remains refused.',
                    'A tail failure follows mutation. Retain the uncertain-state latch.']
            elif role == 'members':
                expected = [184, [10, 'java/util/Collections', 'emptyList', '()Ljava/util/List;'], []]
                indices = [i for i, token in enumerate(bv['tokens']) if token == expected]
                if len(indices) != 1 or not jdk:
                    raise Refusal('variant-membership-external-call')
                bv = copy.deepcopy(bv)
                bv['tokens'][indices[0]] = [178, [9, 'java/util/Collections', 'EMPTY_LIST', 'Ljava/util/List;'], []]
                signature = descriptor(bm.desc, lambda name: bv['types'].get(name, name))
                bv['digest'] = digest([bm.flags, signature, bv['tokens'], bv['handlers']])
                kind = 'jdk-empty-list-access'
                requirements = ['Pin the inspected runtime artifact. Keep its initialization and added static call in the cost model.']
        merge(known, bindings(av, bv))
        result.append({'role': role, 'variant': kind, 'localContractChecked': True,
                       'runtimeAdmission': False, 'requirements': requirements,
                       'source': method_trace(old, ac, am, bootstraps(old.zip.read(ac.name + '.class'), ac)),
                       'target': method_trace(target, bc, bm, bootstraps(target.zip.read(bc.name + '.class'), bc))})
    return result
