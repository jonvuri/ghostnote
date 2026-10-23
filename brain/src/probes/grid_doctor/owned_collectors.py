"""Bound the owned-child collector, its storage reads, and its JDK iterators.

The checks read class bytes as data. They do not load or initialize a class.
Each result is conditional. It is not bounded admission.
"""
from grid_symbols.scan import Refusal, instructions, parse
from .conditional_contracts import assertion_ranges
from .descriptor_builders import lookup
from .ownership import constant

KEY = '(Ljava/lang/String;)Ljava/util/List;'
EXCEPTIONS = {'java/lang/NullPointerException', 'java/util/NoSuchElementException',
              'java/util/ConcurrentModificationException', 'java/lang/AssertionError'}
CONDITIONS = [
    'Every assertion field on the path is initialized and true.',
    'The key argument is null. The disposal and walk callers pass a null constant.',
    'The descriptor singleton is initialized and its owned-property array is final.',
    'Each list storage field is null or an exact java/util/ArrayList.',
    'Each map storage field is an exact java/util/LinkedHashMap with a stable linked list.',
    'No storage, array, or map changes during the collector call or the caller iteration.',
    'No reflection, Unsafe, VarHandle, or native code writes a checked field.',
    'The ArrayList element array stays an exact Object array. Sizes stay below 2^31 - 9.',
    'Native execution time, class initialization, and failure latency are excluded.',
    'A failure propagates. Do not retry an uncertain disposal.']


def ref(cls, row):
    return constant(cls, int.from_bytes(bytes(row[2][:2]), 'big'))


def method_ref(cls, row, tag=None):
    value = ref(cls, row)
    if value.get('tag') not in ((10, 11) if tag is None else (tag,)):
        raise Refusal('collector-reference-tag')
    return value['owner'], value['name'], value['descriptor']


def target(row):
    return row[0] + int.from_bytes(bytes(row[2][:2]), 'big', signed=True)


def kept(cls, method):
    """Return rows outside recognized assertion blocks and the block ranges."""
    if method.handlers:
        raise Refusal('collector-handler')
    raw = instructions(method.code)
    if not raw or len(raw) > 4096:
        raise Refusal('collector-body-limit')
    guard = assertion_ranges(cls, method)
    ranges = guard['ranges']
    rows = [r for r in raw if not any(a <= r[0] < b for a, b in ranges)]
    return rows, ranges, guard['field']


def tokens(rows):
    return [r[1] if r[1] not in (25, 58) else (r[1], r[2][0]) for r in rows]


def collector_contract(cls, method):
    """Check the owned-child collector body and return its own costs."""
    if method.flags != 1 or method.desc != KEY:
        raise Refusal('collector-method')
    rows, ranges, field = kept(cls, method)
    expected = [187, 89, 183, 77, 42, 182, 182, 78, 45, 185, (58, 4), (25, 4), 185, 153,
                (25, 4), 185, 192, (58, 5), (25, 5), 42, 44, 43, 182, 167, 44, 176]
    if tokens(rows) != expected or len(ranges) != 3 or field is None:
        raise Refusal('collector-body')
    if ranges[0] != (0, rows[0][0]) or ranges[1][0] != rows[17][0] + 2 \
            or ranges[1][1] != ranges[2][0] or ranges[2][1] != rows[18][0]:
        raise Refusal('collector-assertion-position')
    if ref(cls, rows[0]) != {'tag': 7, 'value': 'java/util/ArrayList'} \
            or method_ref(cls, rows[2]) != ('java/util/ArrayList', '<init>', '()V'):
        raise Refusal('collector-output')
    descriptor = method_ref(cls, rows[5])
    properties = method_ref(cls, rows[6])
    if descriptor[0] != cls.name or not descriptor[2].startswith('()L') \
            or properties[0] != descriptor[2][3:-1] or properties[2] != '()Ljava/util/List;':
        raise Refusal('collector-descriptor-calls')
    calls = [method_ref(cls, rows[i], 11) for i in (9, 12, 15)]
    if calls != [('java/util/List', 'iterator', '()Ljava/util/Iterator;'),
                 ('java/util/Iterator', 'hasNext', '()Z'),
                 ('java/util/Iterator', 'next', '()Ljava/lang/Object;')]:
        raise Refusal('collector-iterator-calls')
    relationship = ref(cls, rows[16])['value']
    slot = method_ref(cls, rows[22])
    if slot != (relationship, slot[1], '(L' + cls.name + ';Ljava/util/List;Ljava/lang/String;)V'):
        raise Refusal('collector-relationship-slot')
    if target(rows[13]) != rows[24][0] or target(rows[23]) != rows[11][0]:
        raise Refusal('collector-branch')
    inner = len(ranges) - 1
    return {'method': [cls.name, method.name, method.desc], 'assertionGuard': list(field),
            'descriptorGetter': list(descriptor), 'propertyList': list(properties),
            'relationship': relationship, 'relationshipSlot': list(slot),
            'output': 'java/util/ArrayList', 'iteratorOutput': 'java/util/ArrayList$Itr',
            # P is the number of owned properties. Each guard costs two instructions.
            'ownInstructions': {'constant': 11 + 2 + 2 + 3, 'perProperty': 3 + 10 + 2 * inner},
            'vendorCalls': {'constant': 2, 'perProperty': 1},
            'interfaceCalls': {'constant': 2, 'perProperty': 2},
            'allocations': {'constant': 1}, 'boundedAdmission': False}


