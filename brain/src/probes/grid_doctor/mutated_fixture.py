"""Change one required declaration in an inert test archive. Never load it."""
import struct
import zipfile
import time
from grid_symbols.scan import Reader, Refusal, parse, instructions, rss_bytes


def change_class(data, name, desc, change):
    cls = parse(data, True)
    reader = Reader(data)
    reader.take(8)
    count, index = reader.u2(), 1
    widths = {3: 4, 4: 4, 5: 8, 6: 8, 7: 2, 8: 2, 9: 4, 10: 4, 11: 4,
              12: 4, 15: 3, 16: 2, 17: 4, 18: 4, 19: 2, 20: 2}
    while index < count:
        tag = reader.u1()
        reader.take(reader.u2() if tag == 1 else widths[tag])
        index += 2 if tag in (5, 6) else 1
    header_end = reader.pos
    reader.take(6)
    reader.take(2 * reader.u2())

    def attrs():
        for _ in range(reader.u2()):
            reader.take(2)
            reader.take(reader.u4())

    for _ in range(reader.u2()):
        reader.take(6)
        attrs()
    method_count_offset = reader.pos
    methods, matched = [], 0
    for _ in range(reader.u2()):
        begin = reader.pos
        flags, ni, di = reader.u2(), reader.u2(), reader.u2()
        selected = (cls.cp[ni][1], cls.cp[di][1]) == (name, desc)
        code_offset = None
        for _ in range(reader.u2()):
            ai, size = reader.u2(), reader.u4()
            if cls.cp[ai][1] == 'Code':
                code_offset = reader.pos + 8
            reader.take(size)
        raw = bytearray(data[begin:reader.pos])
        if selected:
            matched += 1
            if change == 'missing':
                continue
            if change == 'duplicate':
                methods.append(bytes(raw))
            elif change == 'access':
                raw[0:2] = struct.pack('>H', flags ^ 16)
            elif change == 'signature':
                replacements = [i for i, cp in enumerate(cls.cp) if cp and cp[0] == 1 and cp[1] == '()V']
                if len(replacements) != 1 or desc == '()V':
                    raise Refusal('mutation-signature-input')
                raw[4:6] = struct.pack('>H', replacements[0])
            elif change == 'operation':
                selected_method = next(m for m in cls.methods if (m.name, m.desc) == (name, desc))
                loads = [offset for offset, op, _ in instructions(selected_method.code) if op == 42]
                if code_offset is None or not loads:
                    raise Refusal('mutation-operation-input')
                raw[code_offset - begin + loads[-1]] = 1
            elif change != 'parent-cycle':
                raise Refusal('mutation-kind')
        methods.append(bytes(raw))
    if matched != 1:
        raise Refusal('mutation-required-method-count')
    prefix = bytearray(data[:method_count_offset])
    if change == 'parent-cycle':
        prefix[header_end + 4:header_end + 6] = prefix[header_end + 2:header_end + 4]
    return bytes(prefix) + struct.pack('>H', len(methods)) + b''.join(methods) + data[reader.pos:]


def write_model(source, destination, owner, name, desc, change):
    if destination.exists():
        raise Refusal('mutation-output-exists')
    started = time.perf_counter()
    with zipfile.ZipFile(source) as archive, zipfile.ZipFile(destination, 'x', compression=zipfile.ZIP_DEFLATED) as output:
        entries = [item for item in archive.infolist() if item.filename.endswith('.class')]
        if len(entries) > 40000 or sum(item.file_size for item in entries) > 128 * 1024**2:
            raise Refusal('mutation-archive-limit')
        found = False
        for item in entries:
            if time.perf_counter() - started > 120 or rss_bytes() > 768 * 1024**2:
                raise Refusal('mutation-time-or-memory-limit')
            if item.file_size > 1024**2:
                raise Refusal('mutation-class-limit')
            data = archive.read(item)
            if item.filename == owner + '.class':
                data = change_class(data, name, desc, change)
                found = True
            output.writestr(item.filename, data)
        if not found:
            raise Refusal('mutation-owner-missing')
