"""The Grid doctor toolkit classification (9b.7).

Each module of this package is a reusable tool or a per-build diagnostic.
A reusable tool works on any jar from explicit inputs. A per-build diagnostic
is the glue of one 9b.6 investigation; its reports stay under
``context/evidence/data/phase9b-doctor/614-*`` with their checkpoint
snapshots, and its code stays in place so the recorded commands still run.
``test_toolkit.py`` checks that every module is classified once.
"""

REUSABLE_TOOLS = {
    'upgrade': 'the deterministic upgrade check: fingerprint, resolve, body change, census, guards',
    'body_change': 'compare role and callee bodies between two jars as data',
    'owned_census': 'derive the owned-tree class set of one build and compare two builds',
    'guarded_candidate': 'verify a table and guard plan against a jar and build the three resources',
    'preservation': 'compare an immutable file inventory with the current files',
    'diagnose': 'bounded two-build diagnosis after a resolver refusal',
    'migrate': 'trace renamed members between two jars from a candidate table',
    'ownership': 'method traces, bootstraps, and constant reads of one class',
    'contracts': 'body contract digests and references of one method',
    'dynamic_contracts': 'explicit contract of an invokedynamic body',
    'conditional_contracts': 'conditional branch contracts of one body',
    'constructor_bounds': 'bounded constructor allocation traces',
    'call_paths': 'bounded call paths between two members',
    'bounded_trace': 'one bounded instruction trace with a work limit',
    'command_closure': 'closure of the fixed command bodies with label parity',
    'runtime_dependencies': 'runtime class dependencies of a body',
    'read_dataflow': 'read-only dataflow classification of a body',
    'renamed_fixture': 'rename an inert jar model to test selectors',
    'mutated_fixture': 'mutate an inert jar model to test refusals',
    'hashmap_removal': 'inert JDK model of HashMap removal bounds',
    'admission': 'admission boundary traces as data',
    'receiver_trace': 'receiver and event dispatch traces',
    'role_contracts': 'per-role body contracts of a table',
    'role_bindings': 'operation bindings of the role set',
    'descriptor_resolution': 'descriptor access resolution with a class cache',
    'module_file': 'decode a fixed module file as data',
    'toolkit': 'this classification',
}

BUILD_DIAGNOSTICS = {
    'assertion_guards': '9b.6g assertion guard census',
    'assertion_variants': '9b.6g assertion variant census',
    'bootstrap_contracts': '9b.6g managed-ID bootstrap contracts',
    'callee_contracts': '9b.6g callee contract census',
    'constructor_flags': '9b.6g constructor flag census',
    'constructor_paths': '9b.6g constructor path census',
    'constructor_variants': '9b.6g constructor variant census',
    'descriptor_builders': '9b.6g descriptor builder census',
    'dispatch_paths': '9b.6g dispatch path census',
    'disposal_wrappers': '9b.6g disposal wrapper contracts',
    'domain_contracts': '9b.6g domain contract census',
    'domain_paths': '9b.6g domain path census',
    'empty_storage': '9b.6g empty storage census',
    'explicit_variants': '9b.6g explicit variant census',
    'factory_closure': '9b.6g module factory closure',
    'fixed_descriptors': '9b.6g fixed descriptor reads',
    'fixed_dispatch': '9b.6g fixed dispatch reads',
    'fixed_read_checkpoint': '9b.6g fixed read checkpoint',
    'history_ancestor': '9b.6g history ancestor census',
    'history_growth': '9b.6g history growth bounds',
    'invariant_root': '9b.6g invariant root census',
    'listener_map_variant': '9b.6g listener map variant census',
    'listener_mode': '9b.6g listener mode census',
    'listener_removal': '9b.6g listener removal census',
    'nitro_data': '9b.6g Nitro data census',
    'owned_collectors': '9b.6g owned collector and serialized tree census',
    'owned_flow': '9b.6g owned flow census',
    'property_contracts': '9b.6g property contract census',
    'role_variants': '9b.6g role variant census',
    'wrapper_bounds': '9b.6g wrapper bounds',
}
