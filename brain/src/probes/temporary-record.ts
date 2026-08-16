/** Replace a probe record and restore its saved value on every exit path. */
export async function withTemporaryRecord<T>(
  replace: (value: string) => Promise<void>,
  original: string,
  temporary: string,
  run: () => Promise<T>,
): Promise<T> {
  try {
    // Arm cleanup before the write. The write can be accepted before its
    // readback fails or the bridge disconnects.
    await replace(temporary);
    return await run();
  } finally {
    await replace(original);
  }
}
