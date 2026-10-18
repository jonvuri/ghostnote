"""Check semantic reads against captured baseline and failure variants."""
import copy
import json
import pathlib
import unittest
from read_semantics import derive, compare_preset

DATA = pathlib.Path(__file__).resolve().parents[2] / 'context/evidence/data/phase9a-grid-read'


class SemanticReadTest(unittest.TestCase):
    def setUp(self):
        self.capture = json.loads((DATA / 'live-28-after-reload/capture-0.json').read_text())
        self.preset = json.loads((DATA / 'preset-baseline.json').read_text())

    def property(self, node_id, field_id):
        node = next(n for n in self.capture['graph']['nodes'] if n['id'] == node_id)
        return next(p for p in node['properties'] if p['id'] == field_id)

    def test_baseline_and_reload(self):
        before = derive(json.loads((DATA / 'live-27-before-reload/capture-0.json').read_text()))
        after = derive(self.capture)
        compare_preset(before, self.preset)
        compare_preset(after, self.preset)
        self.assertNotEqual(before.pop('moduleUuids'), after.pop('moduleUuids'))
        self.assertEqual(before, after)

    def test_manual_change_and_restore(self):
        baseline = derive(json.loads((DATA / 'live-23-semantic-baseline/capture-0.json').read_text()))
        changed = derive(json.loads((DATA / 'live-24-manual-value/capture-0.json').read_text()))
        restored = derive(json.loads((DATA / 'live-25-value-restored/capture-0.json').read_text()))
        self.assertEqual(restored, baseline)
        expected = copy.deepcopy(baseline)
        expected['modules'][3]['parameters'][0]['value'] = 0.8434326653017492
        self.assertEqual(changed, expected)

    def test_other_device_selected(self):
        baseline = derive(json.loads((DATA / 'live-23-semantic-baseline/capture-0.json').read_text()))
        selected = derive(json.loads((DATA / 'live-26-other-device-selected/capture-0.json').read_text()))
        self.assertEqual(selected, baseline)

    def test_incomplete_refuses(self):
        self.capture['graph']['complete'] = False
        with self.assertRaises(AssertionError): derive(self.capture)

    def test_duplicate_identity_refuses(self):
        self.property(45, 15)['value'] = self.property(24, 15)['value']
        with self.assertRaises(AssertionError): derive(self.capture)

    def test_external_source_refuses(self):
        self.property(34, 7125)['refs'] = [999]
        with self.assertRaises(AssertionError): derive(self.capture)

    def test_wrong_direction_refuses(self):
        self.property(34, 7125)['refs'] = [29]
        with self.assertRaises(AssertionError): derive(self.capture)

    def test_missing_parameter_refuses(self):
        self.capture['graph']['nodes'][48]['properties'] = []
        with self.assertRaises(AssertionError): derive(self.capture)

    def test_wrong_topology_fails_comparison(self):
        self.property(34, 7125)['refs'] = [47]
        with self.assertRaises(AssertionError): compare_preset(derive(self.capture), self.preset)


if __name__ == '__main__': unittest.main()
