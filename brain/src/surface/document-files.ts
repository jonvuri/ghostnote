/**
 * Document files on the server filesystem (8i19, D51). `documentPath` gives a write tool its document from a file;
 * `documentOutputPath` gives a read tool a new file for its document. Then a large document does not pass through
 * the context of the agent. The content sets the input encoding: a FIELDS header or a JSON object.
 */
import { createHash } from 'node:crypto';
import { isAbsolute } from 'node:path';
import { z } from 'zod';
import type { Encoding } from '../document/index.js';
import { LocalFileError, publishNewFile, readRegularFile, requireNewDestination } from '../files/local-file.js';
import { ToolFailure, readbackOrUnavailable, readbackStatusOf, type FailureStage, type Warning } from './agent-native-result.js';

/** R28: UTF-8 document input is at most 8 MiB. */
export const DOCUMENT_FILE_BYTES = 8 * 1024 * 1024;

const absolute = z.string().min(1).refine(isAbsolute, 'Use an absolute path on the Ghostnote server filesystem.');

export const DOCUMENT_FILE_CONVENTION = 'Name FIELDS files .gndoc and JSON files .gndoc.json; the tools do not check the name.';

/** The documentPath statement of the clip write descriptions. */
export const DOCUMENT_PATH_STATEMENT = 'Send the document inline in document, or as a local file in documentPath. The '
  + 'file content sets its encoding; format then sets only the encoding of returned documents. The result has '
  + 'documentFile (path, format, bytes, sha256). With documentPath, a large document does not pass through the '
  + 'conversation: read_launcher_clip and read_midi_file write one with documentOutputPath.';

export const documentPathInput = absolute.optional().describe('Absolute path of a local Ghostnote Document 1.0 file, '
  + 'instead of document. Send exactly one of document and documentPath. The content sets the encoding: a first '
  + `line DOC ghostnote-document 1.0 <kind> is FIELDS; a JSON object is json. At most 8 MiB of UTF-8. ${DOCUMENT_FILE_CONVENTION}`);

export const documentOutputPathInput = absolute.optional().describe('Absolute path of a new local file for the '
  + 'document. The result then has data.documentFile in place of the inline document. The parent directory must exist; '
  + `an existing path refuses with code occupied before any read. ${DOCUMENT_FILE_CONVENTION}`);

/** The facts of one document file in a result. */
export interface DocumentFile {
  readonly path: string;
  readonly format: Encoding;
  readonly bytes: number;
  readonly sha256: string;
}

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

/** The encoding of a document text by its first record, or undefined. Leading white space is skipped. */
export function detectEncoding(text: string): Encoding | undefined {
  const start = text.replace(/^[ \t\r\n]+/, '');
  if (/^DOC[ \t]/.test(start)) return 'fields';
  if (start.startsWith('{')) return 'json';
  return undefined;
}

function fileFailure(error: unknown, stage: FailureStage, role: 'input' | 'output'): unknown {
  if (error instanceof ToolFailure) return error;
  if (error instanceof LocalFileError) {
    if (error.reason === 'too-large') return new ToolFailure('outside-limit', stage, 'The document file is larger than 8 MiB.');
    if (error.reason === 'occupied') {
      return new ToolFailure('occupied', stage, 'The document destination already exists. Use a new filename.');
    }
    if (error.reason === 'changed') {
      return new ToolFailure('target-changed', stage, 'The document file changed during the read.', {
        retryWhen: 'after the file stops changing' });
    }
    return new ToolFailure('invalid-input', stage, role === 'input'
      ? 'documentPath does not name a regular file.' : 'The parent directory of documentOutputPath does not exist.');
  }
  const code = (error as NodeJS.ErrnoException)?.code;
  if (code === 'ENOENT') return new ToolFailure('absent', stage, 'documentPath names no file.');
  if (code === 'ELOOP') return new ToolFailure('unsupported', stage, 'Symbolic links are not supported for document files.');
  if (code === 'EACCES' || code === 'EPERM') {
    return new ToolFailure('unsupported', stage, 'The document path is not accessible to the Ghostnote server.');
  }
  if (code === 'ENOTDIR' || code === 'EISDIR') {
    return new ToolFailure('invalid-input', stage, 'The document path does not name a file in an existing directory.');
  }
  return error;
}

