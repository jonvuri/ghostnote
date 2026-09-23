export {
  DOCUMENTATION_INDEX_SCHEMA, DOCUMENTATION_MODULE_ID, DOCUMENTATION_MODULE_VERSION,
  DOCUMENTATION_PROVIDER_VERSION, DOCUMENTATION_REQUEST_SCHEMA, DOCUMENTATION_RESULT_SCHEMA,
  DOCUMENTATION_SOURCE_SCHEMA, DocumentationError, documentationModule,
  openDocumentationSource, queryDocumentation,
} from './documentation-provider.js';
export type {
  DocumentationCompatibilityRequirement, DocumentationFamily, DocumentationHit,
  DocumentationLocator, DocumentationProviderOptions, DocumentationQuery,
  DocumentationResult, DocumentationSourceEntry, DocumentationSourceFile,
  DocumentationSourceMode, DocumentationSourceOptions, DocumentationSourceSelection, GuideExtractor,
  OpenDocumentationSource,
} from './documentation-provider.js';
