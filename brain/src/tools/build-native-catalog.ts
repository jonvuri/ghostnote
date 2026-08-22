/** Generate the checked-in Bitwig native-device catalog and typed Java input. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import {
  buildNativeCatalog, catalogJson, javaCatalogSource, type NativeResolution,
} from '../native-catalog/catalog.js';

const rootAt = process.argv.indexOf('--bitwig-app-root');
if (rootAt === -1 || process.argv[rootAt + 1] === undefined) {
  throw new Error('usage: npm run catalog:native -- --bitwig-app-root "/path/to/Bitwig Studio.app"');
}

const repoRoot = join(import.meta.dirname, '..', '..', '..');
const assetDir = join(repoRoot, 'brain', 'assets', 'native-devices');
const resolutionPath = join(assetDir, 'live-resolution.json');
const resolution = existsSync(resolutionPath)
  ? JSON.parse(readFileSync(resolutionPath, 'utf8')) as NativeResolution
  : undefined;
const catalog = buildNativeCatalog(process.argv[rootAt + 1]!, resolution);
const catalogPath = join(assetDir, 'catalog.json');
const javaPath = join(
  repoRoot, 'extension', 'src', 'main', 'java', 'com', 'ghostnote', 'extension', 'generated',
  'NativeDeviceCatalog.java',
);

mkdirSync(assetDir, { recursive: true });
mkdirSync(dirname(javaPath), { recursive: true });
writeFileSync(catalogPath, catalogJson(catalog));
writeFileSync(javaPath, javaCatalogSource(catalog));
console.log(`wrote ${catalog.devices.length} devices to ${catalogPath}`);
console.log(`wrote ${javaPath}`);
