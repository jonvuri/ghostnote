export const REFERENCE_SECTIONS = ['Core', 'Patch', 'Timing overlays', 'Groups', 'Meter and tempo'] as const;
export type ReferenceSection = typeof REFERENCE_SECTIONS[number];
/** Select maintained reference sections. Core is always included. */
export function modelReference(source: string, sections: ReferenceSection[] = []): string {
    const pieces = source.split(/(?=^## )/m), intro = pieces.shift()!;
    const selected = new Set<ReferenceSection>(['Core', ...sections]);
    for (const section of selected)
        if (!REFERENCE_SECTIONS.includes(section))
            throw new Error(`Unknown reference section: ${section}`);
    return (intro + pieces.filter(piece => selected.has(piece.split('\n')[0].slice(3) as ReferenceSection)).join('')).trimEnd() + '\n';
}
