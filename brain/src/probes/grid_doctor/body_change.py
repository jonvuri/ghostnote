"""Compare Grid doctor role and callee bodies between Bitwig 6.0.6 and 6.1.4.

The comparison reads class bytes as data. It does not load, initialize, or run
vendor code. Equal body digests show equal local logic after vendor renaming
only. A changed body needs a decision under D52. This report gives no write
authority and no bounded admission.
"""
import argparse
import difflib
import hashlib
import json
from pathlib import Path
import sys
import time

from grid_symbols.scan import Jar, Refusal, class_shape, descriptor, digest, rss_bytes
from .contracts import contract
from .dynamic_contracts import dynamic_contract
from .ownership import bootstraps

FORMAT = 'grid-doctor-body-change-v1'
OLD_SHA256 = '382c655d0b9e8db6bd433dc6100ef3a4ee23abf6a6615f79c40f0c2645792c93'
NEW_SHA256 = '5c2b1895bbb9e7d08d9216de421985bb1f24b2ee62762c9451b4fe847df2469f'
REPO = Path(__file__).resolve().parents[4]
DATA = REPO / 'context/evidence/data/phase9b-doctor'
DEFAULTS = {
    'candidate': DATA / 'v20-preparation/candidate.json',
    'symbols': DATA / '614-resolution/checkpoint-2/symbols.json',
    'closure': DATA / '614-resolution/checkpoint-17/command-closure-2.json',
    'removal': DATA / '614-resolution/checkpoint-17/collection-conditions-21.json',
    'migration': DATA / '614-structural/migration.json',
}
HOOKS = ('aboutToInsertItem', 'aboutToRemoveItem', 'aboutToChangeOneToOneRelationship')
NEW_HOOK_OWNER = 'dfL'
NEW_ONLY_METHODS = (('disposal-tail', 'thz', 'cfM', '(Ljava/lang/Object;)V'),)
NEW_ONLY_CLASSES = (('history-helper', 'dgJ'),)
MAX_DIFF_TOKENS = 16
MAX_REPORT = 2 * 1024**2
MAX_RSS = 768 * 1024**2
MAX_SECONDS = 120
CACHE_RELEASE = 128
CONDITIONS = [
    'Bodies are compared as class-file data. No vendor class is loaded or initialized.',
    'Equal body digests prove equal local logic modulo renaming only. Flags are compared separately.',
    'Callee bodies outside the compared role and callee set are not covered.',
    'A changed body needs a decision under D52 before any admission.',
    'A body with an invokedynamic call site is compared with the explicit dynamic contract. '
    'It keeps every bootstrap payload. It does not run the bootstrap.',
    'The diff positions are instruction ordinals. Member labels follow first use, so one added '
    'reference can relabel later tokens.',
]


def sha256_file(path):
    with Path(path).open('rb') as source:
        return hashlib.file_digest(source, 'sha256').hexdigest()


def release(jar):
    """Keep the parsed code cache below the scan limit."""
    if len(jar.code_cache) >= CACHE_RELEASE:
        jar.code_cache.clear()


def find_method(jar, owner, name, desc):
    if owner not in jar.classes:
        raise Refusal(f'missing-class:{owner}')
    cls = jar.code(owner)
    found = [m for m in cls.methods if (m.name, m.desc) == (name, desc)]
    if len(found) != 1:
        raise Refusal(f'method-count:{owner}.{name}{desc}:{len(found)}')
    return cls, found[0]


def find_field(jar, owner, name, desc):
    if owner not in jar.classes:
        raise Refusal(f'missing-class:{owner}')
    found = [m for m in jar.classes[owner].fields if (m.name, m.desc) == (name, desc)]
    if len(found) != 1:
        raise Refusal(f'field-count:{owner}.{name}{desc}:{len(found)}')
    return found[0]


def dynamic_body(jar, cls, method):
    """Compare explicit dynamic call payloads from the class bootstrap table."""
    table = bootstraps(jar.zip.read(cls.name + '.class'), cls)
    return dynamic_contract(cls, method, jar.classes, table)


