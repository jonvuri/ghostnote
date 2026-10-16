/** Inline MIDI tools. These tools do not connect to Bitwig. */
import { createHash } from 'node:crypto';
import { isAbsolute } from 'node:path';
import { z } from 'zod';
import { parse, validate, serialize, contentHash, DocumentError, type Encoding } from '../document/index.js';
import { importMidi, exportMidi, MIDI_CONVERSION_VERSION } from '../midi/conversion.js';
import { readMidiBytes, publishMidi, fileError } from '../midi/files.js';
import { MidiError, MIDI_LIMITS } from '../midi/smf.js';
import { ToolFailure, failureResult, readbackOrUnavailable, readbackStatusOf } from './agent-native-result.js';
import { repairOf } from './document-help.js';
import {
  DOCUMENT_FILE_CONVENTION, checkDocumentOutput, documentInput, documentOutputPathInput, documentPathInput, publishDocumentFile,
  type DocumentFile,
} from './document-files.js';
import type { ToolSpec } from './tools.js';

const READ_SCHEMA = 'ghostnote-midi-file-read/1', WRITE_SCHEMA = 'ghostnote-midi-file-write/1';
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const path = z.string().min(1).refine(isAbsolute, 'Use an absolute path on the Ghostnote server filesystem.');
const bpm = z.number().positive().max(1000);
const readInput = z.object({ path: path.describe('Absolute path of the local .mid or .midi file.'),
  targetBpm: bpm.optional().describe('Preserve elapsed time at this constant BPM. For a transcription encoded at 60 BPM of a 120 BPM song, use 120: beat positions and durations double. Omit to preserve source beats.'),
  documentOutputPath: documentOutputPathInput }).strict();
const writeInput = z.object({ path: path.describe('Absolute path for a new .mid or .midi file. The parent directory must exist; an existing path refuses.'),
  document: z.union([z.string().min(1), z.record(z.string(), z.unknown())]).optional().describe('Complete Ghostnote Document 1.0 FIELDS text or JSON object, including a read_launcher_clip snapshot with explicit MIDI field coverage. One CLIP becomes one MIDI track. Use get_document_reference for syntax.'),
  documentPath: documentPathInput,
  format: z.enum(['fields', 'json']).optional().describe('Encoding of the inline document. Default fields; a native JSON object requires json. Omit it with documentPath.'),
  bpm: bpm.optional().describe('Export tempo in BPM. This changes playback speed, not note beat positions. Without it, use current tempo overlays or the MIDI default 120 BPM. Replacing tempo overlays requires acceptLoss.'),
  acceptLoss: z.boolean().optional().describe('After reviewing a refusal detail.losses, allow those unsupported document fields to be omitted. Default false. Timing, tempo, and release-velocity rounding are always reported.') }).strict();

/** `source` is the input document of a write: a codec refusal then keeps its line and the known repair, as in the clip writers. */
function refused(schema: string, stage: 'input' | 'acquire' | 'write', error: unknown, path: string,
  source?: { readonly text: string; readonly format: Encoding }) {
  error = fileError(error);
  if (error instanceof MidiError) error = new ToolFailure(error.code, stage, error.message, { detail: error.detail as Record<string, unknown> | undefined });
  else if (error instanceof DocumentError) {
    const repair = source === undefined ? undefined : repairOf(error, source.text, source.format, 'add');
    error = new ToolFailure(error.rule === 'R28' ? 'outside-limit' : 'invalid-input', 'input', error.message, { detail: {
      rule: error.rule, path: error.path,
      ...(error.line === undefined ? {} : { line: error.line, column: error.column }),
      ...(repair === undefined ? {} : { repair }) } });
  }
  else if ((error as NodeJS.ErrnoException)?.code === 'EEXIST') error = new ToolFailure('occupied', 'write', 'The destination already exists. Use a new filename.');
  return failureResult(schema, stage, error, { path });
}

