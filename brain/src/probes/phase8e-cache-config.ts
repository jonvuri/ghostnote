/** E139: install and restore probe-only cache scale configuration. */
import { access, readFile, unlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const configPath = join(homedir(), '.ghostnote', 'rig.json');
const backupPath = '/tmp/ghostnote-e139-rig-backup.json';

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command === 'restore') {
    await writeFile(configPath, await readFile(backupPath));
    await unlink(backupPath);
    console.log('restored the exact E139 entry configuration');
    return;
  }
  if (command !== 'set') {
    throw new Error('usage: phase8e-cache-config.ts set <observer-count> <width-steps> | restore');
  }
  const observerCount = Number(process.argv[3]);
  const widthSteps = Number(process.argv[4]);
  if (!Number.isSafeInteger(observerCount) || observerCount < 0
      || !Number.isSafeInteger(widthSteps) || widthSteps < 0) {
    throw new Error('observer count and width steps must be non-negative integers');
  }
  if (!await exists(backupPath)) await writeFile(backupPath, await readFile(configPath));
  const config = {
    recordChars: 0,
    cacheScaleObservers: observerCount,
    cacheScaleSteps: 131_072,
    cacheScaleWidthSteps: widthSteps,
    stamp: `e139-count-${observerCount}-width-${widthSteps}`,
  };
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  console.log(config.stamp);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