def diff_summary(old_tokens, new_tokens):
    old = [json.dumps(t, separators=(',', ':')) for t in old_tokens]
    new = [json.dumps(t, separators=(',', ':')) for t in new_tokens]
    matcher = difflib.SequenceMatcher(None, old, new, autojunk=False)
    only_old = only_new = 0
    blocks, tokens = [], []
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == 'equal':
            continue
        only_old += i2 - i1
        only_new += j2 - j1
        blocks.append([tag, i1, i2, j1, j2])
        for side, start, end, source in (('old', i1, i2, old_tokens), ('new', j1, j2, new_tokens)):
            for position in range(start, end):
                if len(tokens) < MAX_DIFF_TOKENS:
                    tokens.append({'side': side, 'position': position, 'token': source[position]})
    return {'tokensOnlyOld': only_old, 'tokensOnlyNew': only_new,
            'blockCount': len(blocks), 'blocks': blocks[:MAX_DIFF_TOKENS],
            'tokens': tokens, 'tokensTruncated': only_old + only_new > len(tokens)}


def compare_methods(old_jar, old_identity, new_jar, new_identity):
    """Compare two method bodies. Identity is (owner, name, descriptor)."""
    old_cls, old_method = find_method(old_jar, *old_identity)
    new_cls, new_method = find_method(new_jar, *new_identity)
    row = {'flagsOld': old_method.flags, 'flagsNew': new_method.flags}
    try:
        old = contract(old_cls, old_method, old_jar.classes)
        new = contract(new_cls, new_method, new_jar.classes)
        row['comparator'] = 'contract'
    except Refusal as error:
        if not str(error).startswith('contract-unsupported-constant'):
            raise
        try:
            # Only explicit lambda and string-concatenation call sites pass.
            if not str(error).endswith(':18'):
                raise
            old = dynamic_body(old_jar, old_cls, old_method)
            new = dynamic_body(new_jar, new_cls, new_method)
            row['comparator'] = 'dynamic-contract'
        except Refusal as dynamic_error:
            row.update(result='unsupported-dynamic', reason=str(dynamic_error),
                       codeBytesOld=len(old_method.code), codeBytesNew=len(new_method.code))
            return row
    row.update(bodyDigestOld=old['bodyDigest'], bodyDigestNew=new['bodyDigest'],
               digestOld=old['digest'], digestNew=new['digest'],
               instructionsOld=old['instructions'], instructionsNew=new['instructions'],
               handlersOld=len(old['handlers']), handlersNew=len(new['handlers']))
    if old['bodyDigest'] != new['bodyDigest']:
        row['result'] = 'changed-body'
        row['diff'] = diff_summary(old['tokens'], new['tokens'])
        if old['handlers'] != new['handlers']:
            row['diff']['handlersDiffer'] = True
    elif old_method.flags != new_method.flags:
        row['result'] = 'access-change-only'
    else:
        row['result'] = 'same-body'
    return row


def field_shape(jar, owner, desc):
    return descriptor(desc, lambda n: 'self' if n == owner else 'vendor' if n in jar.classes else n)


def compare_fields(old_jar, old_identity, new_jar, new_identity):
    old = find_field(old_jar, *old_identity)
    new = find_field(new_jar, *new_identity)
    old_shape = field_shape(old_jar, old_identity[0], old.desc)
    new_shape = field_shape(new_jar, new_identity[0], new.desc)
    same = (old_shape, old.flags) == (new_shape, new.flags)
    return {'flagsOld': old.flags, 'flagsNew': new.flags, 'shapeOld': old_shape,
            'shapeNew': new_shape, 'result': 'field-same' if same else 'field-changed'}


def identity(row):
    return {'declaring': row['declaring'], 'lookup': row['lookup'], 'name': row['name'],
            'descriptor': row['descriptor'], 'flags': row['flags']}


