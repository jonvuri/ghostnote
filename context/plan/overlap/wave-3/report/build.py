#!/usr/bin/env python3
"""Build the static report from the checked wave-3 records. Use --check to verify it."""
import hashlib
import html
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import quote, unquote, urlsplit

HERE = Path(__file__).resolve().parent
WAVE = HERE.parent
ROOT = HERE.parents[4]
DATA = WAVE / 'data/records.json'
OUTPUT = WAVE / 'report.html'
esc = html.escape
D = json.loads(DATA.read_text())
AREAS = {
    'session-and-mixing': 'Session and mixing',
    'clips-and-arrangement': 'Clips and arrangement',
    'devices-and-parameters': 'Devices and parameters',
    'modulation-and-presets': 'Modulation and presets',
    'grid-and-internal-access': 'Grid and internal access',
    'media-and-analysis': 'Media and analysis',
    'cross-cutting': 'Shared contracts',
    'delivery': 'Delivery and release',
}
VERBS = list(D['verbs'])
ROWS = {r['key']: r for r in D['rows']}
WORK = {w['id']: w for w in D['workRecords']}
CELLS = {(c['row'], c['verb']): c for c in D['cells']}
# Count recorded capability cells, not negative inspection results.
PROJECT_DENSITY = {p: sum(c['project'] == p and c['proof']['level'] != 'Not found'
                          for c in D['externalCells']) for p in D['projects']}
PROJECTS = sorted(D['projects'], key=lambda p: (-PROJECT_DENSITY[p], p.casefold()))
PINS = {r['name']: r for r in json.loads((ROOT / 'context/evidence/data/overlap-audit/offline-results.json').read_text())['repositories']}
EVIDENCE = {}
for folder, prefix in [('context/evidence/experiments', 'E'), ('context/decisions', 'D')]:
    for p in (ROOT / folder).glob('*.md'):
        m = re.match(r'([ed]\d+[a-z]*)-', p.name)
        if m:
            EVIDENCE[m[1].upper()] = p


def local(path, label=None):
    return f'<a href="{esc(quote(os.path.relpath(path, WAVE), safe="/#"))}">{esc(label or path.name)}</a>'


def source(value):
    if value.upper() in EVIDENCE:
        return local(EVIDENCE[value.upper()], value)
    if value.startswith('https://'):
        return f'<a href="{esc(value)}">{esc(value)}</a>'
    match = re.match(r'^(.*?)(?::(\d+))?$', value)
    path, line = match.groups()
    if path.startswith('reference/'):
        parts = path.split('/', 2)
        if len(parts) == 3 and parts[1] in PINS:
            pin = PINS[parts[1]]
            origin = pin['origin'].replace('git@github.com:', 'https://github.com/').removesuffix('.git')
            url = origin + '/blob/' + pin['commit'] + '/' + quote(parts[2]) + (f'#L{line}' if line else '')
            return f'<a href="{esc(url)}">{esc(value)}</a>'
    p = ROOT / path
    if p.exists():
        return local(p, value)
    return esc(value)


def rich(value):
    """Link record and evidence IDs in retained text. Keep other text unchanged."""
    return re.sub(r'\b(?:E\d+[a-z]*|D\d+|(?:SM|CA|DP|MP|GI|MA|DL)-\d+)\b',
                  lambda m: ref(m[0]) if m[0] in WORK else source(m[0]), esc(value))


def ref(key):
    return f'<a href="#work-{key}">{key}</a>'


def refs(keys):
    return ', '.join(ref(k) for k in keys) or 'None recorded'


def proof(p):
    return esc(p['level'] + (f" {p['build']}" if p.get('build') else ''))


def badge(status):
    return f'<span class="status {status.lower()}">{status}</span>'


def cell_id(c, external=False):
    return ('ext-' + c['project'] + '-' if external else 'gn-') + c['row'] + '-' + c['verb']


def cell_link(c, external=False, verb=False):
    label = f'<span class="cell-verb">{esc(c["verb"])}</span>' if verb else ''
    body = ('' if external else badge(c['status'])) + label + f'<span class="proof">{proof(c["proof"])}</span>'
    return f'<a class="cell-link" data-verb="{c["verb"]}" href="#{cell_id(c, external)}">{body}</a>'


