/** Local file access for MIDI conversion. Existing destinations are never replaced. */
import { constants } from 'node:fs';
import { open, link, mkdtemp, rm } from 'node:fs/promises';
import { dirname, join, isAbsolute } from 'node:path';
import { MIDI_LIMITS, MidiError, requireMidi } from './smf.js';

export async function readMidiBytes(path: string): Promise<Buffer> {
  requireMidi(isAbsolute(path), 'The MIDI path must be absolute.');
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = await file.stat();
    requireMidi(before.isFile(), 'The MIDI path must name a regular file.');
    requireMidi(before.size <= MIDI_LIMITS.bytes, 'MIDI input exceeds 8 MiB.', 'outside-limit');
    const buffer = Buffer.alloc(before.size + 1); let size = 0;
    while (size < buffer.length) {
      const { bytesRead } = await file.read(buffer, size, buffer.length - size, size);
      if (!bytesRead) break;
      size += bytesRead;
    }
    const after = await file.stat();
    requireMidi(size === before.size && after.size === before.size && after.mtimeMs === before.mtimeMs,
      'The MIDI file changed during the read. Read it again.');
    return buffer.subarray(0, size);
  } finally { await file.close(); }
}

/** Publish one complete file with an atomic no-replace link in the same directory. */
export async function publishMidi(path: string, bytes: Buffer): Promise<void> {
  requireMidi(isAbsolute(path), 'The MIDI destination must be absolute.');
  requireMidi(/\.midi?$/i.test(path), 'The MIDI destination must end in .mid or .midi.');
  requireMidi(bytes.length <= MIDI_LIMITS.bytes, 'MIDI output exceeds 8 MiB.', 'outside-limit');
  const directory = await mkdtemp(join(dirname(path), '.ghostnote-midi-'));
  try {
    const staged = join(directory, 'output.mid');
    const handle = await open(staged, 'wx', 0o600);
    try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
    await link(staged, path);
  } finally {
    // Publication has already succeeded if link returned. Cleanup must not hide that effect.
    await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  }
}

export function fileError(error: unknown): MidiError | unknown {
  const code = (error as NodeJS.ErrnoException)?.code;
  if (code === 'ELOOP') return new MidiError('unsupported', 'Symbolic links are not supported for MIDI input.');
  if (code === 'EACCES' || code === 'EPERM') return new MidiError('unsupported', 'The MIDI path is not accessible to the Ghostnote server.');
  if (code === 'ENOTDIR' || code === 'EISDIR') return new MidiError('invalid-input', 'The MIDI path does not name a regular file in an existing directory.');
  return error;
}