def property_list_contract(jar, code, descriptor, getter, relationship):
    """Check the descriptor getter for the owned-property array."""
    cls, method = lookup(jar, code, descriptor, *getter[1:])
    if method.flags != 17 or method.handlers:
        raise Refusal('property-list-method')
    rows = instructions(method.code)
    if [r[1] for r in rows] != [42, 180, 199, 178, 176, 42, 180, 184, 176]:
        raise Refusal('property-list-body')
    field = ref(cls, rows[1])
    if field != ref(cls, rows[6]) or field.get('owner') != cls.name \
            or field['descriptor'] != '[L' + relationship + ';':
        raise Refusal('property-list-field')
    if ref(cls, rows[3]) != {'tag': 9, 'owner': 'java/util/Collections', 'name': 'EMPTY_LIST',
                             'descriptor': 'Ljava/util/List;'} \
            or method_ref(cls, rows[7]) != ('java/util/Arrays', 'asList',
                                            '([Ljava/lang/Object;)Ljava/util/List;') \
            or target(rows[2]) != rows[5][0]:
        raise Refusal('property-list-calls')
    declared = [f for f in cls.fields if (f.name, f.desc) == (field['name'], field['descriptor'])]
    if len(declared) != 1 or declared[0].flags & 15 != 2:
        raise Refusal('property-list-field-access')
    return cls, {'method': [cls.name, method.name, method.desc],
                 'arrayField': [cls.name, field['name'], field['descriptor']],
                 'ownInstructions': 7, 'boundedAdmission': False}


def strong_filter(jar, code, cls, field, relationship):
    """Require one array store guarded by the strong kind test.

    Return the kind getter and the strong enum field. Nest members and
    reflection are not checked here; they remain conditions.
    """
    pattern = [25, 182, 178, 166, 42, 180, 21, 132, 25, 192, 83]
    writes, guarded, kinds = [], [], set()
    for method in cls.methods:
        rows = instructions(method.code)
        for i, row in enumerate(rows):
            if row[1] not in (180, 181) or ref(cls, row) != field:
                continue
            if row[1] == 181:
                writes.append(method.name + method.desc)
                continue
            if 83 not in [r[1] for r in rows[i + 1:i + 6]]:
                continue
            window = rows[i - 5:i + 6]
            if [r[1] for r in window] != pattern or ref(cls, window[9]) != {'tag': 7, 'value': relationship}:
                raise Refusal('strong-filter-store')
            getter, kind = method_ref(cls, window[1]), ref(cls, window[2])
            if getter[0] != relationship or getter[2] != '()L' + kind['owner'] + ';' \
                    or kind['descriptor'] != 'L' + kind['owner'] + ';':
                raise Refusal('strong-filter-kind')
            kinds.add((getter, kind['owner'], kind['name']))
            guarded.append(method.name + method.desc)
    if len(writes) != 1 or guarded != writes or len(kinds) != 1:
        raise Refusal('strong-filter-writer')
    getter, enum, name = kinds.pop()
    names = enum_names(code.get(jar, enum))
    if names.get(name) != 'STRONG':
        raise Refusal('strong-filter-not-strong')
    return {'writer': writes[0], 'kindGetter': list(getter), 'kindEnum': enum,
            'strongField': name, 'enumNames': names}


def enum_names(cls):
    """Map enum fields to declared constant names from the class initializer."""
    method = [m for m in cls.methods if m.name == '<clinit>']
    if cls.parent != 'java/lang/Enum' or len(method) != 1:
        raise Refusal('kind-enum-class')
    rows, names = instructions(method[0].code), {}
    for i, row in enumerate(rows):
        if row[1] == 179 and i >= 6 and rows[i - 1][1] == 183 and rows[i - 6][1] == 187:
            name = constant(cls, rows[i - 4][2][0])
            fieldref = ref(cls, row)
            if name.get('tag') != 8 or fieldref['owner'] != cls.name:
                raise Refusal('kind-enum-constant')
            names[fieldref['name']] = name['value']
    if sorted(names.values()) != ['SHARED', 'STRONG', 'WEAK']:
        raise Refusal('kind-enum-values')
    return names


def relationship_form(cls, method):
    """Classify the null-key relationship collector body."""
    rows, ranges, _ = kept(cls, method)
    shape = tokens(rows)
    if shape == [42, 43, 182, (58, 4), (25, 4), 198, 44, (25, 4), 185, 87, 177] and len(ranges) == 2:
        if method_ref(cls, rows[8], 11) != ('java/util/List', 'add', '(Ljava/lang/Object;)Z'):
            raise Refusal('relationship-single-call')
        if target(rows[5]) != rows[10][0]:
            raise Refusal('relationship-single-branch')
        return {'form': 'single', 'getter': list(method_ref(cls, rows[2])),
                'ownInstructions': len(rows) + 2 * len(ranges), 'listCalls': ['add']}
    if shape == [44, 42, 43, 182, 185, 87, 177] and not ranges:
        if method_ref(cls, rows[4], 11) != ('java/util/List', 'addAll', '(Ljava/util/Collection;)Z'):
            raise Refusal('relationship-list-call')
        return {'form': 'list', 'getter': list(method_ref(cls, rows[3])),
                'ownInstructions': len(rows), 'listCalls': ['addAll']}
    if shape[:10] == [45, 199, 44, 42, 43, 182, 185, 185, 87, 167]:
        if method_ref(cls, rows[6], 11) != ('java/util/Map', 'values', '()Ljava/util/Collection;') \
                or method_ref(cls, rows[7], 11) != ('java/util/List', 'addAll', '(Ljava/util/Collection;)Z') \
                or rows[-1][1] != 177 or target(rows[9]) != rows[-1][0]:
            raise Refusal('relationship-map-null-key')
        return {'form': 'map', 'getter': list(method_ref(cls, rows[5])),
                'ownInstructions': 11, 'listCalls': ['addAll'], 'mapCalls': ['values'],
                'excludedBranch': 'non-null key'}
    raise Refusal('relationship-form')