def role_rows(old_jar, new_jar, old_table, new_table, statuses):
    if len(old_table['members']) != len(new_table['members']):
        raise Refusal('role-count-mismatch')
    rows = []
    for old_row, new_row in zip(old_table['members'], new_table['members']):
        role = old_row['role']
        if new_row['role'] != role or new_row['kind'] != old_row['kind']:
            raise Refusal(f'role-order-mismatch:{role}')
        old_id = (old_row['declaring'], old_row['name'], old_row['descriptor'])
        new_id = (new_row['declaring'], new_row['name'], new_row['descriptor'])
        if old_row['kind'] == 'field':
            detail = compare_fields(old_jar, old_id, new_jar, new_id)
        else:
            detail = compare_methods(old_jar, old_id, new_jar, new_id)
        if (detail['flagsOld'], detail['flagsNew']) != (old_row['flags'], new_row['flags']):
            raise Refusal(f'table-flags-mismatch:{role}')
        rows.append({'role': role, 'kind': old_row['kind'], 'old': identity(old_row),
                     'new': identity(new_row), **detail,
                     'checkpointStatus': statuses.get(role)})
        release(old_jar)
        release(new_jar)
    return rows


def pair(old_id, new_id):
    keys = ('owner', 'name', 'descriptor')
    return {'old': dict(zip(keys, old_id)) if old_id else None, 'new': dict(zip(keys, new_id))}


def closure_rows(old_jar, new_jar, closure):
    """Recompute parity for the traced label pairs. Refuse on a disagreement."""
    labels, parity = closure['labels'], closure['labelParity']
    if set(labels) != set(parity):
        raise Refusal('closure-label-mismatch')
    rows, disagreements = [], []
    for label, new_id in labels.items():
        stored = parity[label]
        detail = compare_methods(old_jar, tuple(stored['old']), new_jar, tuple(new_id))
        equal = detail['result'] in ('same-body', 'access-change-only')
        if detail['result'] == 'unsupported-dynamic' or equal != stored['bodyEqual']:
            disagreements.append({'label': label, 'stored': stored['bodyEqual'],
                                  'recomputed': detail['result']})
        rows.append({'label': label, 'source': 'command-closure', 'how': stored['how'],
                     **pair(stored['old'], new_id), **detail,
                     'storedBodyEqual': stored['bodyEqual']})
        release(old_jar)
        release(new_jar)
    if disagreements:
        raise Refusal('stored-body-parity-disagreement:' + json.dumps(disagreements))
    return rows


def removal_pair(removal):
    found = {}
    for build in removal['builds']:
        found[build['sha256']] = tuple(build['removal']['method'])
    if set(found) != {OLD_SHA256, NEW_SHA256}:
        raise Refusal('removal-build-mismatch')
    return found[OLD_SHA256], found[NEW_SHA256]


def normalized(jar, desc):
    return descriptor(desc, lambda n: 'vendor' if n in jar.classes else n)


def hook_owners(jar, document):
    """Return every class that declares each hook once and a document field."""
    owners = []
    for name, cls in jar.classes.items():
        names = [m.name for m in cls.methods if m.name in HOOKS]
        fields = [m for m in cls.fields if m.desc == 'L' + document + ';']
        if sorted(names) == sorted(HOOKS) and fields:
            owners.append(name)
    return sorted(owners)


