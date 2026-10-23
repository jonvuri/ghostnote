import unittest

from grid_symbols.scan import Refusal
from grid_doctor import factory_closure as fc


def field(name, desc='Z'):
    return {'tag': 9, 'owner': 'BgP', 'name': name, 'descriptor': desc}


def method(name, desc, owner='BgP'):
    return {'tag': 10, 'owner': owner, 'name': name, 'descriptor': desc}


ASSERT = field('MRY')


def rows(spec):
    out = []
    for item in spec:
        offset, op = item[0], item[1]
        row = {'offset': offset, 'op': op}
        if len(item) > 2:
            if isinstance(item[2], dict):
                row['c'] = item[2]
            else:
                row['t'] = item[2]
        out.append(row)
    return out


def bl_rows():
    """Inert copy of the traced bl_ guard structure up to the port loops."""
    return rows([
        (0, 42), (1, 182, method('Guv', '()I')), (4, 42), (5, 182, method('wYK', '()I')),
        (8, 96), (9, 158, 16), (12, 4), (13, 167, 17), (16, 3), (17, 60), (18, 27),
        (19, 154, 58), (22, 42), (23, 180, field('IwV', '[B')), (26, 199, 43),
        (29, 42), (30, 180, field('hUR')), (33, 153, 50), (36, 42),
        (37, 180, field('FzB', 'Ljava/lang/String;')), (40, 198, 50),
        (43, 42), (44, 3), (45, 3), (46, 3), (47, 182, method('cfM', '(ZZZ)V')),
        (50, 42), (51, 180, field('ERO', 'Lcom/bitwig/nitro/ESe;')), (54, 199, 58), (57, 177),
        (58, 178, ASSERT), (61, 154, 90), (64, 182, method('QzY', '()I')),
        (90, 42), (91, 182, method('Bpn', '()Ljava/util/List;')),
    ])


def pgx_rows():
    """Inert copy of the traced Pgx guard structure."""
    return rows([
        (0, 178, ASSERT), (3, 154, 32), (6, 42), (7, 180, field('dEI')),
        (32, 42), (33, 180, field('dEI')), (36, 153, 40), (39, 177),
        (40, 42), (41, 18, {'tag': 8, 'value': 'Nitro Atom'}), (43, 182, method('d_', '(Ljava/lang/String;)V')),
        (46, 42), (47, 182, method('BBT', '()Z')), (50, 153, 72),
        (53, 42), (54, 180, field('UNj')), (57, 154, 72),
        (60, 42), (61, 42), (62, 42), (63, 180, field('IwV', '[B')),
        (66, 182, method('hUR', '([B)Ljava/lang/String;')), (69, 181, field('Hnt', 'Ljava/lang/String;')),
        (72, 42), (73, 180, field('hUR')), (76, 154, 86),
        (79, 42), (80, 180, field('IwV', '[B')), (83, 198, 115),
        (86, 42), (87, 182, method('Guv', '()I')), (90, 42), (91, 182, method('wYK', '()I')),
        (94, 96), (95, 158, 102), (98, 4), (99, 167, 103), (102, 3), (103, 60), (104, 27),
        (105, 154, 115), (108, 42), (109, 3), (110, 3), (111, 3),
        (112, 182, method('cfM', '(ZZZ)V')),
        (115, 42), (116, 4), (117, 181, field('dEI')), (120, 177),
    ])


class GuardTests(unittest.TestCase):
    def test_traced_shape_passes_all_assignments(self):
        result = fc.nitro_compile_guards(bl_rows(), pgx_rows())
        self.assertEqual(result['assignments'], 128)
        self.assertFalse(result['boundedAdmission'])
        self.assertEqual(result['runtimeClassesInitialized'], 0)

    def test_nonempty_lists_skip_compile_and_build_ports(self):
        env = dict(S=True, I=True, H=True, F=True, D=False, U=False, ERO_AFTER=False, ERO=False)
        self.assertEqual(fc.evaluate(bl_rows(), env), ['ports'])
        self.assertEqual(fc.evaluate(pgx_rows(), env), ['put:dEI'])

    def test_empty_lists_with_code_compile_and_return_without_ports(self):
        env = dict(S=False, I=True, H=False, F=False, D=False, U=True, ERO_AFTER=False, ERO=False)
        self.assertEqual(fc.evaluate(bl_rows(), env), ['compile'])

    def test_changed_count_branch_is_refused(self):
        changed = bl_rows()
        changed[5]['op'] = 157
        with self.assertRaises(Refusal):
            fc.nitro_compile_guards(changed, pgx_rows())

    def test_missing_latch_store_is_refused(self):
        changed = [row for row in pgx_rows() if row['offset'] != 117]
        changed[-2:] = [{'offset': 116, 'op': 177}]
        with self.assertRaises(Refusal):
            fc.nitro_compile_guards(bl_rows(), changed)

    def test_unknown_call_and_assertion_form_are_refused(self):
        changed = bl_rows()
        changed[1]['c'] = method('Other', '()I')
        with self.assertRaises(Refusal):
            fc.nitro_compile_guards(changed, pgx_rows())
        changed = pgx_rows()
        changed[1]['op'] = 153
        with self.assertRaises(Refusal):
            fc.nitro_compile_guards(bl_rows(), changed)


class ListSetterTests(unittest.TestCase):
    def setter(self):
        return rows([(58, 28)]) + [{'offset': 59, 'op': 171, 'a': (57, 9972, 33, 15756, 41, 15757, 49)}] + rows([
            (92, 181, field('iHb', 'Ljava/util/List;')), (97, 167, 123),
            (100, 181, field('nVd', 'Ljava/util/List;')), (105, 167, 123),
            (108, 181, field('ucQ', 'Ljava/util/List;')), (113, 167, 123),
        ])

    def test_fields_match(self):
        result = fc.list_setter_fields(self.setter(), {9972: 'iHb', 15756: 'nVd', 15757: 'ucQ'})
        self.assertEqual(result['fields'][15756], 'nVd')

    def test_swapped_fields_are_refused(self):
        with self.assertRaises(Refusal):
            fc.list_setter_fields(self.setter(), {9972: 'iHb', 15756: 'ucQ', 15757: 'nVd'})

    def test_trace_rows_have_targets(self):
        trace = {'instructions': [{'offset': 10, 'opcode': 153, 'args': [255, 250]},
                                  {'offset': 13, 'opcode': 182, 'args': [0, 1],
                                   'constant': method('Guv', '()I')}]}
        converted = fc.rows_from_trace(trace)
        self.assertEqual(converted[0]['t'], 4)
        self.assertEqual(converted[1]['c']['name'], 'Guv')


if __name__ == '__main__':
    unittest.main()
