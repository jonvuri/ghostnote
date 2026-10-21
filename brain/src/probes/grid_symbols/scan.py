"""Read bounded class metadata. Never load or initialize vendor classes."""
from collections import defaultdict
from dataclasses import dataclass, field
import hashlib
import json
import re
import resource
import struct
import sys
import time
import zipfile


class Refusal(ValueError):
    pass


def digest(value):
    return hashlib.sha256(json.dumps(value, separators=(',', ':'), sort_keys=True).encode()).hexdigest()


def rss_bytes():
    value = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return value if sys.platform == 'darwin' else value * 1024


@dataclass
class Limits:
    jar_bytes: int = 64 * 1024**2
    entries: int = 50000
    classes: int = 40000
    class_bytes: int = 1024**2
    total_bytes: int = 128 * 1024**2
    members: int = 1000000
    depth: int = 128
    code_classes: int = 256
    call_work: int = 4096
    call_depth: int = 2
    rss: int = 768 * 1024**2
    seconds: int = 120


class Reader:
    def __init__(self, data):
        self.data, self.pos = data, 0

    def take(self, count):
        if count < 0 or self.pos + count > len(self.data):
            raise Refusal('truncated-class')
        value = self.data[self.pos:self.pos + count]
        self.pos += count
        return value

    def u1(self):
        return self.take(1)[0]

    def u2(self):
        return struct.unpack('>H', self.take(2))[0]

    def u4(self):
        return struct.unpack('>I', self.take(4))[0]


@dataclass
class Member:
    kind: str
    name: str
    desc: str
    flags: int
    code: bytes = b''
    handlers: tuple = ()


@dataclass
class Class:
    name: str
    parent: str
    interfaces: tuple
    flags: int
    fields: list
    methods: list
    cp: list = field(default_factory=list)


def parse(data, with_code=False):
    r = Reader(data)
    if r.u4() != 0xcafebabe:
        raise Refusal('class-magic')
    r.take(4)
    count = r.u2()
    cp = [None] * count
    i = 1
    while i < count:
        tag = r.u1()
        if tag == 1:
            # Modified UTF-8 differs only for NUL and surrogate code units here.
            value = r.take(r.u2()).replace(b'\xc0\x80', b'\0').decode('utf-8', 'surrogatepass')
        elif tag in (3, 4):
            value = r.take(4).hex()
        elif tag in (5, 6):
            value = r.take(8).hex()
        elif tag in (7, 8, 16, 19, 20):
            value = r.u2()
        elif tag in (9, 10, 11, 12, 17, 18):
            value = (r.u2(), r.u2())
        elif tag == 15:
            value = (r.u1(), r.u2())
        else:
            raise Refusal(f'constant-tag:{tag}')
        cp[i] = (tag, value)
        i += 2 if tag in (5, 6) else 1

    def utf(index):
        if cp[index][0] != 1:
            raise Refusal('expected-utf')
        return cp[index][1]

    def cls(index):
        return utf(cp[index][1]) if index else ''

    flags, name, parent = r.u2(), cls(r.u2()), cls(r.u2())
    interfaces = tuple(cls(r.u2()) for _ in range(r.u2()))

    def attributes():
        return [(utf(r.u2()), r.take(r.u4())) for _ in range(r.u2())]

    def members(kind):
        result = []
        for _ in range(r.u2()):
            item = Member(kind, '', '', r.u2())
            item.name, item.desc = utf(r.u2()), utf(r.u2())
            for key, value in attributes():
                if key == 'Code' and with_code:
                    cr = Reader(value)
                    cr.take(4)
                    item.code = cr.take(cr.u4())
                    item.handlers = tuple((cr.u2(), cr.u2(), cr.u2(), cr.u2()) for _ in range(cr.u2()))
            result.append(item)
        return result

    fields, methods = members('field'), members('method')
    attributes()
    if r.pos != len(data):
        raise Refusal('class-trailing-data')
    return Class(name, parent, interfaces, flags, fields, methods, cp if with_code else [])


