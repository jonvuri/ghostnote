"""Write an inert renamed jar for resolver tests. Never load its classes."""
import struct
import zipfile
import time

from grid_symbols.scan import Reader, Refusal, descriptor, parse, rss_bytes


def rename_member(name):
    return name if name.startswith('<') else 'r_' + name


def rename_class(data, names, extra=False):
    cls = parse(data, True)
    original, cp = cls.cp, list(cls.cp)
    utf_cache = {value: i for i, item in enumerate(cp) if item is not None
                 for tag, value in [item] if tag == 1}

    def utf(value):
        if value not in utf_cache:
            utf_cache[value] = len(cp)
            cp.append((1, value))
        return utf_cache[value]

    def desc(value):
        return descriptor(value, lambda name: names.get(name, name))

    for i, item in enumerate(original):
        if item is None:
            continue
        tag, value = item
        if tag == 7:
            name = original[value][1]
            cp[i] = (tag, utf(names.get(name, desc(name))))
        elif tag == 12:
            cp[i] = (tag, (value[0], utf(desc(original[value[1]][1]))))
        elif tag == 16:
            cp[i] = (tag, utf(desc(original[value][1])))
    for i, item in enumerate(original):
        if item is None or item[0] not in (9, 10, 11):
            continue
        tag, (owner, nt) = item
        owner_name = original[original[owner][1]][1]
        if owner_name in names:
            ni, di = original[nt][1]
            name, signature = utf(rename_member(original[ni][1])), utf(desc(original[di][1]))
            cp[i] = (tag, (owner, len(cp)))
            cp.append((12, (name, signature)))
    reader = Reader(data)
    header = reader.take(8)
    count = reader.u2()
    i = 1
    widths = {3: 4, 4: 4, 5: 8, 6: 8, 7: 2, 8: 2, 9: 4, 10: 4, 11: 4,
              12: 4, 15: 3, 16: 2, 17: 4, 18: 4, 19: 2, 20: 2}
    while i < count:
        tag = reader.u1()
        reader.take(reader.u2() if tag == 1 else widths[tag])
        i += 2 if tag in (5, 6) else 1
    prefix = reader.take(6)
    interface_count = reader.u2()
    interfaces = [reader.take(2) for _ in range(interface_count)]
    body = bytearray(prefix + struct.pack('>H', interface_count) + b''.join(reversed(interfaces)))

    def attributes():
        start = reader.pos
        for _ in range(reader.u2()):
            reader.take(2)
            reader.take(reader.u4())
        return data[start:reader.pos]

    for kind in ('field', 'method'):
        members = []
        for _ in range(reader.u2()):
            flags, name, signature = reader.u2(), reader.u2(), reader.u2()
            members.append(struct.pack('>HHH', flags, utf(rename_member(original[name][1])),
                                       utf(desc(original[signature][1]))) + attributes())
        if extra:
            if kind == 'field':
                members.append(struct.pack('>HHHH', 0x1002, utf('unrelated_extra'), utf('J'), 0))
            else:
                code = bytes([3, 87, 177])
                code_body = struct.pack('>HHI', 1, 1, len(code)) + code + struct.pack('>HH', 0, 0)
                members.append(struct.pack('>HHHHHI', 0x1002, utf('unrelated_extra'), utf('()V'),
                                           1, utf('Code'), len(code_body)) + code_body)
        body.extend(struct.pack('>H', len(members)) + b''.join(reversed(members)))
    body.extend(attributes())
    if reader.pos != len(data) or len(cp) > 65535:
        raise Refusal('renamed-fixture-class-bound')
    encoded = bytearray(header + struct.pack('>H', len(cp)))
    for item in cp[1:]:
        if item is None:
            continue
        tag, value = item
        encoded.append(tag)
        if tag == 1:
            raw = value.encode('utf-8', 'surrogatepass').replace(b'\0', b'\xc0\x80')
            encoded.extend(struct.pack('>H', len(raw)) + raw)
        elif tag in (3, 4, 5, 6):
            encoded.extend(bytes.fromhex(value))
        elif tag in (7, 8, 16, 19, 20):
            encoded.extend(struct.pack('>H', value))
        elif tag == 15:
            encoded.extend(struct.pack('>BH', *value))
        else:
            encoded.extend(struct.pack('>HH', *value))
    encoded.extend(body)
    return bytes(encoded)


def write_model(source, destination, extra=False):
    if destination.exists():
        raise Refusal('renamed-fixture-output-exists')
    started = time.perf_counter()
    with zipfile.ZipFile(source) as archive:
        entries = sorted((name for name in archive.namelist() if name.endswith('.class')), reverse=True)
        if len(entries) > 40000:
            raise Refusal('renamed-fixture-entry-limit')
        names = {name[:-6]: 'R' + str(i) for i, name in enumerate(entries)}
        with zipfile.ZipFile(destination, 'x', compression=zipfile.ZIP_DEFLATED) as output:
            total = 0
            for name in entries:
                if time.perf_counter() - started > 120 or rss_bytes() > 768 * 1024**2:
                    raise Refusal('renamed-fixture-time-or-memory-limit')
                raw = rename_class(archive.read(name), names, extra)
                total += len(raw)
                if len(raw) > 1024**2 or total > 128 * 1024**2:
                    raise Refusal('renamed-fixture-byte-limit')
                output.writestr(names[name[:-6]] + '.class', raw)
    return names