def list_getter_form(cls, method):
    """Check a null-or-unmodifiable list storage getter. Return its field."""
    rows, ranges, _ = kept(cls, method)
    if len(rows) != 9 or [r[1] for r in rows] != [42, 180, 199, rows[3][1], 167, 42, 180, 184, 176] \
            or rows[3][1] not in (178, 184) \
            or len(ranges) > 1:
        raise Refusal('list-getter-body')
    field = ref(cls, rows[1])
    empty = ref(cls, rows[3])
    if field != ref(cls, rows[6]) or field.get('descriptor') != 'Ljava/util/List;' \
            or empty not in ({'tag': 10, 'owner': 'java/util/Collections', 'name': 'emptyList',
                              'descriptor': '()Ljava/util/List;'},
                             {'tag': 9, 'owner': 'java/util/Collections', 'name': 'EMPTY_LIST',
                              'descriptor': 'Ljava/util/List;'}) \
            or method_ref(cls, rows[7]) != ('java/util/Collections', 'unmodifiableList',
                                            '(Ljava/util/List;)Ljava/util/List;') \
            or target(rows[2]) != rows[5][0] or target(rows[4]) != rows[8][0]:
        raise Refusal('list-getter-calls')
    return {'field': [field['owner'], field['name'], field['descriptor']],
            'empty': 'call' if empty['tag'] == 10 else 'field',
            'ownInstructions': len(rows) + 2 * len(ranges)}


def declaring_field(jar, owner, name, desc, strict=True):
    seen = 0
    while owner in jar.classes:
        seen += 1
        if seen > 128:
            raise Refusal('field-lookup-depth')
        hits = [f for f in jar.classes[owner].fields if (f.name, f.desc) == (name, desc)]
        if hits:
            return owner, hits[0].flags
        owner = jar.classes[owner].parent
    if strict:
        raise Refusal('field-lookup-missing')
    # Superclass declarations outside the jar and interface constants cannot be a checked field.
    return None, None


def field_sites(jar, fields, limit=4096):
    """Stream every class that names a possible owner and resolve field sites.

    The byte filter is sound: a field reference stores its field name and its
    symbolic owner, which is the declaring class or a subclass. Method handles
    to the fields are also returned.
    """
    wanted = {tuple(f) for f in fields}
    declared = {f[0] for f in wanted}
    # A reference can name any subclass of the declaring class as its owner.
    owners = set(declared)
    for name in jar.classes:
        current, depth = jar.classes[name].parent, 0
        while current in jar.classes and depth < 128:
            if current in declared:
                owners.add(name)
                break
            current, depth = jar.classes[current].parent, depth + 1
    field_names = {f[1].encode() for f in wanted}
    sites, handles, scanned = [], [], 0
    for name in sorted(jar.classes):
        jar.check()
        raw = jar.zip.read(name + '.class')
        if not any(n in raw for n in field_names) or not any(o.encode() in raw for o in owners):
            continue
        cls = parse(raw, True)
        scanned += 1
        for index, item in enumerate(cls.cp):
            if item and item[0] == 15:
                value = constant(cls, item[1][1])
                if value.get('tag') == 9 and value['owner'] in jar.classes:
                    key = declaring_field(jar, value['owner'], value['name'], value['descriptor'], False)[0]
                    if (key, value['name'], value['descriptor']) in wanted:
                        handles.append({'class': name, 'kind': item[1][0], 'field': list(value)})
        for method in cls.methods:
            rows = instructions(method.code)
            for i, row in enumerate(rows):
                if row[1] not in (178, 179, 180, 181):
                    continue
                value = ref(cls, row)
                if value['owner'] not in jar.classes:
                    continue
                owner = declaring_field(jar, value['owner'], value['name'], value['descriptor'], False)[0]
                key = owner, value['name'], value['descriptor']
                if key not in wanted:
                    continue
                if len(sites) >= limit:
                    raise Refusal('field-site-limit')
                stored = None
                if row[1] in (179, 181):
                    stored = stored_value(cls, rows, i)
                sites.append({'field': list(key), 'class': name, 'method': [method.name, method.desc],
                              'offset': row[0], 'opcode': row[1], 'stored': stored})
    return {'sites': sites, 'methodHandles': handles, 'scannedClasses': scanned}


def stored_value(cls, rows, index):
    """Classify the stored value from the instruction that produces it."""
    if not index:
        return {'kind': 'unclassified'}
    previous = rows[index - 1]
    if previous[1] == 1:
        return {'kind': 'null'}
    if previous[1] == 183:
        call = method_ref(cls, previous)
        news = [i for i in range(max(0, index - 8), index - 1)
                if rows[i][1] == 187 and rows[i + 1][1] == 89]
        if call[1] == '<init>' and news and ref(cls, rows[news[-1]]).get('value') == call[0] \
                and all(simple_argument(cls, r) for r in rows[news[-1] + 2:index - 1]):
            return {'kind': 'fresh', 'class': call[0], 'constructor': call[2]}
    return {'kind': 'unclassified'}


def simple_argument(cls, row):
    """Accept constants, loads, and no-argument int getters between new and init."""
    if row[1] in (*range(1, 18), *range(21, 46)):
        return True
    return row[1] in (182, 185) and method_ref(cls, row)[2] == '()I'


def storage_kinds(report, wanted_class, variants=None):
    """Require writers to store null or one exact fresh class.

    variants maps a writer site key to a separately traced stored value.
    """
    kinds, writers = set(), []
    for site in report['sites']:
        if site['opcode'] not in (179, 181):
            continue
        writers.append(site)
        value = (variants or {}).get((site['class'], *site['method'], site['offset']), site['stored'])
        if value['kind'] == 'null':
            kinds.add('null')
        elif value['kind'] == 'fresh' and value['class'] == wanted_class:
            kinds.add(wanted_class)
        else:
            raise Refusal('storage-writer-unclassified')
    if report['methodHandles']:
        raise Refusal('storage-method-handle')
    return sorted(kinds), writers


# JDK composition. Each body is acyclic unless a loop variable is declared.

class JdkReader:
    def __init__(self, roots):
        self.roots, self.cache = roots, {}

    def get(self, name):
        if name not in self.cache:
            for root in self.roots:
                path = root / (name + '.class')
                if path.exists():
                    self.cache[name] = parse(path.read_bytes(), True)
                    break
            else:
                raise Refusal('jdk-class-missing:' + name)
        return self.cache[name]


