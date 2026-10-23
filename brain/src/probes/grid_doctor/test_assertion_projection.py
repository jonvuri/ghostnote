"""Keep control flow when an explicit comparison excludes assertions."""
import unittest
from grid_symbols.scan import Member, Refusal
from .conditional_contracts import project_assertions
from .test_assertion_guards import fixture


class AssertionProjectionTests(unittest.TestCase):
    def test_forward_branch_and_guard_entry_rebase(self):
        cls = fixture()
        # An ordinary branch can enter the start of a disabled assertion block.
        method = Member('method', 'read', '(Z)I', 1,
                        bytes([27, 153, 0, 3, 178, 0, 12, 154, 0, 5, 1, 191, 4, 172]))
        projected, guards = project_assertions(cls, method)
        self.assertEqual(projected.code, bytes([27, 153, 0, 3, 4, 172]))
        self.assertEqual(method.code[4:7], bytes([178, 0, 12]))
        self.assertEqual(guards['requiredTrueField'], ('Owner', 'disabled', 'Z'))
        self.assertFalse(guards['boundedAdmission'])

    def test_backward_edge_retains_its_target(self):
        cls = fixture()
        method = Member('method', 'walk', '(Z)V', 1,
                        bytes([27, 153, 0, 14, 178, 0, 12, 154, 0, 5, 1, 191, 167, 255, 244, 177]))
        projected, _ = project_assertions(cls, method)
        self.assertEqual(projected.code, bytes([27, 153, 0, 6, 167, 255, 252, 177]))

    def test_entered_assertion_body_and_handler_refuse(self):
        for handler in (False, True):
            cls = fixture(); method = Member('method', 'read', '()V', 1,
                bytes([167, 0, 9, 178, 0, 12, 154, 0, 5, 1, 191, 177]))
            if handler:
                method.code = method.code[3:]; method.handlers = ((0, 3, 8, 0),)
            with self.assertRaises(Refusal):project_assertions(cls, method)

    def test_normal_effects_remain_in_the_comparison_copy(self):
        cls = fixture()
        bodies = [bytes([178, 0, 12, 154, 0, 5, 1, 191, literal, 172])
                  for literal in (4, 5)]
        results = [project_assertions(cls, Member('method', 'read', '()I', 1, body))[0]
                   for body in bodies]
        self.assertEqual([m.code for m in results], [bytes([4, 172]), bytes([5, 172])])

    def test_no_guard_and_branch_outside_method_refuse(self):
        cls = fixture()
        for body in (bytes([177]), bytes([178, 0, 12, 154, 0, 5, 1, 191, 167, 0, 3])):
            method = Member('method', 'read', '()V', 1, body)
            with self.assertRaises(Refusal):project_assertions(cls, method)


if __name__ == '__main__':
    unittest.main()