def detail(c, external=False):
    key = cell_id(c, external)
    who = c['project'] if external else 'Ghostnote'
    fields = []
    if c.get('qualifier'):
        fields.append(('Scope', rich(c['qualifier'])))
    fields += [('Path', source(c.get('path', '')) or 'Planning marker; see the linked work record.'),
               ('Success predicate', rich(c.get('predicate', '')) or 'Not yet established.'),
               ('Limiting counterexample', rich(c.get('counterexample', '')) or 'Not yet established; see the required proof.')]
    if c.get('limits'):
        fields.append(('Preservation and other limits', rich(c['limits'])))
    if external:
        fields += [('Register note', rich(c['evidenceNote'])), ('Pin and terms', esc(D['projects'][c['project']]))]
    else:
        fields += [('Evidence', ' · '.join(source(x) for x in c['proof']['evidence'])),
                   ('Related work', refs(w['id'] for w in D['workRecords'] if {'row': c['row'], 'verb': c['verb']} in w['cells']))]
    return f'<details id="{key}" class="evidence-cell" data-kind="{"external" if external else "ghostnote"}"><summary>{esc(who)} · <code>{esc(c["row"])}</code> · {c["verb"]} {"" if external else badge(c["status"])} <span class="proof">{proof(c["proof"])}</span></summary><dl>' + ''.join(f'<dt>{a}</dt><dd>{b}</dd>' for a,b in fields) + '</dl><p><a href="#' + ('compare' if external else 'coverage') + '">Back to matrix</a></p></details>'


def table(headers, rows, cls=''):
    scroll = 'table-scroll matrix-scroll' if 'matrix' in cls else 'table-scroll'
    access = ' tabindex="0" role="region" aria-label="Capability matrix; scroll to compare rows and columns"' if 'matrix' in cls else ''
    return '<div class="' + scroll + '"' + access + '><table class="' + cls + '"><thead><tr>' + ''.join(f'<th scope="col">{h}</th>' for h in headers) + '</tr></thead><tbody>' + ''.join(rows) + '</tbody></table></div>'


def disposition(w):
    if w['id'] == 'DL-6':
        return 'Completed here: reference correction. Baseline status retained.'
    if w['status'] == 'Planned':
        return 'Keep existing owner; compare when to run it.'
    if w['status'] == 'Unresolved':
        return 'Keep visible; settle route or scope before a brief.'
    if w['status'] == 'Component':
        return 'Compare public exposure; component is not a normal tool.'
    return 'Compare as an option; no implementation selected.'