def jdk_body(reader, key, loop=None):
    cls = reader.get(key[0])
    hits = [m for m in cls.methods if (m.name, m.desc) == key[1:]]
    if len(hits) != 1 or hits[0].handlers:
        raise Refusal('jdk-method:' + '#'.join(key))
    rows = instructions(hits[0].code)
    for row in rows:
        if row[1] in (168, 169, 170, 171, 186, 194, 195, 201):
            raise Refusal('jdk-control:' + '#'.join(key))
        if row[1] in (*range(153, 168), 198, 199) and target(row) <= row[0] and loop is None:
            raise Refusal('jdk-back-edge:' + '#'.join(key))
    return cls, rows


def jdk_bound(reader, key, dispatch, loops=None, depth=0):
    """Sum instructions, calls, and allocations through an explicit dispatch table.

    The dispatch maps (caller, offset) or a call key to a JDK key, 'native',
    or 'excluded:<reason>'. An unknown call is a refusal.
    """
    if depth > 32:
        raise Refusal('jdk-depth')
    loops = loops or {}
    variable = loops.get(key)
    cls, rows = jdk_body(reader, key, variable)
    terms = {'1': len(rows)} if variable is None else {variable: len(rows), '1': len(rows)}
    result = {'instructions': dict(terms), 'calls': 0, 'natives': {}, 'allocations': 0,
              'failureAllocations': 0, 'excluded': []}
    for i, row in enumerate(rows):
        op = row[1]
        if op in (187, 188, 189, 197):
            name = ref(cls, row).get('value') if op in (187, 189, 197) else 'primitive-array'
            if name in EXCEPTIONS:
                result['failureAllocations'] += 1
            else:
                result['allocations'] += 1
        if op not in (182, 183, 184, 185):
            continue
        call = method_ref(cls, row)
        choice = dispatch.get((key, row[0]), dispatch.get(call))
        if call[0] in EXCEPTIONS and call[1] == '<init>':
            result['excluded'].append(['failure-path', list(call)])
            continue
        if choice is None:
            raise Refusal('jdk-dispatch:' + '#'.join(key) + '@' + str(row[0]) + ':' + '#'.join(call))
        if choice == 'native':
            result['natives'][call[1]] = result['natives'].get(call[1], 0) + 1
            continue
        if isinstance(choice, str) and choice.startswith('excluded:'):
            result['excluded'].append([choice[9:], list(call)])
            continue
        inner = jdk_bound(reader, tuple(choice), dispatch, loops, depth + 1)
        result['calls'] += 1 + inner['calls']
        for k, v in inner['instructions'].items():
            result['instructions'][k] = result['instructions'].get(k, 0) + v
        for k, v in inner['natives'].items():
            result['natives'][k] = result['natives'].get(k, 0) + v
        for k in ('allocations', 'failureAllocations'):
            result[k] += inner[k]
        result['excluded'].extend(inner['excluded'])
    return result


AL = 'java/util/ArrayList'
COMMON = {
    ('java/util/AbstractList', '<init>', '()V'): ('java/util/AbstractList', '<init>', '()V'),
    ('java/util/AbstractCollection', '<init>', '()V'): ('java/util/AbstractCollection', '<init>', '()V'),
    ('java/lang/Object', '<init>', '()V'): ('java/lang/Object', '<init>', '()V'),
    ('java/util/Objects', 'requireNonNull', '(Ljava/lang/Object;)Ljava/lang/Object;'):
        ('java/util/Objects', 'requireNonNull', '(Ljava/lang/Object;)Ljava/lang/Object;'),
    ('java/lang/Math', 'max', '(II)I'): ('java/lang/Math', 'max', '(II)I'),
    ('java/lang/Math', 'min', '(II)I'): ('java/lang/Math', 'min', '(II)I'),
    (AL, 'grow', '()[Ljava/lang/Object;'): (AL, 'grow', '()[Ljava/lang/Object;'),
    (AL, 'grow', '(I)[Ljava/lang/Object;'): (AL, 'grow', '(I)[Ljava/lang/Object;'),
    (AL, 'add', '(Ljava/lang/Object;[Ljava/lang/Object;I)V'): (AL, 'add', '(Ljava/lang/Object;[Ljava/lang/Object;I)V'),
    ('jdk/internal/util/ArraysSupport', 'newLength', '(III)I'): ('jdk/internal/util/ArraysSupport', 'newLength', '(III)I'),
    ('jdk/internal/util/ArraysSupport', 'hugeLength', '(II)I'): 'excluded:size-below-soft-maximum',
    ('java/util/Arrays', 'copyOf', '([Ljava/lang/Object;I)[Ljava/lang/Object;'):
        ('java/util/Arrays', 'copyOf', '([Ljava/lang/Object;I)[Ljava/lang/Object;'),
    ('java/util/Arrays', 'copyOf', '([Ljava/lang/Object;ILjava/lang/Class;)[Ljava/lang/Object;'):
        ('java/util/Arrays', 'copyOf', '([Ljava/lang/Object;ILjava/lang/Class;)[Ljava/lang/Object;'),
    ('java/lang/Object', 'getClass', '()Ljava/lang/Class;'): 'native',
    ('java/util/List', 'getClass', '()Ljava/lang/Class;'): 'native',
    ('java/lang/System', 'arraycopy', '(Ljava/lang/Object;ILjava/lang/Object;II)V'): 'native',
    ('java/lang/Class', 'getComponentType', '()Ljava/lang/Class;'): 'excluded:exact-object-array',
    ('java/lang/reflect/Array', 'newInstance', '(Ljava/lang/Class;I)Ljava/lang/Object;'): 'excluded:exact-object-array',
}
UNMOD = 'java/util/Collections$UnmodifiableRandomAccessList'


