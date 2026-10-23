"""Find tracking-mode writers and check fixed lambda listener identity.

The checks read class bytes as data. They do not run vendor code. A result
lists sites and conditions. It does not exclude a path at runtime.
"""
from grid_symbols.scan import Refusal, instructions
from .owned_collectors import field_sites, invocation_sites, method_ref, ref
from .ownership import bootstraps, constant

METAFACTORY = ('java/lang/invoke/LambdaMetafactory', 'metafactory',
               '(Ljava/lang/invoke/MethodHandles$Lookup;Ljava/lang/String;Ljava/lang/invoke/MethodType;'
               'Ljava/lang/invoke/MethodType;Ljava/lang/invoke/MethodHandle;Ljava/lang/invoke/MethodType;)'
               'Ljava/lang/invoke/CallSite;')


def mode_getter(cls, method):
    """Require a static boolean getter of one private static volatile field."""
    rows = instructions(method.code)
    if method.flags & 8 == 0 or method.desc != '()Z' or [r[1] for r in rows] != [178, 172]:
        raise Refusal('mode-getter-body')
    field = ref(cls, rows[0])
    declared = [f for f in cls.fields if (f.name, f.desc) == (field['name'], 'Z')]
    if field['owner'] != cls.name or len(declared) != 1 or declared[0].flags & 0x4a != 0x4a:
        raise Refusal('mode-field-access')
    return [cls.name, field['name'], 'Z'], {'instructions': 2, 'flags': declared[0].flags}


def mode_writers(jar, field):
    """Return every write site of the mode field with its constant value."""
    report = field_sites(jar, [field])
    writers, reads = [], []
    for site in report['sites']:
        if site['opcode'] in (178, 180):
            reads.append([site['class'], *site['method'], site['offset']])
            continue
        writers.append(site)
    if report['methodHandles']:
        raise Refusal('mode-field-method-handle')
    return writers, reads, report['scannedClasses']


def constant_store(cls, method, offset):
    """Return the boolean constant stored at one putstatic site."""
    rows = instructions(method.code)
    index = [i for i, r in enumerate(rows) if r[0] == offset]
    if len(index) != 1 or index[0] == 0 or rows[index[0] - 1][1] not in (3, 4):
        raise Refusal('mode-store-value')
    return rows[index[0] - 1][1] == 4


def callers(jar, owner, name, desc, limit=20000):
    """List direct invoke sites of one method. Refuse a method handle."""
    result, handles = [], []
    for cls, method, rows, i in invocation_sites(jar, name, desc, limit, handles):
        call = method_ref(cls, rows[i])
        if call[0] != owner:
            continue
        result.append({'class': cls.name, 'method': [method.name, method.desc],
                       'flags': method.flags, 'offset': rows[i][0], 'opcode': rows[i][1]})
    for holder, target in handles:
        if target == owner:
            result.append({'class': holder, 'method': None, 'methodHandle': True})
    return result


def lambda_handles(jar, owner, name, desc):
    """Find LambdaMetafactory bootstraps whose implementation is one method."""
    hits = []
    raw = jar.zip.read(owner + '.class')
    cls = jar.code(owner)
    for i, item in enumerate(bootstraps(raw, cls)):
        target = item['handle']['target']
        if (target['owner'], target['name'], target['descriptor']) != METAFACTORY:
            continue
        impl = item['arguments'][1]['target']
        if (impl['owner'], impl['name'], impl['descriptor']) == (owner, name, desc):
            hits.append(i)
    return hits


def interface_closure(jar, name, limit=32):
    """Return all superinterfaces. Refuse an external or class supertype."""
    seen, todo = [], [name]
    while todo:
        current = todo.pop()
        if current in seen:
            continue
        if current not in jar.classes or len(seen) >= limit:
            raise Refusal('listener-interface-external:' + current)
        cls = jar.classes[current]
        if not cls.flags & 0x200 or cls.parent != 'java/lang/Object':
            raise Refusal('listener-interface-kind')
        seen.append(current)
        todo.extend(cls.interfaces)
    return seen