def build():
    pieces = {}
    pieces['COUNTS'] = f'{len(ROWS)} rows · {len(CELLS)} Ghostnote cells · {len(D["externalCells"])} external cells · {len(WORK)} work records'
    pieces['DIGEST'] = hashlib.sha256(DATA.read_bytes()).hexdigest()
    pieces['AREA_OPTIONS'] = ''.join(f'<option value="{k}">{v}</option>' for k,v in AREAS.items() if k != 'delivery')
    pieces['STATUS_OPTIONS'] = ''.join(f'<option>{s}</option>' for s in D['statuses'])
    pieces['PROOF_OPTIONS'] = ''.join(f'<option>{s}</option>' for s in D['proofLevels'])
    pieces['VERB_OPTIONS'] = ''.join(f'<option>{v}</option>' for v in VERBS)
    pieces['LEGEND'] = ''.join(f'<div>{badge(s)} <span>{esc(t)}</span></div>' for s,t in D['statuses'].items())
    pieces['PROOF_LEGEND'] = ''.join(f'<dt>{s}</dt><dd>{esc(t)}</dd>' for s,t in D['proofLevels'].items())
    pieces['VERB_LEGEND'] = ''.join(f'<dt>{v}</dt><dd>{esc(t)}</dd>' for v,t in D['verbs'].items())
    bars = []
    max_n = max(sum(ROWS[c['row']]['area'] == a for c in D['cells']) for a in AREAS)
    for a, label in AREAS.items():
        cells = [c for c in D['cells'] if ROWS[c['row']]['area'] == a]
        if not cells:
            continue
        counts = {s: sum(c['status'] == s for c in cells) for s in D['statuses']}
        bars.append(f'<div class="bar-row"><strong>{label}</strong><div class="bar" role="img" aria-label="{esc(label)}: ' + '; '.join(f'{s} {n}' for s,n in counts.items()) + '">' + ''.join(f'<span class="{s.lower()}" style="width:{100*n/max_n:.3f}%">{n}</span>' for s,n in counts.items() if n) + '</div><div class="bar-labels">' + ' · '.join(f'{s} {n}' for s,n in counts.items() if n) + '</div></div>')
    pieces['BARS'] = ''.join(bars)
    proof_rows = []
    for s in D['statuses']:
        proof_rows.append('<tr><th scope="row">' + badge(s) + '</th>' + ''.join(f'<td>{sum(c["status"] == s and c["proof"]["level"] == p for c in D["cells"])}</td>' for p in D['proofLevels']) + '</tr>')
    pieces['PROOF_TABLE'] = table(['Ghostnote cell status'] + list(D['proofLevels']), proof_rows)
    gn_rows = []
    ext_rows = []
    for r in D['rows']:
        rcells = [c for c in D['cells'] if c['row'] == r['key']]
        label = f'<strong>{esc(r["object"])}</strong><span class="row-aspect">{esc(r["aspect"])}</span><code>{r["key"]}</code>'
        attrs = f'data-area="{r["area"]}" data-search="{esc((r["key"]+" "+r["object"]+" "+r["aspect"]).lower())}"'
        gn_rows.append(f'<tr {attrs} data-cells="{esc(json.dumps([{ "status": c["status"], "proof": c["proof"]["level"] } for c in rcells]))}"><th scope="row">{label}</th>' + ''.join('<td>' + (cell_link(CELLS[(r['key'],v)]) if (r['key'],v) in CELLS else '<span class="empty">—</span>') + '</td>' for v in VERBS) + '</tr>')
        columns = ['<td data-project="Ghostnote">' + ''.join(cell_link(c, verb=True) for c in rcells) + ('<span class="empty">—</span>' if not rcells else '') + '</td>']
        for project in PROJECTS:
            found = [c for c in D['externalCells'] if c['row'] == r['key'] and c['project'] == project]
            columns.append(f'<td data-project="{project}">' + ''.join(cell_link(c, True, True) for c in found) + ('<span class="empty">—</span>' if not found else '') + '</td>')
        ext_rows.append(f'<tr {attrs}><th scope="row">{label}</th>' + ''.join(columns) + '</tr>')
    pieces['GHOSTNOTE_MATRIX'] = table(['Capability'] + VERBS, gn_rows, 'matrix ghostnote-matrix')
    headers = ['Capability', '<span class="project-name" data-project="Ghostnote">Ghostnote</span>'] + [
        f'<span class="project-name" data-project="{p}">{p}</span>'
        f'<span class="density" aria-label="{PROJECT_DENSITY[p]} recorded capability cells">{PROJECT_DENSITY[p]}</span>'
        for p in PROJECTS]
    pieces['EXTERNAL_MATRIX'] = table(headers, ext_rows, 'matrix external-matrix')
    pieces['PROJECT_CHECKS'] = ''.join(f'<label><input type="checkbox" value="{p}" checked> {p}</label>' for p in PROJECTS)
    pieces['CELL_DETAILS'] = ''.join(detail(c) for c in D['cells']) + ''.join(detail(c, True) for c in D['externalCells'])
    records = []
    edges = []
    for w in D['workRecords']:
        refs_html = ', '.join(f'<a href="#gn-{c["row"]}-{c["verb"]}">{c["row"]} · {c["verb"]}</a>' for c in w['cells']) or 'Delivery record; no capability cells.'
        records.append(f'<details class="work-record" id="work-{w["id"]}" data-search="{esc((w["id"]+" "+w["title"]+" "+w["owner"]+" "+w["effortDriver"]).lower())}"><summary><strong>{w["id"]}</strong><span>{esc(w["title"])}</span>{badge(w["status"])}<span class="proof">{proof(w["proof"])}</span></summary><p class="disposition">{disposition(w)}</p><dl>' + ''.join(f'<dt>{a}</dt><dd>{b}</dd>' for a,b in [
            ('Scope', rich(w['qualifier']) or 'No additional qualifier.'), ('Cells', refs_html),
            ('Source route', rich(w['sourceRoute'])), ('Evidence', ' · '.join(source(x) for x in w['proof']['evidence'])),
            ('Required proof or decision', rich(w['requiredProof'])), ('Existing owner', rich(w['owner'])),
            ('Prerequisites', refs(w['prerequisites'])), ('Enabling inputs', refs(w['enabling'])),
            ('Effort driver', esc(D['effortDrivers'][w['effortDriver']])),
            ('Estimate', 'Unmeasured. The work shape is not a duration estimate.')]) + '</dl></details>')
        if w['prerequisites'] or w['enabling']:
            edges.append(f'<tr><th scope="row">{ref(w["id"])} {esc(w["title"])}</th><td>{refs(w["prerequisites"])}</td><td>{refs(w["enabling"])}</td></tr>')
    pieces['RECORDS'] = ''.join(records)
    pieces['EDGES'] = table(['Work record', 'Must come first', 'Can help; not required'], edges)
    sources = []
    for project in PROJECTS:
        cells = [c for c in D['externalCells'] if c['project'] == project]
        pcounts = ' · '.join(f'{p}: {sum(c["proof"]["level"] == p for c in cells)}' for p in D['proofLevels'] if any(c['proof']['level'] == p for c in cells))
        if project in PINS:
            p = PINS[project]
            url = p['origin'].replace('git@github.com:', 'https://github.com/').removesuffix('.git') + '/tree/' + p['commit']
            pin = f'<a href="{url}"><code>{p["commit"]}</code></a>'
        else:
            pin = 'No clone. Release claim only.'
        rowlinks = ', '.join(f'<a href="#{cell_id(c, True)}">{c["row"]} · {c["verb"]}</a>' for c in cells)
        sources.append(f'<details id="source-{project}"><summary><strong>{project}</strong> <span class="proof">{pcounts}</span></summary><p>{esc(D["projects"][project])}</p><p>{pin}</p><p>{rowlinks}</p></details>')
    pieces['SOURCES'] = ''.join(sources)
    tools = json.loads((ROOT / 'context/evidence/data/phase9b-doctor/9b7-tool/descriptions-v53.json').read_text())
    pieces['TOOLS'] = '<p>' + ' · '.join(f'<code>{esc(t["name"])}</code>' for t in tools) + '</p>'
    template = (HERE / 'template.html').read_text()
    for key, value in pieces.items():
        template = template.replace('{{' + key + '}}', value)
    assert not re.search(r'\{\{\w+\}\}', template), 'unfilled report placeholder'
    return template


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.links = []
        self.duplicate_ids = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            if attrs['id'] in self.ids:
                self.duplicate_ids.append(attrs['id'])
            self.ids.add(attrs['id'])
        if tag == 'a' and 'href' in attrs:
            self.links.append(attrs['href'])