def scenarios():
    """Return named roots with exact receiver dispatch for each storage form."""
    to_array = ('java/util/Collection', 'toArray', '()[Ljava/lang/Object;')
    add_all = (AL, 'addAll', '(Ljava/util/Collection;)Z')
    unmod_view = {
        ('java/util/Collections$UnmodifiableRandomAccessList', '<init>', '(Ljava/util/List;)V'):
            (UNMOD, '<init>', '(Ljava/util/List;)V'),
        ('java/util/Collections$UnmodifiableList', '<init>', '(Ljava/util/List;)V'):
            ('java/util/Collections$UnmodifiableList', '<init>', '(Ljava/util/List;)V'),
        ('java/util/Collections$UnmodifiableCollection', '<init>', '(Ljava/util/Collection;)V'):
            ('java/util/Collections$UnmodifiableCollection', '<init>', '(Ljava/util/Collection;)V')}
    return {
        'outputFrame': ([(AL, '<init>', '()V')], {}),
        'propertyArray': ([('java/util/Arrays', 'asList', '([Ljava/lang/Object;)Ljava/util/List;'),
                           ('java/util/Arrays$ArrayList', 'iterator', '()Ljava/util/Iterator;')],
                          {('java/util/Arrays$ArrayList', '<init>', '([Ljava/lang/Object;)V'):
                           ('java/util/Arrays$ArrayList', '<init>', '([Ljava/lang/Object;)V'),
                           ('java/util/Arrays$ArrayItr', '<init>', '([Ljava/lang/Object;)V'):
                           ('java/util/Arrays$ArrayItr', '<init>', '([Ljava/lang/Object;)V')}),
        'propertyHasNext': ([('java/util/Arrays$ArrayItr', 'hasNext', '()Z')], {}),
        'propertyNext': ([('java/util/Arrays$ArrayItr', 'next', '()Ljava/lang/Object;')], {}),
        'emptyPropertyArray': ([('java/util/Collections$EmptyList', 'iterator', '()Ljava/util/Iterator;'),
                                ('java/util/Collections$EmptyIterator', 'hasNext', '()Z')],
                               {('java/util/Collections', 'emptyIterator', '()Ljava/util/Iterator;'):
                                ('java/util/Collections', 'emptyIterator', '()Ljava/util/Iterator;')}),
        'singleAdd': ([(AL, 'add', '(Ljava/lang/Object;)Z')], {}),
        'listView': ([('java/util/Collections', 'unmodifiableList', '(Ljava/util/List;)Ljava/util/List;'),
                      add_all],
                     {**unmod_view, ((AL, 'addAll', '(Ljava/util/Collection;)Z'), 1):
                      ('java/util/Collections$UnmodifiableCollection', 'toArray', '()[Ljava/lang/Object;'),
                      (('java/util/Collections$UnmodifiableCollection', 'toArray', '()[Ljava/lang/Object;'), 1):
                      (AL, 'toArray', '()[Ljava/lang/Object;')}),
        'emptyList': ([('java/util/Collections', 'emptyList', '()Ljava/util/List;'), add_all],
                      {((AL, 'addAll', '(Ljava/util/Collection;)Z'), 1):
                       ('java/util/Collections$EmptyList', 'toArray', '()[Ljava/lang/Object;')}),
        'mapValues': ([('java/util/LinkedHashMap', 'values', '()Ljava/util/Collection;'), add_all],
                      {('java/util/LinkedHashMap', 'sequencedValues', '()Ljava/util/SequencedCollection;'):
                       ('java/util/LinkedHashMap', 'sequencedValues', '()Ljava/util/SequencedCollection;'),
                       ('java/util/LinkedHashMap$LinkedValues', '<init>', '(Ljava/util/LinkedHashMap;Z)V'):
                       ('java/util/LinkedHashMap$LinkedValues', '<init>', '(Ljava/util/LinkedHashMap;Z)V'),
                       ((AL, 'addAll', '(Ljava/util/Collection;)Z'), 1):
                       ('java/util/LinkedHashMap$LinkedValues', 'toArray', '()[Ljava/lang/Object;'),
                       ('java/util/LinkedHashMap', 'valuesToArray', '([Ljava/lang/Object;Z)[Ljava/lang/Object;'):
                       ('java/util/LinkedHashMap', 'valuesToArray', '([Ljava/lang/Object;Z)[Ljava/lang/Object;')}),
        'callerIterator': ([(AL, 'iterator', '()Ljava/util/Iterator;')],
                           {(AL + '$Itr', '<init>', '(Ljava/util/ArrayList;)V'):
                            (AL + '$Itr', '<init>', '(Ljava/util/ArrayList;)V')}),
        'callerHasNext': ([(AL + '$Itr', 'hasNext', '()Z')], {}),
        'callerNext': ([(AL + '$Itr', 'next', '()Ljava/lang/Object;')],
                       {(AL + '$Itr', 'checkForComodification', '()V'):
                        (AL + '$Itr', 'checkForComodification', '()V')}),
    }, to_array


def jdk_bounds(reader):
    loops = {('java/util/LinkedHashMap', 'valuesToArray', '([Ljava/lang/Object;Z)[Ljava/lang/Object;'): 'm'}
    table, _ = scenarios()
    result = {}
    for name, (roots, extra) in table.items():
        dispatch = {**COMMON, **{k: v for k, v in extra.items()}}
        # Offsets in caller keys are interface call sites. Resolve them by body.
        resolved = {}
        for k, v in dispatch.items():
            if isinstance(k[0], tuple):
                _, rows = jdk_body(reader, k[0])
                sites = [r[0] for r in rows if r[1] == 185]
                if not 1 <= k[1] <= len(sites):
                    raise Refusal('jdk-site-index')
                resolved[(k[0], sites[k[1] - 1])] = v
            else:
                resolved[k] = v
        total = {'instructions': {}, 'calls': 0, 'natives': {}, 'allocations': 0,
                 'failureAllocations': 0, 'excluded': []}
        for root in roots:
            part = jdk_bound(reader, root, resolved, loops)
            total['calls'] += 1 + part['calls']
            for k, v in part['instructions'].items():
                total['instructions'][k] = total['instructions'].get(k, 0) + v
            for k, v in part['natives'].items():
                total['natives'][k] = total['natives'].get(k, 0) + v
            for k in ('allocations', 'failureAllocations'):
                total[k] += part[k]
            total['excluded'].extend(part['excluded'])
        result[name] = total
    return result


