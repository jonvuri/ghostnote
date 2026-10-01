import { fail } from './error.js';
import { validate } from './index.js';
import type { StateDocument } from './model.js';
import { binary64, boundedInteger, cmp, fraction, rational, spelling } from './rational.js';
/** Resolve a local display at nominal onset. No tempo integration is done. */
export function timingDisplay(input: StateDocument, clip: string, nominalAt: string, component: string) {
    const doc = validate(input);
    if (doc.kind === 'patch' || !doc.clips.some(c => c.id === clip))
        fail('R16', '$display.clip', 'display needs a represented clip');
    rational(nominalAt);
    const value = rational(component);
    const points = doc.overlays.filter(o => o.type === 'tempo' && o.state === 'current' && o.data.clip === clip && cmp(o.data.at, nominalAt) <= 0);
    if (!points.length)
        return null;
    points.sort((a, b) => cmp((a.data as any).at, (b.data as any).at));
    const selected = points.at(-1)!;
    const bpm = (selected.data as {
        bpm: number;
    }).bpm, tempo = binary64(bpm);
    const milliseconds = fraction(boundedInteger(boundedInteger(value.n * 60000n) * tempo.d), boundedInteger(value.d * tempo.n));
    return { milliseconds: spelling(milliseconds), bpm, at: nominalAt, dependsOverlays: [selected.id] };
}