def descriptor(desc, type_key):
    return re.sub(r'L([^;]+);', lambda m: 'L' + type_key(m[1]) + ';', desc)


def method_kind(name):
    return name if name in ('<init>', '<clinit>') else 'method'


def class_shape(c, type_key):
    return [c.flags, type_key(c.parent), sorted(type_key(x) for x in c.interfaces),
            sorted((m.flags, descriptor(m.desc, type_key)) for m in c.fields),
            sorted((method_kind(m.name), m.flags, descriptor(m.desc, type_key)) for m in c.methods)]


class Jar:
    def __init__(self, path, limits=None):
        self.zip = None
        try:
            self._read(path, limits)
        except Exception:
            if self.zip is not None:
                self.zip.close()
            raise

    def _read(self, path, limits):
        self.path, self.limits = path, limits or Limits()
        self.start = time.perf_counter()
        self.timings = {}
        self.classes = {}
        if path.stat().st_size > self.limits.jar_bytes:
            raise Refusal('jar-byte-limit')
        start = time.perf_counter()
        with path.open('rb') as source:
            self.sha256 = hashlib.file_digest(source, 'sha256').hexdigest()
        self.timings['fingerprintMs'] = (time.perf_counter() - start) * 1000
        start = time.perf_counter()
        self.zip = zipfile.ZipFile(path)
        entries = self.zip.infolist()
        self.check()
        if len(entries) > self.limits.entries:
            raise Refusal('entry-limit')
        names = [x.filename for x in entries]
        if len(set(names)) != len(names):
            raise Refusal('duplicate-jar-entry')
        classes = [x for x in entries if x.filename.endswith('.class')]
        if len(classes) > self.limits.classes:
            raise Refusal('class-count-limit')
        if sum(x.file_size for x in classes) > self.limits.total_bytes:
            raise Refusal('total-class-byte-limit')
        total = 0
        for entry in classes:
            self.check()
            if entry.file_size > self.limits.class_bytes:
                raise Refusal('class-byte-limit')
            c = parse(self.zip.read(entry))
            if entry.filename != c.name + '.class' or c.name in self.classes:
                raise Refusal('class-entry-identity')
            total += len(c.fields) + len(c.methods)
            if total > self.limits.members:
                raise Refusal('member-limit')
            self.classes[c.name] = c
        self.stats = {'jarBytes': path.stat().st_size, 'entries': len(entries),
                      'classes': len(classes), 'classBytes': sum(x.file_size for x in classes),
                      'members': total, 'defaultPackageClasses': sum('/' not in x for x in self.classes)}
        self.timings['enumerationMetadataMs'] = (time.perf_counter() - start) * 1000
        start = time.perf_counter()
        self.keys = structural_keys(self.classes, self.check)
        self.timings['typeRefinementMs'] = (time.perf_counter() - start) * 1000
        self.code_cache = {}

    def check(self):
        if time.perf_counter() - self.start > self.limits.seconds:
            raise Refusal('scan-deadline')
        if rss_bytes() > self.limits.rss:
            raise Refusal('scan-rss-limit')

    def code(self, name):
        self.check()
        if name not in self.code_cache:
            if len(self.code_cache) >= self.limits.code_classes:
                raise Refusal('code-class-limit')
            self.code_cache[name] = parse(self.zip.read(name + '.class'), True)
        return self.code_cache[name]

    def close(self):
        self.zip.close()
        self.code_cache.clear()


def structural_keys(classes, check=lambda: None):
    # All jar names are opaque. External library types retain their ABI names.
    def external(name):
        return 'vendor' if name in classes else name
    keys = {name: digest(class_shape(c, external)) for name, c in classes.items()}
    for _ in range(2):
        previous = keys
        keys = {}
        for name, c in classes.items():
            check()
            keys[name] = digest(class_shape(c, lambda n: previous.get(n, n)))
    return keys


