/** Exact device and preset name discovery from the running host's configuration (V14). */
export { ByteReader, DiscoveryFormatError, fileSignature, readStableFile, signatureKey, type FileSignature } from './binary.js';
export { PREFS_HEADER, PREFS_SCHEMA, decodePrefsLocations, packageRoot, type ConfiguredLocation, type PrefsLocations, type RemovedStandardLocation } from './prefs.js';
export {
  PLUGIN_ARCHITECTURES, PLUGIN_ID_TABLES, PLUGIN_INDEX_VERSION, decodeIdTable, decodePluginIndex, pluginDisplayName, pluginIndexFileName,
  pluginIndexStem, type IdTables, type PluginArchitecture, type PluginIndexEntry, type PluginKind,
} from './plugin-index.js';
export {
  defaultHostProbe, discoverHostContext, environmentVariable, parseProcessList,
  type HostContext, type HostContextFailure, type HostContextResult, type HostProbe, type HostProcess,
} from './host-context.js';
export { PRESET_ROOT_KINDS, defaultMyLibrary, discoverRoots, type DiscoveredRoot, type RootKind } from './roots.js';
export {
  BUNDLE_SCAN_LIMITS, DiscoveryCache, PRESET_SCAN_LIMITS, hasIndexState, readIdTables, readPresetMetadata, scanBundles, scanNativeDevices,
  scanPluginIndex, scanPresetFiles, type NativeDeviceEntry, type NativeScan, type PluginBundleEntry, type PluginIndexScan, type PresetFile,
  type PresetMetadata, type PresetScan,
} from './sources.js';
export {
  DEVICE_NAME_RESOLUTION_VERSION, KNOWN_BUILDS, RootNotDiscoveredError, SOURCE_KINDS, resolveDeviceName,
  type BuildAdmission, type Candidate, type DeviceNameResolution, type Exclusion, type InsertionSource, type ResolutionQuery,
  type ResolutionStatus, type ResolverOptions, type ScopeCoverage, type ScopeStatus, type SourceKind,
} from './resolver.js';