def descriptor_singleton(jar, code, runtime, getter):
    """Resolve the descriptor getter on an exact class to one static singleton."""
    cls, method = lookup(jar, code, runtime, getter[1], getter[2])
    rows, cost, calls = instructions(method.code), 0, 0
    if [r[1] for r in rows] == [42, 182, 176] and not method.handlers:
        bridge = method_ref(cls, rows[1])
        if not bridge[2].startswith('()L') or bridge[1] == getter[1] and bridge[2] == getter[2]:
            raise Refusal('descriptor-bridge')
        cost, calls = 3, 1
        cls, method = lookup(jar, code, runtime, bridge[1], bridge[2])
        rows = instructions(method.code)
    if [r[1] for r in rows] != [178, 176] or method.handlers or method.flags & 8:
        raise Refusal('descriptor-getter-body')
    field = ref(cls, rows[0])
    owner = field['owner']
    if field['descriptor'] != 'L' + owner + ';':
        raise Refusal('descriptor-field-type')
    holder = code.get(jar, owner)
    declared = [f for f in holder.fields if (f.name, f.desc) == (field['name'], field['descriptor'])]
    if len(declared) != 1 or declared[0].flags & 24 != 24:
        raise Refusal('descriptor-field-static-final')
    # A static final field can be set only by the class initializer of its owner.
    init = [m for m in holder.methods if m.name == '<clinit>']
    stores = [(i, r) for i, r in enumerate(instructions(init[0].code)) if r[1] == 179
              and ref(holder, r) == field] if init else []
    if len(stores) != 1:
        raise Refusal('descriptor-singleton-store')
    raw = instructions(init[0].code)
    value = stored_value(holder, raw, stores[0][0])
    if value != {'kind': 'fresh', 'class': owner, 'constructor': '()V'}:
        raise Refusal('descriptor-singleton-value')
    return {'runtime': runtime, 'descriptor': owner, 'field': [owner, field['name'], field['descriptor']],
            'getter': [cls.name, method.name, method.desc],
            'ownInstructions': cost + 2, 'vendorCalls': calls + 1}


def property_kind(jar, code, prop, enum, names):
    """Read the relationship kind from the builder or its forwarded constructor."""
    cls = code.get(jar, prop['target'][0])
    method = [m for m in cls.methods if (m.name, m.desc) == tuple(prop['target'][1:])]
    if len(method) != 1:
        raise Refusal('kind-builder')
    rows = instructions(method[0].code)
    found = [ref(cls, r)['name'] for r in rows if r[1] == 178 and ref(cls, r).get('owner') == enum]
    source = 'builder'
    if not found:
        inits = {method_ref(cls, r) for r in rows if r[1] == 183
                 and method_ref(cls, r)[:2] == (prop['targetClass'], '<init>')}
        if len(inits) != 1:
            raise Refusal('kind-constructor-count')
        owner, constructor = lookup(jar, code, *inits.pop())
        found = [ref(owner, r)['name'] for r in instructions(constructor.code)
                 if r[1] == 178 and ref(owner, r).get('owner') == enum]
        source = 'constructor'
    if len(found) != 1 or found[0] not in names:
        raise Refusal('kind-count')
    return names[found[0]], source


def receiver_inventory(jar, code, runtime, row, collector, kind, relationships, paths):
    """Count strong owned properties for one exact receiver and find storage."""
    inventory = {'runtime': runtime, 'className': row['name'], 'classId': row['id'],
                 'single': 0, 'list': 0, 'map': 0, 'strong': [], 'weakOrShared': 0,
                 'listStorage': [], 'mapStorage': []}
    for prop in row['properties']:
        if prop['targetClass'] not in relationships:
            continue
        value, source = property_kind(jar, code, prop, kind['kindEnum'], kind['enumNames'])
        if value != 'STRONG':
            inventory['weakOrShared'] += 1
            continue
        form = relationships[prop['targetClass']]['form']
        inventory[form] += 1
        path = paths.get((row['name'], prop['id']))
        if path is None or path['error'] or not path['normalCollectorBound']:
            raise Refusal('inventory-missing-path')
        entry = {'name': prop['name'], 'id': prop['id'], 'class': prop['targetClass'], 'form': form,
                 'kindSource': source,
                 'vendorInstructions': path['normalCollectorBound']['vendorInstructions'],
                 'vendorCalls': path['normalCollectorBound']['vendorCalls']}
        if form in ('list', 'map'):
            wanted = 'Ljava/util/List;' if form == 'list' else 'Ljava/util/Map;'
            fields = set()
            for owner, name, desc in path['methods']:
                cls = code.get(jar, owner)
                method = [m for m in cls.methods if (m.name, m.desc) == (name, desc)][0]
                for r in instructions(method.code):
                    if r[1] == 180 and ref(cls, r)['descriptor'] == wanted:
                        v = ref(cls, r)
                        fields.add(declaring_field(jar, v['owner'], v['name'], v['descriptor'])[0:1] + (v['name'], v['descriptor']))
            if len(fields) != 1:
                raise Refusal('inventory-storage-field')
            entry['storage'] = list(fields.pop())
            inventory[form + 'Storage'].append(entry['storage'])
        inventory['strong'].append(entry)
    return inventory