def hook_rows(old_jar, new_jar, migration, documents):
    old_owners = {h['old']['owner'] for h in migration['relationshipHooks']}
    new_owners = {h['new']['owner'] for h in migration['relationshipHooks']}
    if len(old_owners) != 1 or new_owners != {NEW_HOOK_OWNER}:
        raise Refusal('migration-hook-owner-not-unique')
    old_owner = old_owners.pop()
    # Confirm the migration owner with an independent census of each jar.
    old_census = hook_owners(old_jar, documents[0])
    new_census = hook_owners(new_jar, documents[1])
    if old_census != [old_owner] or new_census != [NEW_HOOK_OWNER]:
        raise Refusal('hook-owner-census-not-unique')
    rows = []
    for hook in HOOKS:
        new = [m for m in new_jar.classes[NEW_HOOK_OWNER].methods if m.name == hook]
        if len(new) != 1:
            raise Refusal(f'new-hook-count:{hook}:{len(new)}')
        shape = normalized(new_jar, new[0].desc)
        old = [m for m in old_jar.classes[old_owner].methods
               if m.name == hook and normalized(old_jar, m.desc) == shape]
        if len(old) != 1:
            raise Refusal(f'old-hook-count:{hook}:{len(old)}')
        old_id = (old_owner, hook, old[0].desc)
        new_id = (NEW_HOOK_OWNER, hook, new[0].desc)
        for traced in migration['relationshipHooks']:
            if traced['new']['name'] == hook and (
                    (traced['old']['descriptor'], traced['new']['descriptor'])
                    != (old_id[2], new_id[2])):
                raise Refusal(f'migration-hook-descriptor-mismatch:{hook}')
        rows.append({'label': 'hook-' + hook, 'source': 'relationship-hook',
                     'how': 'migration-owner-and-hook-census', **pair(old_id, new_id),
                     **compare_methods(old_jar, old_id, new_jar, new_id)})
        release(old_jar)
        release(new_jar)
    return rows


def shape_matches(old_jar, new_jar, owner):
    """Count old classes with the same unrefined shape as a new class."""
    def external(jar):
        return lambda n: 'vendor' if n in jar.classes else n
    expected = digest(class_shape(new_jar.classes[owner], external(new_jar)))
    key = external(old_jar)
    return sum(digest(class_shape(c, key)) == expected for c in old_jar.classes.values())


def new_only_rows(old_jar, new_jar):
    rows = []
    for label, owner, name, desc in NEW_ONLY_METHODS:
        cls, method = find_method(new_jar, owner, name, desc)
        result = contract(cls, method, new_jar.classes)
        rows.append({'label': label, 'source': 'disposal-tail', **pair(None, (owner, name, desc)),
                     'result': 'new-only', 'flagsNew': method.flags,
                     'bodyDigestNew': result['bodyDigest'], 'digestNew': result['digest'],
                     'instructionsNew': result['instructions'],
                     'handlersNew': len(result['handlers']),
                     'oldOwnerShapeMatches': shape_matches(old_jar, new_jar, owner)})
    for label, owner in NEW_ONLY_CLASSES:
        if owner not in new_jar.classes:
            raise Refusal(f'missing-class:{owner}')
        cls = new_jar.classes[owner]
        matches = shape_matches(old_jar, new_jar, owner)
        rows.append({'label': label, 'source': 'new-helper-class',
                     'old': None, 'new': {'owner': owner}, 'result': 'new-only',
                     'flagsNew': cls.flags, 'methodCount': len(cls.methods),
                     'fieldCount': len(cls.fields), 'oldClassShapeMatches': matches,
                     'oldCounterpart': None})
    return rows


