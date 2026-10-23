"""Check the history-helper contracts, mutation refusals, and growth formulas."""
import copy
import json
import math
from pathlib import Path
import unittest
import zipfile

from grid_symbols.scan import Class, Member, Refusal, instructions, parse
from .history_growth import (Binder, FORMULAS, OWN, PINNED, ROLES, canonical, capacity_bound,
                             check_bodies, document_scan, old_structure, path_cost, set_scan,
                             table_length)
from .ownership import bootstraps, constant
from .test_constructor_variants import pool

NEW = Path('/Applications/Bitwig Studio.app/Contents/Java/bitwig.jar')
OLD = Path('/Users/jonvuri/Bitwig Upgrade Backups/2026-10-21-pre-6.1/apps/'
           'Bitwig Studio 6.0.6.app/Contents/Java/bitwig.jar')
RENAMED_NEW = Path('/tmp/gn-9b6g-renamed-extra.jar')
RENAMED_OLD = Path('/tmp/gn-9b6g-old-renamed-extra.jar')
NEW_MAP = Path('/tmp/gn-9b6g-renamed-map.json')
OLD_MAP = Path('/tmp/gn-9b6g-old-renamed-map.json')


class Loader:
    """Read class bytes as data and keep parsed copies for local mutation."""

    def __init__(self, path):
        self.zip, self.cache = zipfile.ZipFile(path), {}

    def __call__(self, name):
        if name not in self.cache:
            raw = self.zip.read(name + '.class')
            cls = parse(raw, True)
            self.cache[name] = (cls, bootstraps(raw, cls))
        return self.cache[name]


def method(cls, name, desc):
    return next(m for m in cls.methods if m.name == name and m.desc == desc)


OBJECT = 'com/bitwig/ramona/core/oDc'


@unittest.skipUnless(NEW.exists(), 'the 6.1.4 jar is not present')
class RealJarTests(unittest.TestCase):
    def fresh(self):
        return Loader(NEW)

    def test_new_bodies_match_every_pin(self):
        result = check_bodies(self.fresh())
        self.assertEqual(set(result['targets']), set(PINNED))
        self.assertFalse(result['boundedAdmission'])
        self.assertEqual(result['runtimeClassesInitialized'], 0)

    @unittest.skipUnless(RENAMED_NEW.exists() and NEW_MAP.exists(), 'renamed fixture absent')
    def test_renamed_fixture_with_additions_matches(self):
        names = json.loads(NEW_MAP.read_text())
        result = check_bodies(Loader(RENAMED_NEW), lambda n: names.get(n, n),
                              lambda n: n if n.startswith('<') else 'r_' + n)
        self.assertEqual(set(result['targets']), set(PINNED))

    def test_changed_loop_branch_refuses(self):
        load = self.fresh()
        cls, _ = load('dgJ')
        body = method(cls, 'IwV', '(L%s;)Z' % OBJECT)
        raw = instructions(body.code)
        goto = [r for r in raw if r[1] == 167][-1]
        code = bytearray(body.code); code[goto[0] + 2] -= 1   # back edge now ends one byte early
        body.code = bytes(code)
        with self.assertRaisesRegex(Refusal, 'history-growth-(branch-target|body)'):
            check_bodies(load)

    def test_changed_constant_refuses(self):
        load = self.fresh()
        cls, _ = load('dgJ')
        body = method(cls, 'cfM', '(L%s;L%s;)Z' % (OBJECT, OBJECT))
        code = bytearray(body.code)
        at = next(r[0] for r in instructions(body.code) if r[1] == 4)
        code[at] = 3
        body.code = bytes(code)
        with self.assertRaisesRegex(Refusal, 'history-growth-body:helper.related'):
            check_bodies(load)

    def test_redirected_operation_edge_refuses(self):
        """Point the removal scan at the insertion delegate of the same helper."""
        load = self.fresh()
        cls, _ = load('dfI')
        body = method(cls, 'hUR', '(L%s;)V' % OBJECT)
        target = next(i for i, e in enumerate(cls.cp) if e and e[0] == 10
                      and constant(cls, i) == {'tag': 10, 'owner': 'dgJ', 'name': 'MRY',
                                               'descriptor': '(L%s;)V' % OBJECT})
        code = bytearray(body.code)
        at = next(r[0] for r in instructions(body.code) if r[1] == 182)
        code[at + 1:at + 3] = target.to_bytes(2, 'big')
        body.code = bytes(code)
        with self.assertRaisesRegex(Refusal, 'history-growth-body:document.removed'):
            check_bodies(load)

    def test_storage_flag_and_type_changes_refuse(self):
        for name, change in (('MRY', 'flags'), ('Z1C', 'desc')):
            load = self.fresh()
            owner = 'dgJ' if name == 'MRY' else 'dfI'
            cls, _ = load(owner)
            field = next(f for f in cls.fields if f.name == name)
            if change == 'flags':
                field.flags = 2
            else:
                field.desc = 'Ljava/util/Collection;'
            with self.subTest(name=name), self.assertRaisesRegex(Refusal, 'storage-field'):
                check_bodies(load)

    def test_changed_lambda_handle_refuses(self):
        load = self.fresh()
        _, boot = load('dgJ')
        boot[0]['arguments'][1] = copy.deepcopy(boot[0]['arguments'][1])
        boot[0]['arguments'][1]['target']['name'] = 'MRY'
        with self.assertRaisesRegex(Refusal, 'history-growth-(body|prune-bootstrap)'):
            check_bodies(load)

    def test_unrelated_members_do_not_change_the_result(self):
        load = self.fresh()
        cls, _ = load('dgJ')
        cls.fields.append(Member('field', 'unrelated', 'J', 2))
        cls.methods.append(Member('method', 'unrelated', '()V', 2, bytes([177])))
        self.assertEqual(set(check_bodies(load)['targets']), set(PINNED))

    def test_missing_and_duplicate_targets_refuse(self):
        load = self.fresh()
        cls, _ = load('dfI')
        body = method(cls, 'UNj', '(L%s;)V' % OBJECT)
        cls.methods.append(copy.deepcopy(body))
        with self.assertRaisesRegex(Refusal, 'method-count'):
            check_bodies(load)
        load = self.fresh()
        cls, _ = load('dfI')
        cls.methods.remove(method(cls, 'UNj', '(L%s;)V' % OBJECT))
        with self.assertRaisesRegex(Refusal, 'method-count'):
            check_bodies(load)


