export class DocumentError extends Error {
    readonly rule: string;
    readonly path: string;
    readonly field: string;
    readonly line?: number;
    readonly column?: number;
    constructor(rule: string, path: string, reason: string, location?: {
        line: number;
        column: number;
    }) {
        super(`${rule} ${location ? `line ${location.line}:${location.column} ` : ''}${path}: ${reason}`);
        this.name = 'DocumentError';
        this.rule = rule;
        this.path = path;
        this.field = path.split(/[.\[\]]/).filter(Boolean).at(-1) ?? '$';
        this.line = location?.line;
        this.column = location?.column;
    }
}
export function fail(rule: string, path: string, reason: string): never {
    throw new DocumentError(rule, path, reason);
}