def compare(old_jar, new_jar, inputs):
    candidate, symbols = inputs['candidate'], inputs['symbols']
    builds = {b['sha256']: b for b in symbols['builds']}
    if [b['sha256'] for b in symbols['builds']] != [OLD_SHA256, NEW_SHA256]:
        raise Refusal('symbols-build-order')
    old_table = {'types': candidate['types'], 'members': candidate['members']}
    stored_old = builds[OLD_SHA256]['symbolTable']
    if {'types': stored_old['types'], 'members': stored_old['members']} != old_table:
        raise Refusal('symbols-old-table-differs-from-candidate')
    new_build = builds[NEW_SHA256]
    statuses = {m['role']: m['status'] for m in new_build['members']}
    roles = role_rows(old_jar, new_jar, old_table, new_build['symbolTable'], statuses)
    old_removal, new_removal = removal_pair(inputs['removal'])
    callees = closure_rows(old_jar, new_jar, inputs['closure'])
    callees.append({'label': 'listener-removal', 'source': 'collection-conditions',
                    'how': 'removal-method', **pair(old_removal, new_removal),
                    **compare_methods(old_jar, old_removal, new_jar, new_removal)})
    documents = tuple(next(m['declaring'] for m in table['members'] if m['role'] == 'document')
                      for table in (old_table, new_build['symbolTable']))
    callees.extend(hook_rows(old_jar, new_jar, inputs['migration'], documents))
    callees.extend(new_only_rows(old_jar, new_jar))
    unchanged = ('same-body', 'field-same')
    changed = [{'role': r['role'], 'result': r['result']} for r in roles
               if r['result'] not in unchanged]
    changed += [{'label': r['label'], 'result': r['result']} for r in callees
                if r['result'] not in unchanged]
    summary = {'roles': len(roles), 'callees': len(callees)}
    for prefix, rows in (('role', roles), ('callee', callees)):
        for row in rows:
            key = prefix + ':' + row['result']
            summary[key] = summary.get(key, 0) + 1
    summary['changed'] = len(changed)
    variants = {v['role']: v['variant'] for v in new_build['localVariants']}
    return {'roles': roles, 'callees': callees, 'changed': changed, 'summary': summary,
            'checkpointVariants': variants}


def write_report(path, report):
    path = Path(path)
    if path.exists():
        raise Refusal('report-exists')
    text = json.dumps(report, indent=1, sort_keys=True) + '\n'
    if len(text.encode()) > MAX_REPORT:
        raise Refusal('report-size-limit')
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('x') as target:
        target.write(text)
    return len(text.encode())


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--old-jar', type=Path, required=True)
    parser.add_argument('--new-jar', type=Path, required=True)
    parser.add_argument('--report', type=Path, required=True)
    for key, value in DEFAULTS.items():
        parser.add_argument('--' + key, type=Path, default=value)
    args = parser.parse_args(argv)
    start = time.perf_counter()
    old_jar = new_jar = None
    try:
        if not args.report.is_absolute():
            raise Refusal('report-path-not-absolute')
        if args.report.exists():
            raise Refusal('report-exists')
        hashes = {str(getattr(args, key)): sha256_file(getattr(args, key)) for key in DEFAULTS}
        inputs = {key: json.loads(getattr(args, key).read_text()) for key in DEFAULTS}
        old_jar = Jar(args.old_jar)
        new_jar = Jar(args.new_jar)
        if (old_jar.sha256, new_jar.sha256) != (OLD_SHA256, NEW_SHA256):
            raise Refusal('jar-sha256-mismatch')
        hashes[str(args.old_jar)] = old_jar.sha256
        hashes[str(args.new_jar)] = new_jar.sha256
        result = compare(old_jar, new_jar, inputs)
        elapsed = (time.perf_counter() - start) * 1000
        peak = rss_bytes()
        if elapsed > MAX_SECONDS * 1000:
            raise Refusal('elapsed-limit')
        if peak > MAX_RSS:
            raise Refusal('rss-limit')
        report = {'format': FORMAT, 'result': 'compared', 'inputHashes': hashes,
                  'bridgeCalls': 0, 'nativeCommands': 0, 'vendorClassesInitialized': 0,
                  'writeAuthority': False, 'boundedAdmission': False,
                  **result, 'conditions': CONDITIONS,
                  'elapsedMs': round(elapsed, 3), 'peakRssBytes': peak}
        size = write_report(args.report, report)
    except Refusal as error:
        print(json.dumps({'result': 'refused', 'reason': str(error)}))
        return 2
    finally:
        for jar in (old_jar, new_jar):
            if jar is not None:
                jar.close()
    print(json.dumps({'result': 'compared', 'report': str(args.report), 'reportBytes': size,
                      'summary': report['summary'], 'changed': report['changed'],
                      'elapsedMs': report['elapsedMs'],
                      'peakRssBytes': report['peakRssBytes']}, indent=1))
    return 0


if __name__ == '__main__':
    sys.exit(main())