/** Read one document file. Invalid UTF-8 refuses; a BOM stays in the text, and the codec refuses it (R11). */
export async function readDocumentFile(path: string): Promise<{ readonly text: string; readonly file: DocumentFile }> {
  let bytes: Buffer;
  try {
    bytes = await readRegularFile(path, DOCUMENT_FILE_BYTES);
  } catch (error) { throw fileFailure(error, 'input', 'input'); }
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    throw new ToolFailure('invalid-input', 'input', 'The document file is not valid UTF-8.');
  }
  const format = detectEncoding(text);
  if (format === undefined) {
    throw new ToolFailure('invalid-input', 'input', 'The document file starts with neither the FIELDS header '
      + '(DOC ghostnote-document 1.0 <kind>) nor a JSON object.', { detail: { path } });
  }
  return { text, file: { path, format, bytes: bytes.length, sha256: sha256(bytes) } };
}

/** The document of a write tool: inline, or from documentPath. The inline encoding is the format argument. */
export async function documentInput<D>(
  args: { readonly document?: D; readonly documentPath?: string | undefined }, format: Encoding,
): Promise<{ readonly document: D | string; readonly format: Encoding; readonly file?: DocumentFile }> {
  if ((args.document === undefined) === (args.documentPath === undefined)) {
    throw new ToolFailure('invalid-input', 'input', 'Send exactly one of document and documentPath.');
  }
  if (args.documentPath === undefined) return { document: args.document as D, format };
  const { text, file } = await readDocumentFile(args.documentPath);
  return { document: text, format: file.format, file };
}

/** Check documentOutputPath before the read: no host call or conversion runs for a destination that refuses. */
export async function checkDocumentOutput(path: string): Promise<void> {
  try {
    await requireNewDestination(path);
  } catch (error) { throw fileFailure(error, 'input', 'output'); }
}

/** Inject only file IO for failure tests. */
export interface DocumentFileIo {
  readonly publish: (path: string, bytes: Uint8Array) => Promise<void>;
  readonly read: (path: string) => Promise<Buffer>;
}

const LOCAL_IO: DocumentFileIo = {
  publish: (path, bytes) => publishNewFile(path, bytes, '.ghostnote-document-'),
  read: (path) => readRegularFile(path, DOCUMENT_FILE_BYTES),
};

/**
 * Publish the document of a read to a new file, then read the file back independently. A failed publication throws
 * at stage write; a failed readback keeps the file and returns readback status unavailable with its warning.
 */
export async function publishDocumentFile(
  schema: string, path: string, text: string, format: Encoding, io: DocumentFileIo = LOCAL_IO,
): Promise<{ readonly documentFile: DocumentFile & { readonly readback: Record<string, unknown> }; readonly warnings: Warning[] }> {
  const bytes = Buffer.from(text, 'utf8');
  if (bytes.length > DOCUMENT_FILE_BYTES) throw new ToolFailure('outside-limit', 'write', 'The document is larger than 8 MiB.');
  try {
    await io.publish(path, bytes);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    throw code === 'EEXIST'
      ? new ToolFailure('occupied', 'write', 'The document destination already exists. Use a new filename.')
      : fileFailure(error, 'write', 'output');
  }
  const check = await readbackOrUnavailable(schema, 'the document file', () => io.read(path));
  const file = { path, format, bytes: bytes.length, sha256: sha256(bytes) };
  if (!check.ok) return { documentFile: { ...file, readback: check.readback }, warnings: [check.warning] };
  const readback = { status: readbackStatusOf({ applied: true, ...(check.value.equals(bytes) ? {} : { mismatches: ['file-bytes'] }) }),
    sha256: sha256(check.value), bytes: check.value.length };
  return { documentFile: { ...file, readback }, warnings: [] };
}
