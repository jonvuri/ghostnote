/**
 * Local file access for the offline file tools (8i16, 8i19). A read takes one regular file with no symbolic link.
 * A publication never replaces a file: it stages the bytes in the same directory and links them into place.
 */
import { constants } from 'node:fs';
import { open, link, lstat, mkdtemp, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/** The reasons that a caller turns into its own refusal. */
export type FileRefusal = 'not-regular' | 'too-large' | 'changed' | 'occupied' | 'no-directory';

export class LocalFileError extends Error {
  constructor(readonly reason: FileRefusal, message: string) { super(message); }
}

/** Read one complete regular file of at most `maxBytes`. A change during the read refuses. */
export async function readRegularFile(path: string, maxBytes: number): Promise<Buffer> {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = await file.stat();
    if (!before.isFile()) throw new LocalFileError('not-regular', 'The path does not name a regular file.');
    if (before.size > maxBytes) throw new LocalFileError('too-large', `The file is larger than ${maxBytes} bytes.`);
    const buffer = Buffer.alloc(before.size + 1); let size = 0;
    while (size < buffer.length) {
      const { bytesRead } = await file.read(buffer, size, buffer.length - size, size);
      if (!bytesRead) break;
      size += bytesRead;
    }
    const after = await file.stat();
    if (size !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs) {
      throw new LocalFileError('changed', 'The file changed during the read.');
    }
    return buffer.subarray(0, size);
  } finally { await file.close(); }
}

/** Check a new destination before expensive work: its directory exists and nothing has its name. */
export async function requireNewDestination(path: string): Promise<void> {
  const directory = await stat(dirname(path)).catch(() => undefined);
  if (directory?.isDirectory() !== true) throw new LocalFileError('no-directory', 'The parent directory does not exist.');
  const existing = await lstat(path).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  });
  if (existing !== undefined) throw new LocalFileError('occupied', 'The destination already exists.');
}

/** Publish one complete file with an atomic no-replace link in the same directory. */
export async function publishNewFile(path: string, bytes: Uint8Array, prefix: string): Promise<void> {
  const directory = await mkdtemp(join(dirname(path), prefix));
  try {
    const staged = join(directory, 'staged');
    const handle = await open(staged, 'wx', 0o600);
    try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
    await link(staged, path);
  } finally {
    // Publication has already succeeded if link returned. Cleanup must not hide that effect.
    await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  }
}
