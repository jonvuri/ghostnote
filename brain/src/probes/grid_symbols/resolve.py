"""Resolve structural candidates, then validate their type relationships."""
from collections import defaultdict
import re
import time

from .scan import Refusal, ancestors, descriptor, member_traces, class_trace, CallTraces, instructions


def unique(candidates, role):
    if len(candidates) != 1:
        raise Refusal(f'{role}:expected-one-candidate:found-{len(candidates)}')
    return candidates[0]


def resolve(jar, rules):
    start = time.perf_counter()
    index = defaultdict(list)
    for name, key in jar.keys.items():
        index[key].append(name)
    types = {}
    for role, rule in rules['types'].items():
        jar.check()
        candidates = index[rule['shape']]
        if 'codeTrace' in rule:
            candidates = [n for n in candidates if class_trace(jar.code(n), jar.keys) == rule['codeTrace']]
        types[role] = unique(candidates, role)
    traces = {}
    calls = CallTraces(jar)
    rows = []
    pools = {}
    for rule in rules['members']:
        jar.check()
        owner = types[rule['declaringType']]
        c = jar.code(owner)
        if owner not in traces:
            traces[owner] = member_traces(c, jar.keys)
        keys = traces[owner][0 if rule['kind'] == 'method' else 1]
        pool = c.methods if rule['kind'] == 'method' else c.fields
        candidates = [m for m in pool if m.flags == rule['flags']
                      and descriptor(m.desc, lambda n: jar.keys.get(n,n)) == rule['shape']
                      and keys[(m.name,m.desc)] == rule['trace']]
        if 'callTrace' in rule:
            candidates = [m for m in candidates if calls.trace(owner,m.name,m.desc,receiver=types.get(rule.get('dispatchType'))) == rule['callTrace']]
        pools[rule['role']] = candidates
    resolved = {}
    pending = list(rules['members'])
    while pending:
        progressed = False
        for rule in list(pending):
            owner = types[rule['declaringType']]
            candidates = pools[rule['role']]
            if 'referencedBy' in rule:
                caller = resolved.get(rule['referencedBy'])
                if caller is None:
                    continue
                candidates = [m for m in candidates if references(jar,caller,owner,m)]
            m = unique(candidates,rule['role'])
            resolved[rule['role']] = {'role': rule['role'], 'lookup': types[rule['lookupType']],
                'declaring': owner, 'kind': m.kind, 'name': m.name,
                'descriptor': m.desc, 'flags': m.flags}
            pending.remove(rule)
            progressed = True
        if not progressed:
            raise Refusal('unresolved-reference-dependency')
    rows = [resolved[r['role']] for r in rules['members']]
    jar.stats['callTraceWork'] = calls.work
    jar.stats['codeClasses'] = len(jar.code_cache)
    jar.timings['candidateSearchMs'] = (time.perf_counter() - start) * 1000
    return types, rows


def validate(jar, rules, types, rows):
    start = time.perf_counter()
    if len(rows) != len(rules['members']) or len(types) != len(rules['types']):
        raise Refusal('incomplete-table')
    if len(set(types.values())) != len(types):
        raise Refusal('aliased-type-roles')
    if len({r['role'] for r in rows}) != len(rows):
        raise Refusal('duplicate-role')
    by_role = {r['role']: r for r in rows}
    for rule in rules['members']:
        jar.check()
        row = by_role[rule['role']]
        lookup, owner = types[rule['lookupType']], types[rule['declaringType']]
        if row['lookup'] != lookup or row['declaring'] != owner:
            raise Refusal('wrong-receiver:' + rule['role'])
        if owner not in set(ancestors(jar.classes, lookup, jar.limits.depth)):
            raise Refusal('receiver-inheritance:' + rule['role'])
        c = jar.code(owner)
        pool = c.methods if row['kind'] == 'method' else c.fields
        member = unique([m for m in pool if m.name == row['name'] and m.desc == row['descriptor']
                         and m.flags == row['flags']], 'declaration:' + rule['role'])
        if 'dispatchType' in rule and owner not in set(ancestors(jar.classes,types[rule['dispatchType']],jar.limits.depth)):
            raise Refusal('dispatch-receiver:' + rule['role'])
        if 'referencedBy' in rule and not references(jar,by_role[rule['referencedBy']],owner,member):
            raise Refusal('operation-reference:' + rule['role'])
        expected = re.sub(r'@([^;]+);', lambda m: 'L' + types[m[1]] + ';', rule['signature'])
        if row['descriptor'] != expected or row['flags'] != rule['flags'] or row['kind'] != rule['kind']:
            raise Refusal('signature:' + rule['role'])
    for child, parent in rules['assignable']:
        if types[parent] not in set(ancestors(jar.classes, types[child], jar.limits.depth)):
            raise Refusal('type-relationship:' + child + ':' + parent)
    for a,b in rules['distinct']:
        if types[a] == types[b]:
            raise Refusal('receiver-role-alias')
    jar.timings['validationMs'] = (time.perf_counter() - start) * 1000
    return {'structuralValidation': 'pass', 'liveValidation': 'not-run', 'writeAuthority': False}


def references(jar, caller, owner, target):
    c = jar.code(caller['declaring'])
    m = unique([m for m in c.methods if m.name == caller['name'] and m.desc == caller['descriptor']], 'caller')
    for _,op,args in instructions(m.code):
        if op not in (182,183,184,185):
            continue
        called,nt = c.cp[args[0]*256+args[1]][1]
        called = c.cp[c.cp[called][1]][1]
        ni,di = c.cp[nt][1]
        if c.cp[ni][1] == target.name and c.cp[di][1] == target.desc:
            if owner in set(ancestors(jar.classes,called,jar.limits.depth)):
                return True
    return False
