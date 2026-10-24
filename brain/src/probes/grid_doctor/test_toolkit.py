"""Every module of the package is classified once, and every reusable tool has a test."""
from pathlib import Path
import unittest

from grid_doctor.toolkit import BUILD_DIAGNOSTICS, REUSABLE_TOOLS

PACKAGE = Path(__file__).resolve().parent

# Reusable tools whose tests live in another module.
TESTED_BY = {
    'renamed_fixture': 'test_fixture_trace', 'mutated_fixture': 'test_fixture_trace',
    'bounded_trace': 'test_fixture_trace', 'migrate': 'test_contracts',
    'runtime_dependencies': 'test_history_growth',
}


class ToolkitTest(unittest.TestCase):
    def test_every_module_is_classified_once(self):
        modules = {p.stem for p in PACKAGE.glob('*.py') if not p.stem.startswith('test_') and p.stem != '__init__'}
        self.assertEqual(set(REUSABLE_TOOLS) & set(BUILD_DIAGNOSTICS), set())
        self.assertEqual(modules, set(REUSABLE_TOOLS) | set(BUILD_DIAGNOSTICS))
        for table in (REUSABLE_TOOLS, BUILD_DIAGNOSTICS):
            for name, purpose in table.items():
                self.assertTrue(purpose and len(purpose) > 10, name)

    def test_each_reusable_tool_has_a_test(self):
        for name in REUSABLE_TOOLS:
            module = TESTED_BY.get(name, f'test_{name}')
            self.assertTrue((PACKAGE / f'{module}.py').exists(), f'{name}: {module}.py is missing')


if __name__ == '__main__':
    unittest.main()