def collector_formula(inventory, jdk, descriptor_cost, collector, empty):
    """Combine one exact class inventory into per-call bounds.

    S, L, and X count strong single, list, and map properties. K is the
    returned child count; map entries are part of K. The coefficients are
    upper bounds under the module conditions.
    """
    S, L, X = (inventory[k] for k in ('single', 'list', 'map'))
    P = S + L + X
    own = collector['ownInstructions']
    i = lambda name: jdk[name]['instructions'].get('1', 0)
    vendor = (own['constant'] + own['perProperty'] * P + descriptor_cost['ownInstructions'] + 7
              + sum(p['vendorInstructions'] for p in inventory['strong']))
    jdk_const = (i('outputFrame') + (i('propertyArray') if P else i('emptyPropertyArray'))
                 + i('propertyHasNext') * (P + 1) + i('propertyNext') * P + i('singleAdd') * S
                 + max(i('listView'), i(empty)) * L + i('mapValues') * X)
    calls = (collector['vendorCalls']['constant'] + descriptor_cost['vendorCalls']
             + sum(p['vendorCalls'] for p in inventory['strong']))
    jdk_calls = (jdk['outputFrame']['calls'] + jdk['propertyArray']['calls'] + jdk['propertyHasNext']['calls'] * (P + 1)
                 + jdk['propertyNext']['calls'] * P + jdk['singleAdd']['calls'] * S
                 + max(jdk['listView']['calls'], jdk[empty]['calls']) * L + jdk['mapValues']['calls'] * X)
    alloc = (jdk['outputFrame']['allocations'] + jdk['propertyArray']['allocations']
             + jdk['singleAdd']['allocations'] * S
             + max(jdk['listView']['allocations'], jdk[empty]['allocations']) * L
             + jdk['mapValues']['allocations'] * X)
    natives = {}
    for name, count in (('singleAdd', S), ('listView', L), ('mapValues', X), ('propertyArray', 1)):
        for k, v in jdk[name]['natives'].items():
            natives[k] = natives.get(k, 0) + v * count
    return {'runtime': inventory['runtime'], 'className': inventory['className'],
            'P': P, 'S': S, 'L': L, 'X': X,
            'vendorInstructions': vendor, 'vendorCalls': calls,
            'jdkInstructions': {'constant': jdk_const,
                                'perChild': jdk['mapValues']['instructions'].get('m', 0) if X else 0},
            'jdkCalls': jdk_calls, 'allocations': alloc, 'nativeCalls': natives,
            'arrayCopySlots': {'perChild': 2 + P}, 'boundedAdmission': False}


def null_key_callers(cls, methods, collector):
    """Require each caller to pass a null key constant to the collector."""
    result = []
    for method in methods:
        rows = instructions(method.code)
        sites = [i for i, r in enumerate(rows) if r[1] == 182 and method_ref(cls, r) == tuple(collector)]
        if len(sites) != 1 or sites[0] < 2 or [r[1] for r in rows[sites[0] - 2:sites[0]]] != [42, 1]:
            raise Refusal('collector-null-key-caller')
        result.append([cls.name, method.name, method.desc])
    return result


def serialized_single_managed(root, kinds, managed, limit=4096):
    """Check the serialized strong graph. This is not a runtime ownership proof.

    kinds maps (classId, propertyId) to WEAK, SHARED, or STRONG. managed maps
    classId to the exact-class managed predicate value.
    """
    nodes, edges = [], []

    def visit(obj, depth):
        if depth > 64 or len(nodes) >= limit:
            raise Refusal('serialized-limit')
        source = len(nodes) + 1
        nodes.append(obj['classId'])
        for prop in obj['properties']:
            values = prop['value'] if isinstance(prop['value'], list) else [prop['value']]
            for value in values:
                if not isinstance(value, dict):
                    continue
                if 'classId' in value:
                    target = visit(value, depth + 1)
                elif 'reference' in value:
                    target = value['reference']
                else:
                    continue
                kind = kinds.get((obj['classId'], prop['id']))
                if kind is None:
                    raise Refusal('serialized-kind-missing:%s:%s' % (obj['classId'], prop['id']))
                edges.append((source, target, prop['id'], kind))
        return source

    visit(root, 0)
    if any(not 1 <= t <= len(nodes) for _, t, _, _ in edges):
        raise Refusal('serialized-reference')
    parents = {}
    for source, target, _, kind in edges:
        if kind == 'STRONG':
            if target in parents:
                raise Refusal('serialized-second-strong-parent')
            parents[target] = source
    if 1 in parents or len(parents) != len(nodes) - 1:
        raise Refusal('serialized-strong-root')
    depth = 0
    for node in range(2, len(nodes) + 1):
        seen, current = set(), node
        while current != 1:
            if current in seen:
                raise Refusal('serialized-strong-cycle')
            seen.add(current)
            current = parents[current]
        depth = max(depth, len(seen))
    unknown = sorted({c for c in nodes if c not in managed})
    if unknown:
        raise Refusal('serialized-managed-unknown:%s' % unknown)
    managed_nodes = [i + 1 for i, c in enumerate(nodes) if managed[c]]
    counts = {}
    for _, _, _, kind in edges:
        counts[kind] = counts.get(kind, 0) + 1
    return {'nodes': len(nodes), 'edges': len(edges), 'kindCounts': counts,
            'strongDepth': depth, 'managedNodes': managed_nodes,
            'managedClassIds': sorted({nodes[i - 1] for i in managed_nodes}),
            'rootClassId': nodes[0], 'singleManaged': len(managed_nodes) <= 1,
            'rootOnlyManagedR': len(nodes) - 1 if managed_nodes == [1] else None,
            'boundedAdmission': False, 'runtimeObserved': False,
            'conditions': ['The serialized file is the bundled Amplify module data only.',
                           'Initialization, default children, migrations, and clones can add objects.',
                           'The exact runtime classes and the managed predicate must be checked at runtime.']}


