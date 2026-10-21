"""Read the pinned manifest for derivation and tests. The resolver does not import this module."""
from collections import Counter
import re

from .scan import Refusal, ancestors, descriptor, member_traces, class_trace, CallTraces
from .resolve import unique


PREFIX = {'D.': 'com/bitwig/flt/document/core/master/device/',
          'R.': 'com/bitwig/ramona/core/', 'M.': 'com/bitwig/flt/document/core/master/',
          'S.': 'com/bitwig/ramona/serial/'}
LIBRARY = {x: 'java/util/' + x for x in ('List','UUID','Collection','Stack','Set','Map')}
LIBRARY.update({x: 'java/lang/' + x for x in ('String','Object')})
PRIMITIVE = {'void':'V','boolean':'Z','int':'I','double':'D'}
# Include every extra type guard and the layout class named by the session brief.
EXTRA = ['D.S2E','tqm','D.mvZ','D.WAr','a','D.gOr','D.DbL','dkb','mbe',
         'R.wfl','D.RHk','M.Svr','QY','Hjt','jas','D.NDn','llL']
TYPE_NAMES = {
 'R.HEV':'object','cXV':'descriptor-base','cXZ':'named-base','cYF':'property',
 'cYs':'property-base','cYH':'relationship','cYx':'descriptor','S.vWM':'serialization-filter',
 'D.S2E':'native-device','tqm':'decimal-atom','ccA':'value-base','D.UL':'destination-base',
 'D.mvZ':'destination-atom','D.WAr':'source-atom','a':'source-interface','D.yWH':'source-base',
 'D.gOr':'grid','D.DbL':'module','D.had':'module-base','D.cbl':'container',
 'D.OEf':'device-base','D.XuU':'initialization-helper','qOW':'remote-helper',
 'D.NHx':'grid-base','D.DtR':'position-base','D.QHo':'rectangle-base',
 'R.ikl':'document-object','R.uX1':'context','R.Ibf':'manager','cZl':'edit-document',
 'daR':'journal','cZv':'edit','R.wfl':'edit-lock','D.RHk':'insert-callback',
 'nST':'display-state','Tu':'selection-state','YJr':'selection-base','rez':'focus-base',
 'QAi':'focus-target-base','mbe':'focus-wrapper','dkb':'nitro-atom','R.FZ1':'child-object',
 'M.Ymq':'engine-state-base','M.Svr':'project-root','rjH':'engine-state','cYQ':'connection',
 'Xuo':'boolean-base','QY':'boolean-atom','D.Net':'mapping-source-base',
 'D.NDn':'mapping-source','Hjt':'mapping-target','jas':'transfer','MTu':'domain',
 'TNT':'domain-base','llL':'layout-pass'}


def expand(name):
    for short, full in PREFIX.items():
        if name.startswith(short):
            return full + name[len(short):]
    return LIBRARY.get(name,name)


def jvm(name):
    if name.endswith('[]'):
        return '[' + jvm(name[:-2])
    return PRIMITIVE.get(name) or 'L' + expand(name) + ';'


def manifest_rows(path):
    rows, counts = [], Counter()
    for line in path.read_text().splitlines():
        if not line.startswith('| ') or '`' not in line:
            continue
        cells = [c.strip() for c in line.strip('|').split('|')]
        if len(cells) not in (5,7):
            continue
        title, lookup, member = cells[:3]
        if not member.startswith('`'):
            continue
        role = re.sub('[^a-z0-9]+','-',title.lower()).strip('-')
        counts[role] += 1
        if counts[role] > 1:
            role += '-' + str(counts[role])
        member = member.strip('`')
        left, result = member.split(': ')
        if '(' in left:
            name, args = left.split('(',1)
            args = args.rstrip(')')
            desc = '(' + ''.join(jvm(a) for a in args.split(',') if a) + ')' + jvm(result)
            kind = 'method'
        else:
            name, desc, kind = left, jvm(result), 'field'
        rows.append({'role': role,'lookup':expand(lookup),'name':name,'descriptor':desc,
                     'kind':kind,'liveInvariant':cells[4] if len(cells)==7 else cells[3]})
    if not rows:
        raise Refusal('empty-manifest')
    return rows


def pinned(jar, rows):
    result = []
    for row in rows:
        found = []
        for name in ancestors(jar.classes, row['lookup']):
            c = jar.classes[name]
            pool = c.methods if row['kind'] == 'method' else c.fields
            matches = [m for m in pool if m.name == row['name'] and m.desc == row['descriptor']]
            if matches:
                found = [(name,m) for m in matches]
                break
        owner, m = unique(found,row['role'])
        result.append({k:row[k] for k in ('role','lookup','kind','name','descriptor')} |
                      {'declaring':owner,'flags':m.flags})
    return result


def derive(jar, source_rows):
    expected = pinned(jar, source_rows)
    names = set(expand(n) for n in EXTRA)
    for row in expected:
        names.update((row['lookup'],row['declaring']))
        names.update(n for n in re.findall('L([^;]+);',row['descriptor']) if n in jar.classes)
    labels = {expand(k):v for k,v in TYPE_NAMES.items()}
    missing = names - labels.keys()
    if missing:
        raise Refusal('unlabelled-dependencies:' + str(sorted(missing)))
    types = {labels[n]:{'shape':jar.keys[n], 'fieldCount':len(jar.classes[n].fields),
                       'methodCount':len(jar.classes[n].methods)} for n in sorted(names,key=lambda n:labels[n])}
    counts = Counter(jar.keys.values())
    for n in names:
        if counts[jar.keys[n]] > 1:
            types[labels[n]]["codeTrace"] = class_trace(jar.code(n), jar.keys)
    traces, members = {}, []
    calls = CallTraces(jar)
    for source, row in zip(source_rows,expected):
        owner = row['declaring']
        if owner not in traces:
            traces[owner] = member_traces(jar.code(owner),jar.keys)
        key = traces[owner][0 if row['kind']=='method' else 1][(row['name'],row['descriptor'])]
        members.append({'role':row['role'],'lookupType':labels[row['lookup']],
                        'declaringType':labels[owner],'kind':row['kind'],'flags':row['flags'],
                        'shape':descriptor(row['descriptor'],lambda n:jar.keys.get(n,n)),
                        'signature':re.sub('L([^;]+);',lambda m:'@'+labels[m[1]]+';' if m[1] in labels else m[0],row['descriptor']),
                        'trace':key, 'liveInvariant':source['liveInvariant']})
        peers = traces[owner][0 if row['kind']=='method' else 1]
        reference = {'members':'insert-body','current-document-edit':'associate-edit'}.get(row['role'])
        if reference:
            members[-1]['referencedBy'] = reference
        elif list(peers.values()).count(key) > 1 and row['kind'] == 'method':
            runtime = {'native-value-setter':'tqm','boolean-command':'QY','members':'D.gOr'}.get(row['role'])
            if runtime:
                members[-1]['dispatchType'] = labels[expand(runtime)]
            members[-1]['callTrace'] = calls.trace(owner,row['name'],row['descriptor'],receiver=expand(runtime) if runtime else None)
    relationships = [(labels[a],labels[b]) for a in names for b in names if a!=b
                     and b in set(ancestors(jar.classes,a))]
    return {'format':1,'selector':'name-free-class-shape-and-normalized-use-trace-v1',
            'types':types,'members':members,'assignable':sorted(relationships),
            'distinct':[['project-root','edit-document']], 'writeAuthority':False}, expected
