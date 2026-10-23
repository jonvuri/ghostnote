"""Check listener-removal forms and refuse changes to their effects."""
import unittest
from grid_symbols.scan import Class, Member, Refusal
from grid_symbols.test_resolve import FakeJar
from .listener_removal import removal_contract
from .test_assertion_guards import fixture as assertion_fixture
from .test_descriptor_resolution import ModelCode


def fixture(single):
    cls = assertion_fixture()

    def utf(value):
        cls.cp.append((1, value)); return len(cls.cp) - 1

    def typ(value):
        index = utf(value); cls.cp.append((7, index)); return len(cls.cp) - 1

    def reference(tag, owner, name, desc):
        ci, ni, di = typ(owner), utf(name), utf(desc)
        cls.cp.append((12, (ni, di))); nt = len(cls.cp) - 1
        cls.cp.append((tag, (ci, nt))); return len(cls.cp) - 1

    desc = 'Ljava/lang/Object;' if single else 'Ljava/util/List;'
    field = reference(9, 'Owner', 'storage', desc)
    cls.fields.append(Member('field', 'storage', desc, 2))
    remove = reference(11, 'java/util/List', 'remove', '(Ljava/lang/Object;)Z')
    empty = reference(11, 'java/util/List', 'isEmpty', '()Z')
    list_type = typ('java/util/List')
    mode = reference(10, 'Mode', 'enabled', '()Z')
    recording = reference(10, 'Mode', 'record', '(Ljava/lang/Object;Ljava/lang/Object;)V')
    getter_field = reference(9, 'Mode', 'flag', 'Z')
    getter = Member('method', 'enabled', '()Z', 9,
                    bytes([178, getter_field >> 8, getter_field & 255, 172]))
    mode_cls = Class('Mode', 'java/lang/Object', (), 1,
                     [Member('field', 'flag', 'Z', 74)], [getter], cls.cp)
    body = [(178, 12), (154, 'body'), (1,), (191,), 'body']
    if single:
        body += [(184, mode), (153, 'storage'), (42,), (43,), (184, recording)]
    body += ['storage', (42,), (180, field), (199, 'nonnull'), (177,), 'nonnull']
    if single:
        body += [(42,), (180, field), (43,), (166, 'list'),
                 (42,), (1,), (181, field), (177,), 'list',
                 (42,), (180, field), (78,), (45,), (193, list_type), (153, 'end'),
                 (45,), (192, list_type), (77,), (44,), (43,), (185, remove, 2, 0),
                 (87,), (44,), (185, empty, 1, 0), (153, 'done'),
                 (42,), (1,), (181, field), 'done', (177,), 'end', (177,)]
    else:
        body += [(42,), (180, field), (43,), (185, remove, 2, 0), (87,), (177,)]
    labels, pc = {}, 0
    for row in body:
        if isinstance(row, str):labels[row] = pc
        else:pc += 5 if row[0] == 185 else 3 if len(row) > 1 else 1
    binary = bytearray()
    for row in body:
        if isinstance(row, str):continue
        pc = len(binary); binary.append(row[0])
        if len(row) > 1:
            arg = labels[row[1]] - pc if isinstance(row[1], str) else row[1]
            binary.extend(arg.to_bytes(2, 'big', signed=isinstance(row[1], str)))
            binary.extend(row[2:])
    method = Member('method', 'remove', '(LListener;)V', 1, bytes(binary))
    cls.methods.append(method)
    jar = FakeJar([cls, mode_cls])
    return jar, cls, method, mode_cls, labels


def run(data):
    jar, cls, method, _, _ = data
    return removal_contract(jar, ModelCode(), cls, method)


class ListenerRemovalTests(unittest.TestCase):
    def test_both_storage_forms_keep_conditions_and_costs(self):
        for single in (False, True):
            result = run(fixture(single))
            self.assertEqual(result['storageForm'], 'single-or-list' if single else 'list')
            self.assertEqual(result['ownInstructionBound'], 37 if single else 12)
            self.assertEqual(result['listIsEmptyCallBound'], int(single))
            self.assertEqual(result['explicitAllocations'], 0)
            self.assertFalse(result['boundedAdmission'])
            self.assertFalse(result['runtimeObserved'])
            if single:self.assertEqual(result['mode']['requiredFalseField'], ['Mode', 'flag', 'Z'])

    def test_foreign_storage_alias_refuses(self):
        data = fixture(True); cls = data[1]
        index = next(i for i, x in enumerate(cls.cp) if x == (1, 'storage'))
        cls.cp[index] = (1, 'missing')
        with self.assertRaisesRegex(Refusal, 'storage-field'):run(data)

    def test_wrong_branch_and_extra_effect_refuse(self):
        for extra in (False, True):
            data = fixture(True); method, labels = data[2], data[4]
            binary = bytearray(method.code)
            if extra:binary[-1:] = bytes([42, 177])
            else:
                pos = labels['nonnull'] + 5
                binary[pos + 1:pos + 3] = (3).to_bytes(2, 'big')
            method.code = bytes(binary)
            with self.assertRaises(Refusal):run(data)

    def test_list_operation_and_interface_count_refuse(self):
        data = fixture(False); cls = data[1]
        index = next(i for i, x in enumerate(cls.cp) if x == (1, 'remove'))
        cls.cp[index] = (1, 'contains')
        with self.assertRaisesRegex(Refusal, 'list-call'):run(data)
        data = fixture(False); binary = bytearray(data[2].code)
        pos = binary.index(185); binary[pos + 3] = 1; data[2].code = bytes(binary)
        with self.assertRaisesRegex(Refusal, 'interface-arguments'):run(data)

    def test_changed_mode_getter_and_field_refuse(self):
        for change in ('body', 'field', 'static'):
            data = fixture(True); cls = data[3]
            if change == 'body':cls.methods[0].code = bytes([3, 172])
            elif change == 'field':cls.fields[0].flags = 2
            else:cls.methods[0].flags = 1
            with self.subTest(change=change), self.assertRaisesRegex(Refusal, 'mode-'):run(data)

    def test_mode_branch_must_skip_only_recording(self):
        data = fixture(True); binary = bytearray(data[2].code); pos = data[4]['body'] + 3
        binary[pos + 1:pos + 3] = (3).to_bytes(2, 'big'); data[2].code = bytes(binary)
        with self.assertRaisesRegex(Refusal, 'mode-branch'):run(data)

    def test_method_handlers_and_missing_assertion_guard_refuse(self):
        for change in ('handlers', 'flags', 'guard', 'field'):
            data = fixture(False)
            if change == 'handlers':data[2].handlers = ((0, 3, 6, 0),)
            elif change == 'flags':data[2].flags = 9
            elif change == 'guard':data[1].methods.pop(0)
            else:data[1].fields[-1].flags = 18
            with self.subTest(change=change), self.assertRaises(Refusal):run(data)


if __name__ == '__main__':
    unittest.main()
