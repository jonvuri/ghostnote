"""Keep the disposal comparison variant narrow."""
import unittest
from grid_symbols.scan import Class, Member, Refusal
from .contracts import contract
from .explicit_variants import disposal_prefix


class ExplicitVariantTests(unittest.TestCase):
    def fixture(self):
        cp = [None, (1, 'Helper'), (7, 1), (1, 'track'), (1, '(Ljava/lang/Object;)V'),
              (12, (3, 4)), (10, (2, 5))]
        cls = Class('Receiver', 'java/lang/Object', (), 1, [], [], cp)
        old = Member('method', 'dispose', '()V', 1, bytes([177]))
        new = Member('method', 'dispose', '()V', 1, bytes([42, 184, 0, 6, 177]))
        return cls, old, new

    def test_copy_preserves_original_and_exact_prefix(self):
        cls, old, new = self.fixture()
        changed = disposal_prefix(old, cls, new)
        self.assertEqual(changed.code, old.code)
        self.assertEqual(new.code, bytes([42, 184, 0, 6, 177]))
        self.assertEqual(contract(cls, old, {})['digest'], contract(cls, changed, {})['digest'])

    def test_wrong_tail_call_and_shape_refuse(self):
        cls, old, new = self.fixture(); cls.cp[4] = (1, '(I)V')
        with self.assertRaisesRegex(Refusal, 'tail-call'):
            disposal_prefix(old, cls, new)
        cls, old, new = self.fixture(); new.code = bytes([42, 182, 0, 6, 177])
        with self.assertRaisesRegex(Refusal, 'tail-shape'):
            disposal_prefix(old, cls, new)

    def test_access_handler_and_empty_source_refuse(self):
        for change in ('access', 'handler', 'empty'):
            cls, old, new = self.fixture()
            if change == 'access':
                new.flags = 2
            elif change == 'handler':
                new.handlers = ((0, 4, 4, 0),)
            else:
                old.code = b''
            with self.subTest(change=change), self.assertRaisesRegex(Refusal, 'source-or-access'):
                disposal_prefix(old, cls, new)

    def test_prefix_change_is_not_erased(self):
        cls, old, new = self.fixture()
        old.code = bytes([3, 87, 177]); new.code = bytes([4, 87, 42, 184, 0, 6, 177])
        actual = disposal_prefix(old, cls, new)
        self.assertNotEqual(contract(cls, old, {})['digest'], contract(cls, actual, {})['digest'])


if __name__ == '__main__':
    unittest.main()
