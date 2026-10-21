"""Resolve supplemental undo roles in the complete renamed inert jar model."""
import json
import os
from pathlib import Path
import unittest
import copy
from grid_symbols.scan import Jar, Refusal
from grid_symbols.resolve import resolve, validate
from grid_symbols.test_resolve import rename_model


@unittest.skipUnless(os.environ.get('GRID_SYMBOL_JAR'), 'Set GRID_SYMBOL_JAR for the metadata test.')
class DoctorIntegration(unittest.TestCase):
    def test_supplement_and_renamed_model(self):
        root = Path(__file__).resolve().parents[1]
        rules = json.loads((root / 'grid_symbols/selectors.json').read_text())
        rules['members'] += json.loads((root / 'grid_doctor/undo-selectors-v20.json').read_text())
        jar = Jar(Path(os.environ['GRID_SYMBOL_JAR']))
        try:
            types, rows = resolve(jar, rules)
            validate(jar, rules, types, rows)
            ambiguous = copy.deepcopy(rules)
            del next(r for r in ambiguous['members'] if r['role'] == 'undo-command')['callTrace']
            with self.assertRaisesRegex(Refusal, 'undo-command:expected-one-candidate:found-2'):
                resolve(jar, ambiguous)
            self.assertEqual(len(rows), 76)
            self.assertEqual([(r['role'], r['name']) for r in rows[-7:-4]],
                             [('undo-head', 'MkF'), ('undo-available', 'kG'), ('undo-command', 'OTd')])
            renamed, names, member = rename_model(jar)
            new_types, new_rows = resolve(renamed, rules)
            validate(renamed, rules, new_types, new_rows)
            self.assertEqual(new_types, {r: names[n] for r, n in types.items()})
            for old, new in zip(rows, new_rows):
                self.assertEqual(new['name'], member(old['name']))
                self.assertEqual(new['lookup'], names[old['lookup']])
                self.assertEqual(new['declaring'], names[old['declaring']])
        finally:
            jar.close()
