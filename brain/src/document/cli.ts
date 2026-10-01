import { readFileSync, statSync } from 'node:fs';
import { parse, serialize, contentHash, DocumentError, LIMITS, type Encoding } from './index.js';
const [command, from, toOrFile, file] = process.argv.slice(2);
function encoding(value: string | undefined): Encoding {
    if (value !== 'fields' && value !== 'json')
        throw new Error('Encoding must be fields or json');
    return value;
}
async function input(path: string | undefined): Promise<Buffer> {
    if (path) {
        if (statSync(path).size > LIMITS.bytes)
            throw new DocumentError('R28', '$', 'input exceeds 8 MiB');
        return readFileSync(path);
    }
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of process.stdin) {
        size += chunk.length;
        if (size > LIMITS.bytes)
            throw new DocumentError('R28', '$', 'input exceeds 8 MiB');
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}
try {
    if (command !== 'validate' && command !== 'convert')
        throw new Error('Usage: document validate <encoding> [file] | convert <from> <to> [file]');
    const source = encoding(from), target = command === 'convert' ? encoding(toOrFile) : undefined;
    const doc = parse(await input(command === 'convert' ? file : toOrFile), source);
    if (target)
        process.stdout.write(serialize(doc, target));
    else
        process.stdout.write(JSON.stringify({ valid: true, kind: doc.kind, sha256: contentHash(doc) }) + '\n');
}
catch (error) {
    const e = error instanceof Error ? error : new Error(String(error));
    process.stderr.write(JSON.stringify({ valid: false, message: e.message, ...(e instanceof DocumentError ? { rule: e.rule, path: e.path, field: e.field, line: e.line, column: e.column } : {}) }) + '\n');
    process.exitCode = 1;
}
