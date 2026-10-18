#!/usr/bin/env python3
"""Derive fixture semantics from a complete 9a projection. No live calls."""
import argparse
import json
import pathlib


INTEGER_TYPES = {'java.lang.Byte', 'java.lang.Short', 'java.lang.Integer', 'java.lang.Long'}
PARAMETERS = {
    'decimal_value_atom': 712, 'bipolar_toggleable_decimal_value_atom': 712,
    'boolean_value_atom': 210, 'button_boolean_value_atom': 210,
    'integer_value_atom': 828, 'indexed_value_atom': 457, 'boolean_panel_value': 6386,
}
OPAQUE_COMPONENTS = {'nitro_atom', 'device_input_proxy_atom', 'device_audio_output_proxy_atom',
                     'audio_voice_sum_atom', 'polyphonic_observer_atom'}


def derive(capture):
    graph = capture['graph']
    assert graph['complete'] and not graph['errors'] and graph['errorCount'] == 0, 'Incomplete graph'
    nodes = {n['id']: n for n in graph['nodes']}
    assert len(nodes) == len(graph['nodes']), 'Duplicate capture IDs'

    def prop(node, key):
        matches = [p for p in node['properties'] if p['id'] == key]
        assert len(matches) == 1, f'Missing or duplicate property {key}'
        return matches[0]

    def scalar(node, key):
        p = prop(node, key)
        assert p['kind'] == 'value'
        value = p['value']
        return int(value['data']) if value['type'] in INTEGER_TYPES else value['data']

    def children(node, key):
        p = prop(node, key)
        assert p['kind'] == 'relationship' and p['count'] == len(p['refs'])
        assert all(ref in nodes for ref in p['refs']), 'Unresolved relationship'
        return [nodes[ref] for ref in p['refs']]

    root = nodes[graph['root']]
    assert root['className'] == 'module_grid'
    modules, cables, outputs, pending, uuids = [], [], {}, [], []
    for i, node in enumerate(children(root, 6428)):
        assert node['className'] == 'module'
        uuid = scalar(node, 15)
        assert isinstance(uuid, str) and uuid and uuid not in uuids, 'Duplicate module UUID'
        uuids.append(uuid)
        contents = children(node, 406)
        assert len(contents) == 1 and contents[0]['className'] == 'module_contents'
        contents = contents[0]
        assert scalar(node, 404) == scalar(contents, 6370), 'Module name mismatch'
        module = {'index': str(i), 'name': scalar(node, 404), 'typeUuid': scalar(contents, 6369),
                  'x': scalar(node, 6679), 'y': scalar(node, 6680), 'parameters': [], 'ports': []}
        assert scalar(node, 6977) is True, 'Inactive fixture module'
        for atom in children(contents, 173):
            kind = atom['className']
            if kind in PARAMETERS:
                name = scalar(atom, 6387 if kind == 'boolean_panel_value' else 701)
                module['parameters'].append({'name': name, 'value': scalar(atom, PARAMETERS[kind])})
            elif kind == 'audio_source_atom':
                port = scalar(atom, 3640)
                assert atom['id'] not in outputs, 'Output has two module owners'
                outputs[atom['id']] = (str(i), port)
                module['ports'].append({'name': port, 'direction': 'output'})
            elif kind == 'audio_destination_atom':
                port = scalar(atom, 7124)
                module['ports'].append({'name': port, 'direction': 'input'})
                source = children(atom, 7125)
                assert len(source) <= 1, 'Multiple sources on one input'
                if source:
                    assert source[0]['className'] == 'audio_source_atom'
                    pending.append((source[0]['id'], str(i), port))
            else:
                assert kind in OPAQUE_COMPONENTS, f'Unclassified component {kind}'
        names = [x['name'] for x in module['parameters']]
        assert len(names) == len(set(names)), 'Duplicate parameter identifier'
        modules.append(module)
    for ref, destination, port in pending:
        assert ref in outputs, 'Cable source is outside this Grid'
        source, source_port = outputs[ref]
        cables.append({'sourceModule': source, 'sourcePort': source_port,
                       'destinationModule': destination, 'destinationPort': port})
    assert 0 < len(modules) <= 16 and len(cables) <= 24, 'Fixture limit'
    return {'scope': 'module types, session identities, stored values, layout, and directed patch cables',
            'identityDomain': 'module UUIDs observed to change on project reload',
            'valueDomain': 'stored/native; display conversion is not a write contract',
            'moduleUuids': uuids, 'modules': modules, 'cables': cables}


def compare_preset(result, preset):
    assert len(result['modules']) == len(preset['modules'])
    for live, saved in zip(result['modules'], preset['modules']):
        for key in ['index', 'name', 'typeUuid', 'x', 'y']:
            assert live[key] == saved[key], (key, live, saved)
        expected = [{'name': p['name'], 'value': p['value']} for p in saved['parameters']
                    if p['value'] is not None]
        assert live['parameters'] == expected, 'Stored parameter mismatch'
        inputs = [p['name'] for p in saved['parameters'] if p['value'] is None]
        assert [p['name'] for p in live['ports'] if p['direction'] == 'input'] == inputs
    expected_cables = [{k: v for k, v in cable.items() if k != 'storedSource'} for cable in preset['cables']]
    assert result['cables'] == expected_cables, 'Directed cable mismatch'


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('capture', type=pathlib.Path)
    parser.add_argument('--preset', type=pathlib.Path)
    args = parser.parse_args()
    result = derive(json.loads(args.capture.read_text()))
    if args.preset:
        compare_preset(result, json.loads(args.preset.read_text()))
        result['presetComparison'] = 'equal'
    print(json.dumps(result, indent=2))
