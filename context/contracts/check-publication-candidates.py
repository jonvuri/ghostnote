#!/usr/bin/env python3
"""Check or update the 8f3 publication candidate inventory."""
import argparse
import hashlib, json
from pathlib import Path
root=Path(__file__).resolve().parents[2]
out=root/'context/contracts/GHOSTNOTE_PUBLICATION_CANDIDATES.json'
entries=[]
def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def add(path,version,deps,status):
    p=root/path
    if not p.is_file(): raise FileNotFoundError(path)
    entries.append({'path':path,'version':version,'hash':{'algorithm':'sha256','domain':'exact-file-bytes','value':digest(p)},'dependencies':deps,'redistribution':status})
mit='Repository MIT notice required; 9b confirms final package scope.'
fixtures='Generated repository music; MIT. Include the repository notice.'
review='Contains third-party/provider evidence. 9b must review redistribution before release.'
for p in sorted((root/'spec/ghostnote-document-v1').rglob('*')):
    if not p.is_file(): continue
    path=p.relative_to(root).as_posix()
    is_binding='/bindings/' in path or p.name in ('HOST-BINDING.md','IDENTITY-AND-OVERLAYS.md')
    add(path,'ghostnote-binding/1' if is_binding else 'ghostnote-document/1.0',
        ['brain/src/bindings/ghostnote-document.ts','spec/ghostnote-document-v1/SPEC.md'] if is_binding else ['brain/src/document/','LICENSE'],
        fixtures if '/examples/' in path or '/canonical/' in path else mit)
for directory in ('brain/src/document','brain/src/bindings'):
    for p in sorted((root/directory).glob('*.ts')):
        add(p.relative_to(root).as_posix(),'ghostnote-binding/1' if 'bindings' in directory else 'ghostnote-document/1.0',
            ['brain/src/document/','brain/src/contract/'] if 'bindings' in directory else ['ES2022 or later','Node module support','brain/package-lock.json'],mit)
for path in ('context/contracts/GHOSTNOTE_CACHE_CONTRACT.md','context/contracts/GHOSTNOTE_MIGRATION_AND_VERIFICATION.md'):
    add(path,'ghostnote-binding/1',['spec/ghostnote-document-v1/HOST-BINDING.md','spec/ghostnote-document-v1/IDENTITY-AND-OVERLAYS.md','context/plan/phase-8/8g-shadow-project-cache.md','context/plan/phase-8/8h-cache-promotion-and-interface-simplification.md'],mit)
for path in ('LICENSE','brain/package.json','brain/package-lock.json','brain/src/tools/document-artifacts.ts','brain/src/tools/document-standalone-check.ts','context/contracts/check-publication-candidates.py'):
    add(path,'repository snapshot 2026-10-01',['9b package dependency/notice review'],mit)
for path in ('context/evidence/format/FORMAT_BENCHMARK_PRODUCT_REVIEW.md','context/evidence/format/COMPACT_BAR_REPRODUCIBILITY.md','context/evidence/experiments/e209-offline-score-repair-updates-eight-arm-matrix.md','context/evidence/experiments/e213-audit-adjudications-update-native-composite-scoring.md','brain/benchmarks/symbolic-format-v5/runs/2026-09-30-corrected-assessment.json','brain/benchmarks/symbolic-format-v5/corrected_assessment.py','brain/benchmarks/native-composite-v1/audits/adjudicated-assessment.json','brain/benchmarks/native-composite-v1/audits/adjudication-policy.json','brain/benchmarks/native-composite-v1/audits/adjudicated-report.md','brain/benchmarks/native-composite-v1/audits/adjudicated_assessment.py'):
    add(path,'frozen evidence; keep matrix and addendum separate',['brain/benchmarks/symbolic-format-v5/','brain/benchmarks/native-composite-v1/','context/evidence/format/COMPACT_BAR_REPRODUCIBILITY.md'],review)
for directory in ('brain/benchmarks/symbolic-format-v5','brain/benchmarks/native-composite-v1'):
    members=sorted(p for p in (root/directory).rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.suffix!='.pyc')
    rows=[p.relative_to(root/directory).as_posix()+'\0'+digest(p)+'\n' for p in members]
    entries.append({'path':directory+'/','version':'frozen reproduction candidate','hash':{'algorithm':'sha256','domain':'sorted-tree-file-hashes-v1','value':hashlib.sha256(''.join(rows).encode()).hexdigest()},'fileCount':len(members),'dependencies':['Resolve imported benchmark dependencies under 9b; these two roots alone are not a proven reproduction closure.','Python version and optional format executables from each package protocol.'],'redistribution':review})
data={'schema':'ghostnote-publication-candidates/1','updated':'2026-10-01','status':'8f3 review inventory; 8i acceptance and 9b publication review remain required','hashRules':{'exact-file-bytes':'SHA-256 over retained file bytes. This is not the document semantic hash.','sorted-tree-file-hashes-v1':'Sort relative POSIX file paths. SHA-256 over UTF-8 rows: path, NUL, lowercase file-byte SHA-256, LF. Exclude __pycache__ and .pyc. Paths are relative to the candidate root.'},'semanticHashReferences':['spec/ghostnote-document-v1/examples/expected.json','spec/ghostnote-document-v1/MODEL-REFERENCE.identity.json'],'exclusions':['This inventory excludes itself to avoid a self-hash.','No vendor documentation/presets, paid provider reruns, or live project files are approved for redistribution.','8h/8i live acceptance evidence is not available yet.'],'candidates':entries}
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--write', action='store_true', help='Update the owned inventory')
args = parser.parse_args()
expected = json.dumps(data, indent=2) + '\n'
if args.write:
    out.write_text(expected)
    print(f'{len(entries)} publication candidate entries written')
else:
    if out.read_text() != expected:
        raise SystemExit('Publication inventory differs. Review changes, then run with --write.')
    print(f'{len(entries)} publication candidate entries checked')
