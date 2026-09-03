/** Public, format-hidden view of the current host donor catalog. */
import {
  donorHost, listHostModulatorInventory, listSupportedDonorTypes,
} from '../bwmod/index.js';

export function runModulatorCatalog(): Record<string, unknown> {
  const supportedTypes = listSupportedDonorTypes().map((type) => ({
    type: type.id,
    name: type.publicName,
    category: type.category,
    operations: type.capabilities,
    sampledPreset: type.sampledPreset,
    witness: type.witness,
    provenance: type.provenance,
  }));
  const inventory = listHostModulatorInventory().map((entry) => ({
    name: entry.name,
    standing: entry.supportedType === null ? 'excluded' : 'supported',
    ...(entry.supportedType === null ? {} : { type: entry.supportedType }),
    ...(entry.unsupportedReason === null ? {} : { why: entry.unsupportedReason }),
  }));
  return {
    host: donorHost(),
    supportedTypes,
    inventory,
    totals: {
      hostTypes: inventory.length,
      supportedTypes: supportedTypes.length,
      excludedTypes: inventory.length - supportedTypes.length,
    },
  };
}