def ancestors(classes, name, limit=128):
    seen = set()
    todo = [(name, ())]
    while todo:
        name, path = todo.pop()
        if name in path:
            raise Refusal('inheritance-cycle')
        if len(path) > limit:
            raise Refusal('inheritance-depth')
        if name in seen or name not in classes:
            continue
        seen.add(name)
        yield name
        c = classes[name]
        todo.extend((x, (*path,name)) for x in reversed((c.parent, *c.interfaces)) if x)


# JVM operand lengths. Switches and wide have variable lengths.
LENGTH = {**{x: 1 for x in (16,18,21,22,23,24,25,54,55,56,57,58,169,188)},
          **{x: 2 for x in (17,19,20,132,*range(153,169),*range(178,185),187,189,192,193,198,199)},
          185: 4, 186: 4, 197: 3, 200: 4, 201: 4}
CP_OPS = {18,19,20,*range(178,188),189,192,193,197}


def instructions(code):
    r = Reader(code)
    result = []
    while r.pos < len(code):
        pos, op = r.pos, r.u1()
        if op in (170,171):
            r.take((-r.pos) % 4)
            default = struct.unpack('>i', r.take(4))[0]
            if op == 170:
                low, high = struct.unpack('>ii', r.take(8))
                count = high - low + 1
                if count < 0 or count > len(code) // 4:
                    raise Refusal('switch-size')
                args = (default, low, high, *struct.unpack('>' + 'i' * count, r.take(4 * count)))
            else:
                count = r.u4()
                if count > len(code) // 8:
                    raise Refusal('switch-size')
                args = (default, *struct.unpack('>' + 'i' * count * 2, r.take(8 * count)))
        elif op == 196:
            sub = r.u1()
            args = (sub, *r.take(4 if sub == 132 else 2))
        elif op > 201:
            raise Refusal('unsupported-opcode')
        else:
            args = tuple(r.take(LENGTH.get(op, 0)))
        result.append((pos, op, args))
    return result