export async function readMidiFile(args: z.infer<typeof readInput>) {
  let stage: 'input' | 'acquire' | 'write' = 'input';
  try {
    if (args.documentOutputPath !== undefined) await checkDocumentOutput(args.documentOutputPath);
    stage = 'acquire';
    const bytes = await readMidiBytes(args.path), { document, report } = importMidi(bytes, args);
    const text = serialize(document, 'fields');
    stage = 'write';
    const output = args.documentOutputPath === undefined ? undefined
      : await publishDocumentFile(READ_SCHEMA, args.documentOutputPath, text, 'fields');
    return { schema: READ_SCHEMA, source: { path: args.path, sha256: hash(bytes), bytes: bytes.length, version: MIDI_CONVERSION_VERSION },
      target: { path: args.path }, coverage: { status: 'complete', clips: document.clips.length, notes: document.events.length },
      authority: { kind: 'file-conversion', documentSha256: contentHash(document) },
      data: output === undefined ? { format: 'fields', document: text, documentBytes: Buffer.byteLength(text), report }
        : { format: 'fields', documentFile: output.documentFile, report },
      warnings: [
        ...(output?.warnings ?? []),
        ...(report.ignored.length ? [{ code: 'midi-data-omitted', message: 'Some source MIDI data has no document mapping. See data.report.ignored. Sustain and other controller effects are not applied to note lengths.' }] : []),
        ...(report.overlappingNoteOns ? [{ code: 'midi-fifo-pairing', message: 'Overlapping same-pitch notes use FIFO pairing: each note-off closes the earliest open note on its track and channel. MIDI carries no note identity.' }] : []),
      ] };
  } catch (error) { return refused(READ_SCHEMA, stage, error, args.path); }
}

/** Inject only file IO for failure tests. The public tool always uses the local filesystem. */
export async function writeMidiFile(args: z.infer<typeof writeInput>, io = { publish: publishMidi, read: readMidiBytes }) {
  let stage: 'input' | 'write' = 'input';
  let source: { text: string; format: Encoding } | undefined;
  try {
    if (args.documentPath !== undefined && args.format !== undefined) {
      throw new MidiError('invalid-input', 'Omit format with documentPath: the file content sets the encoding.');
    }
    const input = await documentInput(args, args.format ?? 'fields'), format: Encoding = input.format;
    if (typeof input.document !== 'string' && format !== 'json') throw new MidiError('invalid-input', 'A document object requires format: json.');
    source = { text: typeof input.document === 'string' ? input.document : JSON.stringify(input.document), format };
    const document = typeof input.document === 'string' ? parse(input.document, format) : validate(input.document);
    const { bytes, report } = exportMidi(document, args), sha256 = hash(bytes);
    stage = 'write'; await io.publish(args.path, bytes);
    const check = await readbackOrUnavailable(WRITE_SCHEMA, 'the MIDI file', () => io.read(args.path));
    const readback = check.ok ? { status: readbackStatusOf({ applied: true,
      ...(check.value.equals(bytes) ? {} : { mismatches: ['file-bytes'] }) }), sha256: hash(check.value), bytes: check.value.length } : check.readback;
    return { schema: WRITE_SCHEMA, applied: true, effects: [],
      file: { path: args.path, sha256, bytes: bytes.length, reversible: false }, readback, report,
      ...(input.file === undefined ? {} : { documentFile: input.file satisfies DocumentFile }),
      warnings: [
        ...(report.losses.length ? [{ code: 'document-data-omitted', message: 'The accepted omissions are in report.losses.' }] : []),
        ...(report.rounding.length ? [{ code: 'midi-values-rounded', message: 'MIDI metadata or release velocity was rounded. See report.rounding.' }] : []),
        ...(!check.ok ? [check.warning] : []),
      ] };
  } catch (error) { return refused(WRITE_SCHEMA, stage, error, args.path, source); }
}