@unittest.skipUnless(OLD.exists(), 'the 6.0.6 jar is not present')
class OldJarTests(unittest.TestCase):
    def test_old_document_has_no_helper_storage(self):
        cls = parse(zipfile.ZipFile(OLD).read('cZl.class'), True)
        self.assertFalse(old_structure(cls)['structurePresent'])

    @unittest.skipUnless(RENAMED_OLD.exists() and OLD_MAP.exists(), 'renamed fixture absent')
    def test_renamed_old_document_has_no_helper_storage(self):
        name = json.loads(OLD_MAP.read_text())['cZl']
        cls = parse(zipfile.ZipFile(RENAMED_OLD).read(name + '.class'), True)
        self.assertFalse(old_structure(cls)['structurePresent'])

    def test_added_set_field_is_reported(self):
        cls = parse(zipfile.ZipFile(OLD).read('cZl.class'), True)
        cls.fields.append(Member('field', 'added', 'Ljava/util/Set;', 18))
        self.assertTrue(old_structure(cls)['structurePresent'])


def scan_fixture():
    """Build the exact opcode shape of the document removal scan."""
    cp, typ, ref = pool()
    field = ref(9, 'Doc', 'helpers', 'Ljava/util/List;')
    iterator = ref(11, 'java/util/List', 'iterator', '()Ljava/util/Iterator;')
    has_next = ref(11, 'java/util/Iterator', 'hasNext', '()Z')
    nxt = ref(11, 'java/util/Iterator', 'next', '()Ljava/lang/Object;')
    helper = typ('Helper')
    call = ref(10, 'Helper', 'removed', '(LObj;)V')
    body = bytes([42, 180, 0, field, 185, 0, iterator, 1, 0, 77,
                  44, 185, 0, has_next, 1, 0, 153, 0, 21,
                  44, 185, 0, nxt, 1, 0, 192, 0, helper, 78, 45, 43, 182, 0, call,
                  167, 255, 232, 177])
    m = Member('method', 'removed', '(LObj;)V', 2, body)
    return Class('Doc', 'java/lang/Object', (), 33, [Member('field', 'helpers', 'Ljava/util/List;', 18)],
                 [m], cp), m