def lambda_listener(jar, cls, field_name):
    """Check that a constructor stores one metafactory lambda in a final field.

    The lambda class implements only the listed interfaces. None of them is
    java/util/List. The JDK proxy class does not define equals, so equality
    is identity under the stated JDK condition.
    """
    fields = [f for f in cls.fields if f.name == field_name]
    if len(fields) != 1 or fields[0].flags & 0x18 != 0x10:
        raise Refusal('listener-field-final')
    raw = jar.zip.read(cls.name + '.class')
    bs = bootstraps(raw, cls)
    stores = []
    for method in cls.methods:
        rows = instructions(method.code)
        for i, row in enumerate(rows):
            if row[1] == 181 and ref(cls, row) == {'tag': 9, 'owner': cls.name, 'name': field_name,
                                                   'descriptor': fields[0].desc}:
                if method.name != '<init>' or i == 0 or rows[i - 1][1] != 186:
                    raise Refusal('listener-field-store')
                dynamic = constant(cls, int.from_bytes(bytes(rows[i - 1][2][:2]), 'big'))
                boot = bs[dynamic['bootstrapIndex']]
                target = boot['handle']['target']
                if (target['owner'], target['name'], target['descriptor']) != METAFACTORY:
                    raise Refusal('listener-bootstrap')
                interface = dynamic['descriptor'].rsplit(')L', 1)[1][:-1]
                stores.append({'method': [method.name, method.desc], 'offset': row[0],
                               'interface': interface, 'implementation': boot['arguments'][1]['target']})
    if len(stores) != 1:
        raise Refusal('listener-store-count')
    closure = interface_closure(jar, stores[0]['interface'])
    if 'java/util/List' in closure or fields[0].desc[1:-1] not in closure:
        raise Refusal('listener-interface-list')
    return dict(stores[0], interfaces=closure, field=[cls.name, field_name, fields[0].desc],
                equality='identity', boundedAdmission=False,
                conditions=['The JDK lambda proxy implements only the listed interfaces and inherits Object.equals.',
                            'The field is assigned once in the constructor and never changes.'])


def guarded_registration(cls, method, flag, field, add_slot=None):
    """Check one add guarded by a false flag, followed by setting that flag."""
    rows = instructions(method.code)
    listener = [f.desc for f in cls.fields if f.name == field]
    if len(listener) != 1:
        raise Refusal('listener-registration-field')
    sites = [i for i, r in enumerate(rows) if r[1] == 182 and (
        method_ref(cls, r)[1:] == tuple(add_slot) if add_slot else method_ref(cls, r)[2] == '(' + listener[0] + ')V')]
    hits = []
    for i in sites:
        window = rows[i - 6:i + 1] if i >= 6 else []
        shape = [r[1] for r in window]
        if shape[:2] != [42, 180] or shape[-3:] != [42, 180, 182] or ref(cls, window[1])['name'] != flag \
                or ref(cls, window[-2])['name'] != field:
            continue
        sets = [r for r in rows[i + 1:] if r[1] == 181 and ref(cls, r)['name'] == flag]
        if not sets or rows[rows.index(sets[0]) - 1][1] != 4 or window[2][1] != 154 \
                or window[2][0] + int.from_bytes(bytes(window[2][2]), 'big', signed=True) <= sets[0][0]:
            raise Refusal('listener-registration-flag')
        hits.append(window[-1][0])
    if len(hits) != 1:
        raise Refusal('listener-registration-count')
    added = method_ref(cls, [r for r in rows if r[0] == hits[0]][0])
    return {'method': [cls.name, method.name, method.desc], 'flag': flag, 'field': field,
            'addCall': list(added), 'addOffset': hits[0], 'registrationsPerFlagCycle': 1}