def invocation_sites(jar, name, desc, limit=256, handles=None):
    """Stream the jar for every invoke of one name and descriptor, any owner.

    A method handle with the same name and descriptor is a refusal unless the
    caller supplies a list to collect it for an owner-specific check.
    """
    sites = []
    needle_name, needle_desc = name.encode(), desc.encode()
    for owner in sorted(jar.classes):
        jar.check()
        raw = jar.zip.read(owner + '.class')
        if needle_name not in raw or needle_desc not in raw:
            continue
        cls = parse(raw, True)
        for method in cls.methods:
            rows = instructions(method.code)
            for i, row in enumerate(rows):
                if 182 <= row[1] <= 185 and method_ref(cls, row)[1:] == (name, desc):
                    if len(sites) >= limit:
                        raise Refusal('invocation-site-limit')
                    sites.append((cls, method, rows, i))
        found = [constant(cls, item[1][1]) for item in cls.cp if item and item[0] == 15
                 and constant(cls, item[1][1]).get('name') == name
                 and constant(cls, item[1][1]).get('descriptor') == desc]
        if found and handles is None:
            raise Refusal('invocation-method-handle')
        if found:
            handles.extend([cls.name, f['owner']] for f in found)
    return sites


def fresh_local(cls, rows, slot):
    """Require every store to a local slot to take a fresh exact ArrayList."""
    stores = [i for i, r in enumerate(rows) if (r[1] == 58 and r[2][0] == slot) or r[1] == 75 + slot]
    if not stores:
        raise Refusal('fresh-local-missing')
    for i in stores:
        value = stored_value(cls, rows, i)
        if value.get('class') != 'java/util/ArrayList' or value['kind'] != 'fresh':
            raise Refusal('fresh-local-value')
    return len(stores)


def load_slot(row):
    if row[1] == 25:
        return row[2][0]
    if 42 <= row[1] <= 45:
        return row[1] - 42
    raise Refusal('parameter-store-argument')


def list_store_index(jar, limit=200000):
    """Index every invoke of a (..., int, List) void method in one streamed pass."""
    index, count, suffix = {}, 0, b'ILjava/util/List;)V'
    for owner in sorted(jar.classes):
        jar.check()
        raw = jar.zip.read(owner + '.class')
        if suffix not in raw:
            continue
        cls = parse(raw, True)
        for item in cls.cp:
            if item and item[0] == 15:
                value = constant(cls, item[1][1])
                if value.get('descriptor', '').endswith(suffix.decode()):
                    index.setdefault(('handle', value['name'], value['descriptor']), []).append(cls.name)
        for method in cls.methods:
            rows = instructions(method.code)
            shape = tuple(r[1] for r in rows) if len(rows) <= 8 else None
            for i, row in enumerate(rows):
                if 182 <= row[1] <= 185:
                    call = method_ref(cls, row)
                    if call[2].endswith(suffix.decode()):
                        count += 1
                        if count > limit:
                            raise Refusal('list-store-index-limit')
                        index.setdefault(call[1:], []).append(
                            (cls.name, method.name, method.desc, method.flags, shape, row[1],
                             tuple(r[1] for r in rows[max(0, i - 4):i])))
    return index


def parameter_list_store(jar, code, site, relationship_list):
    """Trace a descriptor store of a caller list to its only fresh-list callers.

    This is a narrow variant for typed descriptor stores of the form
    aload_1; aload_3; putfield. It refuses any other caller shape.
    """
    cls = code.get(jar, site['class'])
    method = [m for m in cls.methods if [m.name, m.desc] == site['method']][0]
    rows = instructions(method.code)
    index = [i for i, r in enumerate(rows) if r[0] == site['offset']][0]
    if [r[1] for r in rows[index - 2:index]] != [43, 45] or not method.desc.endswith('ILjava/util/List;)V'):
        raise Refusal('parameter-store-shape')
    index = list_store_index(jar)
    entries, todo, seen = set(), [(method.name, method.desc)], set()
    while todo:
        key = todo.pop()
        if key in seen:
            continue
        seen.add(key)
        if len(seen) > 4096:
            raise Refusal('parameter-store-forward-limit')
        for owner, name, desc, flags, shape, op, before in index.get(key, ()):
            if flags & 0x1000 and shape == (42, 43, 192, 28, 45, 182, 177):
                todo.append((name, desc))  # A synthetic bridge casts and forwards.
            elif op == 183 and desc.endswith('ILjava/util/List;)V') and before == (42, 43, 28, 45):
                todo.append((name, desc))  # An override forwards to its parent store.
            elif op == 182:
                entries.add((owner, name, desc))
            else:
                raise Refusal('parameter-store-caller')
    if any(('handle', *key) in index for key in seen):
        raise Refusal('parameter-store-method-handle')
    if len(entries) != 1 or next(iter(entries))[0] != relationship_list:
        raise Refusal('parameter-store-entry')
    entry = entries.pop()
    holders = set()
    for owner, caller, crow, i in invocation_sites(jar, entry[1], entry[2]):
        if owner.name != relationship_list or [r[1] for r in crow[:3]] != [42, 43, 44]:
            raise Refusal('parameter-store-holder')
        holders.add((owner.name, caller.name, caller.desc))
    if len(holders) != 1:
        raise Refusal('parameter-store-holder-count')
    holder = holders.pop()
    origins = []
    for owner, caller, crow, i in invocation_sites(jar, holder[1], holder[2]):
        slot = load_slot(crow[i - 1])
        stores = fresh_local(owner, crow, slot)
        origins.append([owner.name, caller.name, caller.desc, crow[i][0], slot, stores])
    if not origins:
        raise Refusal('parameter-store-origin')
    return {'kind': 'fresh', 'class': 'java/util/ArrayList', 'variant': 'caller-list-store',
            'forwardKeys': sorted(map(list, seen)), 'entry': list(entry), 'holder': list(holder),
            'origins': origins,
            'conditions': ['No reflection, method handle, or native call reaches the store chain.',
                           'The fresh list is not exposed before the store.']}
