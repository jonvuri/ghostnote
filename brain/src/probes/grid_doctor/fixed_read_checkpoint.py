"""Reproduce fixed read contracts. This checkpoint grants no write authority."""
import argparse
import hashlib
import json
from pathlib import Path
import time
from grid_symbols.scan import Jar, Refusal, rss_bytes
from .contracts import contract
from .assertion_guards import requirements
from .callee_contracts import compare_callees
from .descriptor_resolution import Code
from .dispatch_paths import read_paths
from .domain_contracts import source_domains
from .domain_paths import domain_reads
from .fixed_descriptors import catalog
from .fixed_dispatch import fixed_slots
from .migrate import member
from .read_dataflow import fixed_read_flow


def membership_variants(jar, symbols, code, traces):
    """Select the exact membership getter template in the fixed read trace."""
    root = next(tuple(row['reference'][1:]) for row in symbols['members'] if row['role'] == 'members')
    cls = code.get(jar, root[0])
    expected = contract(cls, member(cls, *root[1:]), jar.classes)
    token = [184, [10, 'java/util/Collections', 'emptyList', '()Ljava/util/List;'], []]
    if expected['tokens'].count(token) != 1:
        return set()
    variants = set()
    for trace in traces:
        cls = code.get(jar, trace['owner'])
        method = member(cls, trace['name'], trace['descriptor'])
        if method.desc != root[2] or method.flags != 1:
            continue
        actual = contract(cls, method, jar.classes)
        if actual['digest'] == expected['digest']:
            variants.add((cls.name, method.name, method.desc))
    return variants


def read(path):
    if path.stat().st_size > 8 * 1024**2:
        raise Refusal('checkpoint-input-size')
    raw = path.read_bytes()
    return json.loads(raw), hashlib.sha256(raw).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('old-jar', 'new-jar', 'symbols', 'catalog', 'properties', 'output'):
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        raise Refusal('checkpoint-output-exists')
    start = time.perf_counter()
    inputs, hashes = {}, {}
    for name in ('symbols', 'catalog', 'properties'):
        inputs[name], hashes[name] = read(getattr(args, name))
    old, target = Jar(args.old_jar), Jar(args.new_jar)
    jars, code = (old, target), Code()
    for name, report in inputs.items():
        if len(report['builds']) != 2 or any(row['sha256'] != jar.sha256 for row, jar in zip(report['builds'], jars)):
            raise Refusal('checkpoint-input-fingerprint:' + name)
    args.output.mkdir()
    outputs = {}

    def save(name, report):
        if time.perf_counter() - start > 120 or rss_bytes() > 768 * 1024**2:
            raise Refusal('checkpoint-time-or-memory-limit')
        raw = json.dumps(report, indent=2).encode() + b'\n'
        if len(raw) > 8 * 1024**2:
            raise Refusal('checkpoint-report-size')
        with (args.output / (name + '.json')).open('xb') as output:
            output.write(raw)
        outputs[name] = {'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw)}

    symbols, catalogs, properties = (inputs[k]['builds'] for k in ('symbols', 'catalog', 'properties'))
    pairs, source = source_domains(old, symbols[0], code)
    domains = [catalog(jar, pairs) for jar in jars]
    save('domains', {'sourceReceivers': source, 'builds': domains})
    summaries = []
    for index, jar in enumerate(jars):
        slots = fixed_slots(old, jar, catalogs[0], catalogs[index], symbols[0], symbols[index],
                            properties[index], code, (domains[0], domains[index]))
        if any(row['status'] != 'exact-concrete-local-contract' for row in slots['slots']):
            raise Refusal('checkpoint-fixed-slot-difference')
        save(f'slots-{index}', slots)
        unguarded = read_paths(jar, catalogs[index], symbols[index], properties[index], code)
        guards = requirements(jar, {m['owner'] for m in unguarded['methods']}, code)
        guarded = read_paths(jar, catalogs[index], symbols[index], properties[index], code,
                             set(map(tuple, guards['fields'])))
        guarded['assertionGuards'] = guards
        save(f'reads-{index}', guarded)
        flow = fixed_read_flow(jar, code, symbols[index], catalogs[index], properties[index], guards['fields'])
        save(f'dataflow-{index}', flow)
        if any(row['error'] for row in flow['paths']):
            raise Refusal('checkpoint-read-dataflow')
        domain = domain_reads(jar, domains[index], symbols[index], code)
        save(f'domain-reads-{index}', domain)
        # Only the membership roles can use the traced empty-list variant.
        membership = membership_variants(jar, symbols[index], code, guarded['methods'])
        methods = {tuple(m[k] for k in ('owner', 'name', 'descriptor')): m
                   for m in [*guarded['methods'], *domain['methods']]}
        callees = compare_callees(old, jar, list(methods.values()), slots, code, membership)
        save(f'callees-{index}', callees)
        if callees['unmatched']:
            raise Refusal('checkpoint-unmatched-callee')
        summaries.append({'sha256': jar.sha256, 'slots': len(slots['slots']),
                          'readWork': guarded['work'], 'domainWork': domain['work'], 'dataflowWork': flow['work'],
                          'matchedCallees': len(callees['matched']), 'unmatchedCallees': callees['unmatched']})
    summary = {'inputs': hashes, 'outputs': outputs.copy(), 'builds': summaries,
               'elapsedMs': round((time.perf_counter() - start) * 1000, 3),
               'peakRssBytes': rss_bytes(), 'completeTable': False,
               'boundedAdmission': False, 'writeAuthority': False}
    save('summary', summary)
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()
