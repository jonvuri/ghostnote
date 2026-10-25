/**
 * Location configuration from a Bitwig `<version>.prefs` file (E350).
 *
 * The decoder reads the whole typed object stream and exports only the location fields. Field and class
 * identities were traced on the 6.1.4 jar (`com.bitwig.flt.prefs.iiq` 722 / 3457, `IVc` 718 with 5134, 5066,
 * 5067, 5068, 6457, `A2V` 720 with 3443 / 3444, root 4917). An unsupported wire type, class, duplicate field,
 * truncation, or trailing byte refuses. This is not a general Bitwig serializer.
 */
import { join } from 'node:path';

import { ByteReader, DiscoveryFormatError } from './binary.js';

export const PREFS_HEADER = 'BtWg000100020006';
export const PREFS_SCHEMA = 'bitwig-prefs-locations-614-v1';

export interface ConfiguredLocation {
  readonly path: string;
  readonly automaticUpdate: boolean;
}

/** One record of the `explicitly_remove_standard_library_locations` list, kept generic: its class is unobserved. */
export interface RemovedStandardLocation {
  readonly objectClass: number;
  readonly strings: readonly string[];
}

export interface PrefsLocations {
  /** Empty means the platform default My Library. */
  readonly myLibrary: string;
  /** Empty means the default package directory under the settings root. */
  readonly packageInstallationDirectory: string;
  readonly soundContent: readonly ConfiguredLocation[];
  readonly music: readonly ConfiguredLocation[];
  readonly plugins: readonly ConfiguredLocation[];
  readonly removedStandardLocations: readonly RemovedStandardLocation[];
}

type Field = readonly [wire: number, value: unknown];
interface PrefsObject { readonly kind: number; readonly fields: ReadonlyMap<number, Field>; readonly reference?: number }

class PrefsReader {
  private objects = 0;
  readonly reader: ByteReader;

  constructor(data: Buffer) {
    if (data.length < 41 || data.subarray(0, 16).toString('latin1') !== PREFS_HEADER) {
      throw new DiscoveryFormatError('unsupported prefs header');
    }
    const offsetText = data.subarray(16, 24).toString('latin1');
    if (!/^[0-9a-fA-F]{8}$/.test(offsetText)) throw new DiscoveryFormatError('invalid object-stream offset');
    const offset = Number.parseInt(offsetText, 16) - 1;
    if (offset < 40 || offset >= data.length || data[offset] !== 0x0a) {
      throw new DiscoveryFormatError('invalid object-stream offset');
    }
    this.reader = new ByteReader(data);
    this.reader.pos = offset + 1;
  }

  object(depth = 0): PrefsObject {
    this.objects += 1;
    if (depth > 64 || this.objects > 100_000) throw new DiscoveryFormatError('object or depth limit');
    const kind = this.reader.u32be();
    if (kind === 3) return { kind, fields: new Map() }; // Bare four-byte list terminator.
    if (kind === 1) return { kind, fields: new Map(), reference: this.reader.u32be() };
    const fields = new Map<number, Field>();
    for (;;) {
      const id = this.reader.u32be();
      if (id === 0) return { kind, fields };
      if (fields.has(id) || fields.size >= 10_000) throw new DiscoveryFormatError('duplicate field or field limit');
      const wire = this.reader.u8();
      fields.set(id, [wire, this.value(wire, depth + 1)]);
    }
  }

  private value(wire: number, depth: number): unknown {
    const r = this.reader;
    switch (wire) {
      case 10: return null;
      case 1: case 5: return r.u8();
      case 2: return r.take(2);
      case 3: case 6: case 11: return r.u32be();
      case 4: case 7: return r.take(8);
      case 8: return r.stringBe();
      case 9: return this.object(depth);
      case 18: {
        const values: PrefsObject[] = [];
        for (;;) {
          const item = this.object(depth);
          if (item.kind === 3) return values;
          values.push(item);
        }
      }
      case 21: case 22: return r.take(16); // Opaque; never interpreted as a location field.
      case 25: {
        const count = r.u32be();
        if (count > 100_000) throw new DiscoveryFormatError('string-array limit');
        const values: string[] = [];
        for (let i = 0; i < count; i += 1) values.push(r.stringBe());
        return values;
      }
      default: throw new DiscoveryFormatError(`unsupported wire type ${wire}`);
    }
  }
}

function field<T>(object: PrefsObject, id: number, wire: number, what: string): T {
  const entry = object.fields.get(id);
  if (entry === undefined) throw new DiscoveryFormatError(`missing ${what} (field ${id})`);
  if (entry[0] !== wire) throw new DiscoveryFormatError(`unexpected type for ${what} (field ${id})`);
  return entry[1] as T;
}

function locations(object: PrefsObject, id: number, what: string): ConfiguredLocation[] {
  return field<PrefsObject[]>(object, id, 18, what).map((item) => {
    if (item.kind !== 720) throw new DiscoveryFormatError(`unexpected location class ${item.kind} in ${what}`);
    const automatic = field<number>(item, 3444, 5, 'automatic-update flag');
    if (automatic !== 0 && automatic !== 1) throw new DiscoveryFormatError('invalid automatic-update flag');
    return { path: field<string>(item, 3443, 8, 'location path'), automaticUpdate: automatic === 1 };
  });
}

/** Decode the location configuration of one complete prefs file. */
export function decodePrefsLocations(data: Buffer): PrefsLocations {
  const reader = new PrefsReader(data);
  const root = reader.object();
  reader.reader.done();
  if (root.kind !== 722) throw new DiscoveryFormatError(`unexpected root class ${root.kind}`);
  const library = field<PrefsObject>(root, 3457, 9, 'library preferences');
  if (library.kind !== 718) throw new DiscoveryFormatError(`unexpected library class ${library.kind}`);
  const removed = library.fields.has(6457)
    ? field<PrefsObject[]>(library, 6457, 18, 'removed standard locations').map((item) => ({
      objectClass: item.kind,
      strings: [...item.fields.values()].flatMap(([wire, value]) => wire === 8 ? [value as string] : []),
    }))
    : [];
  return {
    myLibrary: field<string>(library, 5134, 8, 'My Library path'),
    packageInstallationDirectory: field<string>(root, 4917, 8, 'package installation directory'),
    soundContent: locations(library, 5066, 'sound-content locations'),
    music: locations(library, 5067, 'music locations'),
    plugins: locations(library, 5068, 'plug-in locations'),
    removedStandardLocations: removed,
  };
}

/** The effective package directory (`TL.wZs` / `IwV` / `tSS` on 6.1.4). */
export function packageRoot(configured: string, settingsRoot: string): string {
  const fallback = join(settingsRoot, 'installed-packages');
  if (configured.length === 0 || configured === fallback) return fallback;
  return configured.endsWith('/Installed Bitwig Packs') || configured === 'Installed Bitwig Packs'
    ? configured
    : join(configured, 'Installed Bitwig Packs');
}
