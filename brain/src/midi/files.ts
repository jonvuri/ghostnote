/** Local file access for MIDI conversion. Existing destinations are never replaced. */
import { isAbsolute } from 'node:path';
import { LocalFileError, publishNewFile, readRegularFile } from '../files/local-file.js';
import { MIDI_LIMITS, MidiError, requireMidi } from './smf.js';

export async function readMidiBytes(path: string): Promise<Buffer> {
  requireMidi(isAbsolute(path), 'The MIDI path must be absolute.');
  try {
    return await readRegularFile(path, MIDI_LIMITS.bytes);
  } catch (error) {
    if (!(error instanceof LocalFileError)) throw error;
    if (error.reason === 'not-regular') throw new MidiError('invalid-input', 'The MIDI path must name a regular file.');
    if (error.reason === 'too-large') throw new MidiError('outside-limit', 'MIDI input exceeds 8 MiB.');
    throw new MidiError('invalid-input', 'The MIDI file changed during the read. Read it again.');
  }
}

/** Publish one complete file with an atomic no-replace link in the same directory. */
export async function publishMidi(path: string, bytes: Buffer): Promise<void> {
  requireMidi(isAbsolute(path), 'The MIDI destination must be absolute.');
  requireMidi(/\.midi?$/i.test(path), 'The MIDI destination must end in .mid or .midi.');
  requireMidi(bytes.length <= MIDI_LIMITS.bytes, 'MIDI output exceeds 8 MiB.', 'outside-limit');
  await publishNewFile(path, bytes, '.ghostnote-midi-');
}

export function fileError(error: unknown): MidiError | unknown {
  const code = (error as NodeJS.ErrnoException)?.code;
  if (code === 'ELOOP') return new MidiError('unsupported', 'Symbolic links are not supported for MIDI input.');
  if (code === 'EACCES' || code === 'EPERM') return new MidiError('unsupported', 'The MIDI path is not accessible to the Ghostnote server.');
  if (code === 'ENOTDIR' || code === 'EISDIR') return new MidiError('invalid-input', 'The MIDI path does not name a regular file in an existing directory.');
  return error;
}