def execute(cls, m, helpers):
    """Run the fixture with inert list and iterator stubs; count own instructions."""
    raw = instructions(m.code)
    at = {r[0]: i for i, r in enumerate(raw)}
    local, stack, pc, count, calls = {0: 'doc', 1: 'obj'}, [], 0, 0, []
    state = {'i': 0}
    while count < 100000:
        off, op, a = raw[at[pc]]
        nxt_pc = raw[at[pc] + 1][0] if at[pc] + 1 < len(raw) else None
        count += 1
        if op in (42, 43, 44, 45):
            stack.append(local[op - 42])
        elif op in (77, 78):
            local[op - 75] = stack.pop()
        elif op == 180:
            stack.pop(); stack.append('list')
        elif op in (182, 185):
            k = constant(cls, int.from_bytes(bytes(a[:2]), 'big'))
            if k['name'] == 'iterator':
                stack.pop(); stack.append('it')
            elif k['name'] == 'hasNext':
                stack.pop(); stack.append(int(state['i'] < helpers))
            elif k['name'] == 'next':
                stack.pop(); stack.append('h%d' % state['i']); state['i'] += 1
            else:
                arg = stack.pop(); calls.append((stack.pop(), arg))
        elif op == 192:
            pass
        elif op == 153:
            if stack.pop() == 0:
                pc = off + int.from_bytes(bytes(a), 'big', signed=True); continue
        elif op == 167:
            pc = off + int.from_bytes(bytes(a), 'big', signed=True); continue
        elif op == 177:
            return count, calls
        else:
            raise AssertionError('unknown inert opcode')
        pc = nxt_pc
    raise AssertionError('inert step limit')


class FormulaTests(unittest.TestCase):
    def test_scan_fixture_matches_own_formula(self):
        cls, m = scan_fixture()
        for helpers in range(0, 12):
            count, calls = execute(cls, m, helpers)
            self.assertEqual(count, path_cost('document.removed', helpers=helpers))
            self.assertEqual(len(calls), helpers)
        self.assertEqual(OWN['document.removed'], {'constant': 8, 'perHelper': 11})

    def test_canonical_binds_roles_and_refuses_unknown_types(self):
        cls, m = scan_fixture()
        tokens = canonical(cls, m, Binder({'Doc': 'document', 'Helper': 'helper', 'Obj': 'object'}), [])
        self.assertEqual(tokens['tokens'][-2], [167, 'to', 4])
        with self.assertRaisesRegex(Refusal, 'unbound-type:Helper'):
            canonical(cls, m, Binder({'Doc': 'document', 'Obj': 'object'}), [])

    def test_binder_keeps_labels_one_to_one(self):
        b = Binder({'A': 'helper'})
        self.assertEqual(b.member('A', 'x', '()V', 'helper.x')[1], 'helper.x')
        self.assertEqual(b.member('A', 'y', '()V')[1], 'm0')
        with self.assertRaisesRegex(Refusal, 'label-conflict'):
            b.member('A', 'y', '()V', 'helper.other')
        with self.assertRaisesRegex(Refusal, 'label-collision'):
            b.member('A', 'z', '()V', 'helper.x')

    def test_table_growth_matches_the_add_rule(self):
        self.assertEqual([table_length(e) for e in (10, 16, 25, 26, 49)], [16, 32, 64, 64, 128])
        n, fill, size = 32, 24, 0
        for adds in range(1, 600):
            old = size; size += 1
            if old >= fill:
                n = table_length(size + 1); fill = min(math.ceil(n * 0.75), n - 1)
            self.assertLessEqual(n, capacity_bound(16, size))
            if adds in (24, 25, 48, 49):
                self.assertEqual(n, {24: 32, 25: 64, 48: 64, 49: 128}[adds])
        with self.assertRaisesRegex(Refusal, 'table-limit'):
            table_length(1 << 30)

    def test_capacity_is_not_bounded_by_size(self):
        # After 60 adds and 59 iterator removals, one entry keeps a 128-slot table.
        self.assertEqual(capacity_bound(16, 60), 128)
        self.assertGreater(set_scan('helper.prune-none', 1, 128, 0)[0],
                           set_scan('helper.prune-none', 1, 32, 0)[0])

    def test_document_scans_are_constant_when_no_helper_is_retained(self):
        self.assertEqual(document_scan('document.removed', [], 64), (8, 35))
        self.assertEqual(document_scan('document.inserted', [], 64), (5, 6))
        self.assertEqual(document_scan('document.edit-match', [], 64), (5, 6))
        one = document_scan('document.removed', [(6, 32)], 2)
        self.assertEqual(one, (8 + 11 + 4 + 49 + 72 * 6 + 13 * 26 + 12 * 12, 35 + 46 + 18 + 48))
        self.assertEqual(document_scan('document.inserted', [(6, 32)], 2), (one[0] + 4, one[1] + 5))
        with self.assertRaisesRegex(Refusal, 'scan-input'):
            set_scan('helper.prune-none', 5, 4, 0)

    def test_formula_table_is_complete(self):
        self.assertEqual(set(FORMULAS), {'helper.match-absent', 'helper.prune-none', 'document.removed',
                                         'document.inserted', 'document.edit-match',
                                         'open-set.remove-absent'})
        self.assertEqual(len(ROLES), len(set(ROLES.values())))


if __name__ == '__main__':
    unittest.main()
