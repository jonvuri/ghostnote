"""Read the retained FIELDS reference and token evidence. No provider call occurs."""
import hashlib
import importlib.util
import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[4]
path = root / 'brain/benchmarks/compact-format-v19/benchmark.py'
spec = importlib.util.spec_from_file_location('ghostnote_8f2_baseline', path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
text = (module.v14.document_grammar('compact-bar-fields')
        + '\n\nFollow this complete output example, but use the task values:\n'
        + module.v14.example_for('compact-bar-fields', 'comprehension-structure'))
sha = lambda text: hashlib.sha256(text.encode()).hexdigest()
result = {
    'source': str(path.relative_to(root)),
    'symbols': ['v14.document_grammar', 'v14.example_for'],
    'family': 'comprehension-structure',
    'scope': 'Retained format instruction plus complete output example. No task or source.',
    'bytes': len(text.encode()),
    'sha256': sha(text),
    'providerTokens': None,
    'providerTokensReason': 'Retained usage covers full task prompts, not this reference slice.',
    'retainedFullPromptUsage': [],
}
for provider in ['openai', 'gemini', 'claude-haiku']:
    source = f'brain/benchmarks/compact-format-v19/runs/2026-09-29-full-{provider}.json'
    run = json.loads((root / source).read_text())
    row = next((row for row in run['results'] if row['arm'] == 'compact-bar-fields'
                and row.get('initial_call') and row['initial_call'].get('usage')), None)
    if row is None:
        result['retainedFullPromptUsage'].append({'provider': provider, 'source': source,
                                                  'inputTokens': None})
        continue
    call = row['initial_call']
    result['retainedFullPromptUsage'].append({
        'provider': provider, 'source': source, 'family': row['family'],
        'variant': row['variant'], 'model': call['returned_model'],
        'promptBytes': call['prompt_bytes'], 'promptSha256': call['prompt_sha256'],
        'inputTokens': call['usage']['input_tokens'],
        'scope': 'One historical full prompt. This count is not a reference-only comparison.',
    })
json.dump(result, sys.stdout, indent=2)
print()