def member_traces(c, keys):
    """Use opcode order, typed references, literals, and field use contexts."""
    def type_key(name):
        if name.startswith('['):
            return descriptor(name, type_key)
        return keys.get(name, name)

    def cp_value(index):
        tag, value = c.cp[index]
        if tag == 1:
            # String content is not a name-independent semantic selector.
            return ['text']
        if tag in (3,4,5,6):
            return [tag, value]
        if tag == 7:
            return ['type', type_key(c.cp[value][1])]
        if tag == 8:
            return ['string']
        if tag in (9,10,11):
            owner, nt = value
            owner = c.cp[c.cp[owner][1]][1]
            ni, di = c.cp[nt][1]
            name, desc = c.cp[ni][1], c.cp[di][1]
            return [tag, type_key(owner), method_kind(name) if owner in keys else name,
                    descriptor(desc, type_key)]
        if tag == 15:
            return [tag, value[0], cp_value(value[1])]
        if tag == 16:
            return [tag, descriptor(c.cp[value][1], type_key)]
        if tag in (17,18):
            # Bootstrap table positions are not selectors.
            _, nt = value
            _, di = c.cp[nt][1]
            return [tag, descriptor(c.cp[di][1], type_key)]
        raise Refusal(f'unsupported-code-constant:{tag}')

    methods, uses, bodies = {}, defaultdict(list), {}
    for m in c.methods:
        raw = instructions(m.code)
        ordinal = {p: i for i, (p, _, _) in enumerate(raw)}
        ordinal[len(m.code)] = len(raw)
        tokens, refs = [], []
        for pos, op, args in raw:
            if op in CP_OPS:
                index = args[0] if op == 18 else args[0] * 256 + args[1]
                value = cp_value(index)
                tokens.append([op, value, list(args[1:] if op == 18 else args[2:])])
                if op in (178,179,180,181):
                    owner, nt = c.cp[index][1]
                    owner = c.cp[c.cp[owner][1]][1]
                    ni, di = c.cp[nt][1]
                    refs.append((len(tokens) - 1, (owner, c.cp[ni][1], c.cp[di][1])))
            elif op in (*range(153,169),198,199,200,201):
                delta = int.from_bytes(bytes(args), 'big', signed=True)
                tokens.append([op, ordinal[pos + delta] - ordinal[pos]])
            elif op == 170:
                default, low, high, *targets = args
                tokens.append([op, low, high, ordinal[pos + default],
                               [ordinal[pos + x] for x in targets]])
            elif op == 171:
                default, *pairs = args
                tokens.append([op, ordinal[pos + default],
                               [[pairs[i], ordinal[pos + pairs[i + 1]]] for i in range(0,len(pairs),2)]])
            else:
                tokens.append([op, list(args)])
        handlers = [[ordinal[a], ordinal[b], ordinal[d], cp_value(t) if t else 'all']
                    for a,b,d,t in m.handlers]
        shape = [m.flags, descriptor(m.desc, type_key), tokens, handlers]
        key = digest(shape)
        methods[(m.name, m.desc)] = key
        bodies[(m.name, m.desc)] = (shape, refs)
        for i, ref in refs:
            # The context is executable order, never class/member enumeration order.
            uses[ref].append(digest([key, tokens[max(0,i-3):i+4]]))
    fields = {(m.name, m.desc): digest([m.flags, descriptor(m.desc, type_key),
                sorted(uses.get((c.name, m.name, m.desc), []))]) for m in c.fields}
    for identity, (shape, refs) in bodies.items():
        local_uses = [(i, fields[(n, d)]) for i, (o, n, d) in refs
                      if o == c.name and (n, d) in fields]
        methods[identity] = digest([shape, local_uses])
    return methods, fields


def class_trace(c, keys):
    methods, fields = member_traces(c, keys)
    return digest([sorted(methods.values()), sorted(fields.values())])


class CallTraces:
    """Follow at most two call edges to distinguish same-shape wrappers."""
    def __init__(self, jar):
        self.jar = jar
        self.base = {}
        self.cache = {}
        self.work = 0

    def trace(self, owner, name, desc, depth=None, receiver=None):
        if depth is None:
            depth = self.jar.limits.call_depth
        identity = (owner,name,desc,depth,receiver)
        if identity in self.cache:
            return self.cache[identity]
        self.work += 1
        if self.work > self.jar.limits.call_work:
            raise Refusal('call-trace-work-limit')
        self.jar.check()
        found = []
        for ancestor in ancestors(self.jar.classes,owner,self.jar.limits.depth):
            c = self.jar.code(ancestor)
            found = [m for m in c.methods if m.name == name and m.desc == desc]
            if found:
                owner = ancestor
                break
        if not found:
            # Some vendor calls terminate at an external superclass.
            return 'external-or-absent'
        if len(found) != 1:
            raise Refusal('duplicate-call-target')
        m = found[0]
        if owner not in self.base:
            self.base[owner] = member_traces(c,self.jar.keys)[0]
        base = self.base[owner][(name,desc)]
        calls = []
        if depth:
            for _,op,args in instructions(m.code):
                if op not in (182,183,184,185):
                    continue
                index = args[0] * 256 + args[1]
                target, nt = c.cp[index][1]
                target = c.cp[c.cp[target][1]][1]
                ni,di = c.cp[nt][1]
                if target in self.jar.classes:
                    dispatch = target
                    if op in (182,185) and receiver and target in set(ancestors(self.jar.classes,receiver)):
                        dispatch = receiver
                    calls.append([op,self.trace(dispatch,c.cp[ni][1],c.cp[di][1],depth-1,receiver)])
        result = digest([base,calls])
        self.cache[identity] = result
        return result
