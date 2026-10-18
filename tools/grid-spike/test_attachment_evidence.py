"""Reject damaged attachment receipts without a live host."""
import copy
import unittest
from verify_attachment_evidence import expected, read, ROOT
from verify_attachment_lifecycle import compare


class AttachmentEvidence(unittest.TestCase):
    def setUp(self):
        self.before = read(ROOT / 'context/evidence/data/phase9a-grid-read/live-28-after-reload', 'capture-0')
        factory = read(ROOT / 'context/evidence/data/phase9a-grid-factory/live-87-factory-first', 'factory-command')
        life = copy.deepcopy(factory['lifecycle'])
        for key in ['editStartAttempted', 'editStartReturned', 'editAdmitted', 'editOwned', 'insertionAttempted',
                    'insertionReturned', 'closeAttempted', 'closeReturned', 'closeAccepted', 'editClosed']:
            life[key] = True
        life.update(disposeAttempted=False, disposalVerified=False, uncertain=False)
        uuid = next(p['value']['data'] for p in life['capture0']['nodes'][0]['properties'] if p['id'] == 15)
        life['attached'] = dict(uuid=uuid, managedObjectId=4000, managedObjectRegistered=True, parentsVerified=True, selectionUnchanged=True,
                                rectangle=dict(uuid=uuid, x=2, y=0, width=1, height=2))
        self.before['witness'] = dict(moduleUuids=['a', 'b', 'c', 'd'], parentsVerified=True,
            edit=dict(frames=0, instant=0, longer=0, locks=0, lockSet=False, active=False),
            rectangles=[dict(uuid=str(i), x=x, y=y, width=w, height=2)
                        for i, (x, y, w) in enumerate([(-4, -2, 3), (-1, -2, 1), (0, -2, 2), (-1, 0, 1)])])
        self.command = dict(lifecycle=life)

    def test_append_and_rebase(self):
        _, nodes, witness = expected(self.before, self.command)
        self.assertEqual(len(nodes), 61)
        self.assertEqual(len(witness['rectangles']), 5)

    def test_uncertainty_or_disposal_refuses(self):
        for key in ['uncertain', 'disposeAttempted', 'disposalVerified']:
            value = copy.deepcopy(self.command)
            value['lifecycle'][key] = True
            with self.assertRaises(AssertionError):
                expected(self.before, value)

    def test_managed_id_requires_proof_and_fresh_integer(self):
        for managed_id in [0, -1, 1.5, True, 0x80000000]:
            value = copy.deepcopy(self.command)
            value['lifecycle']['attached']['managedObjectId'] = managed_id
            with self.assertRaises(AssertionError):
                expected(self.before, value)
        self.command['lifecycle']['attached']['managedObjectRegistered'] = False
        with self.assertRaises(AssertionError):
            expected(self.before, self.command)

    def test_changed_default_or_selection_refuses(self):
        self.command['lifecycle']['attached']['selectionUnchanged'] = False
        with self.assertRaises(AssertionError):
            expected(self.before, self.command)
        self.command['lifecycle']['attached']['selectionUnchanged'] = True
        for capture in ['capture0', 'capture1']:
            node = self.command['lifecycle'][capture]['nodes'][3]
            next(p for p in node['properties'] if p['id'] == 712)['value']['data'] = 0.5
        with self.assertRaises(AssertionError):
            expected(self.before, self.command)


class AttachmentReloadEvidence(unittest.TestCase):
    def test_reload_accepts_fresh_ids_but_rejects_layout_or_value_change(self):
        data = ROOT / 'context/evidence/data/phase9a-grid-attachment'
        before = read(data / 'live-98-v11-repeat', 'attach-readback-0')
        reloaded = read(data / 'live-100-v11-reloaded', 'capture-0')
        compare(reloaded, before, reloaded=True)
        with self.assertRaises(AssertionError):
            compare(reloaded, before)
        moved = copy.deepcopy(reloaded)
        moved['witness']['rectangles'][-1]['x'] += 1
        with self.assertRaises(AssertionError):
            compare(moved, before, reloaded=True)
        changed = copy.deepcopy(reloaded)
        gain = next(n for n in changed['graph']['nodes'] if n['id'] == 56)
        next(p for p in gain['properties'] if p['id'] == 712)['value']['data'] = 0.5
        with self.assertRaises(AssertionError):
            compare(changed, before, reloaded=True)