const LIMITS_TEXT = 'Limits: 8 MiB, 16,384 notes, 256 source tracks, and 262,144 MIDI events; dense overlap reports have the Document 1.0 bound. A limit refuses the whole call. ';
export const MIDI_FILE_TOOLS: readonly ToolSpec[] = [{
  name: 'read_midi_file', kind: 'read', title: 'Read a MIDI file as a document', emits: [],
  description: 'Profile agent-native-v1. Read a local Standard MIDI File as a complete Ghostnote Document 1.0 FIELDS desired document, inline in data.document. '
    + 'With documentOutputPath, write the document to that new file instead: data.documentFile has path, format, bytes, sha256, and readback.status (verified, differs, or unavailable), and the result holds no inline document. '
    + 'A large transcription is tens of thousands of tokens inline; prefer documentOutputPath when a script processes the notes, then give the file to add_launcher_clip or edit_launcher_clip with documentPath. '
    + 'Use get_document_reference for format syntax. Each musical track becomes one CLIP; channels are 1 to 16. Keep leading silence and source beat coordinates by default. '
    + 'targetBpm preserves elapsed time through the source tempo map and maps it to the requested constant BPM before normalization. '
    + 'Onsets floor to 1/512 beat; durations round to nearest, ties up, with a one-cell minimum. Report counts in data.report; no per-note diagnostic expansion. '
    + 'Preserve notes, release velocity, names, and tempo/meter overlays. Program changes, controllers (including sustain), pitch bend, pressure, and other unsupported events are omitted and counted. '
    + 'No musical analysis or excerpts. No loop is inferred. Note-offs close the earliest open note of the same track, channel, and pitch (FIFO); overlapping note-ons are counted and warned. Format 2, SMPTE timing, unmatched notes, and normalized note collisions refuse. '
    + LIMITS_TEXT + 'This tool makes no Bitwig call or project change. Paths are on the server filesystem; input symlinks refuse. '
    + `An existing documentOutputPath refuses with code occupied before the MIDI read; the document file has no change ID and cannot use revert_change. ${DOCUMENT_FILE_CONVENTION}`,
  inputSchema: readInput.shape, inputValidator: readInput,
  resultContract: { schema: READ_SCHEMA, profile: 'agent-native-v1', version: MIDI_CONVERSION_VERSION,
    envelope: ['schema', 'source', 'target', 'coverage', 'authority', 'data', 'warnings'],
    data: ['format', 'document', 'documentBytes', 'documentFile', 'report'], limits: MIDI_LIMITS },
  run: (_workspace, input) => readMidiFile(input as z.infer<typeof readInput>),
}, {
  name: 'write_midi_file', kind: 'write', title: 'Write a document to a new MIDI file', emits: [],
  description: 'Profile agent-native-v1. Write a complete Ghostnote Document 1.0 FIELDS or JSON document to a new local MIDI file. '
    + 'Send the document inline in document, or as a local file in documentPath (the content sets the encoding; the result then has documentFile with path, format, bytes, and sha256). '
    + "This is Ghostnote's own format. Use get_document_reference for syntax. Accept a desired document or a snapshot from read_launcher_clip unchanged. Require complete full-clip coverage on all 16 channels for id, clip, at, duration, pitch, velocity, channel, mute, and releaseVelocity; an explicit field list is valid. Other unobserved fields stay unknown. Patches or missing required coverage refuse, even with acceptLoss. "
    + 'Write format 1, one track per CLIP plus a global tempo/meter track, at 512 ticks per quarter note. Realized note timing is exact. '
    + 'Current tempo/meter overlays supply global metadata; conflicting maps refuse. With no tempo at zero, use 120 BPM. bpm changes playback tempo without rescaling beat coordinates. '
    + 'Report rounded metadata and release velocity. Unsupported nondefault fields, loops, other overlays, muted or zero-velocity notes, and note tails past clip length require acceptLoss: true after reviewing detail.losses. '
    + 'Muted and zero-velocity notes are omitted on accepted loss. Same-pitch overlaps use FIFO pairing. Nested note ends or same-pitch overlaps across tracks refuse; no note is shortened. At most 255 clips. '
    + LIMITS_TEXT + 'The parent directory must exist. Existing destinations, including symlinks, refuse with occupied; use a new filename. '
    + 'Publication is atomic and does not replace a file. The result has applied, file, report, and readback.status (verified, differs, or unavailable). '
    + 'A failed verification keeps applied: true; do not repeat the write. This filesystem effect has no project change ID and cannot use revert_change; effects is empty. No Bitwig connection is needed.',
  inputSchema: writeInput.shape, inputValidator: writeInput,
  resultContract: { schema: WRITE_SCHEMA, profile: 'agent-native-v1', version: MIDI_CONVERSION_VERSION,
    envelope: ['schema', 'applied', 'effects', 'file', 'readback', 'report', 'documentFile', 'warnings'],
    file: ['path', 'sha256', 'bytes', 'reversible'], readbackStatus: ['verified', 'differs', 'unavailable'],
    effects: 'filesystem-only; no project change ID or revert', limits: MIDI_LIMITS },
  run: (_workspace, input) => writeMidiFile(input as z.infer<typeof writeInput>),
}];