def validate(report):
    parsed = Links()
    parsed.feed(report)
    assert not parsed.duplicate_ids, parsed.duplicate_ids
    for href in parsed.links:
        url = urlsplit(href)
        if url.scheme:
            assert url.scheme == 'https', href
        elif not url.path:
            assert unquote(url.fragment) in parsed.ids, href
        else:
            assert (WAVE / unquote(url.path)).exists(), href
    expected = {f'work-{w["id"]}' for w in D['workRecords']}
    expected |= {cell_id(c) for c in D['cells']}
    expected |= {cell_id(c, True) for c in D['externalCells']}
    assert expected <= parsed.ids, expected - parsed.ids
    assert len([x for x in parsed.ids if re.match(r'work-(SM|CA|DP|MP|GI|MA|DL)-\d+$', x)]) == len(WORK)
    assert len([x for x in parsed.ids if x.startswith('gn-') and x.endswith(tuple('-' + v for v in VERBS))]) == len(CELLS)
    assert len([x for x in parsed.ids if x.startswith('ext-') and x.endswith(tuple('-' + v for v in VERBS))]) == len(D['externalCells'])
    assert len(json.loads((ROOT / 'context/evidence/data/phase9b-doctor/9b7-tool/descriptions-v53.json').read_text())) == D['baseline']['toolCount']
    version = re.search(r"TOOL_DESCRIPTION_VERSION = '([^']+)'", (ROOT / 'brain/src/surface/description-cohort.ts').read_text())[1]
    assert version == D['baseline']['descriptionVersion']
    print(f'Validated {len(WORK)} dispositions, {len(CELLS)} Ghostnote cells, {len(D["externalCells"])} external cells, and {len(parsed.links)} links.')


if __name__ == '__main__':
    subprocess.run([sys.executable, '-I', str(WAVE / 'data/check_records.py')], check=True, stdout=subprocess.DEVNULL)
    result = build()
    validate(result)
    if '--check' in sys.argv:
        assert OUTPUT.read_text() == result, 'Report is stale. Run report/build.py.'
        print('Report is current.')
    else:
        OUTPUT.write_text(result)
        print(f'Wrote {OUTPUT}')
