/** Lazy, isolated registry for experimental workstation modules. */
export const WORKSTATION_MODULE_SCHEMA = 'ghostnote-workstation-module-v0';
export const WORKSTATION_REQUEST_SCHEMA = 'ghostnote-workstation-request-v0';
export const WORKSTATION_RESPONSE_SCHEMA = 'ghostnote-workstation-response-v0';

export type WorkstationModuleState =
  | 'disabled' | 'uninitialized' | 'available' | 'degraded' | 'unavailable';

export interface MissingCapability {
  readonly capability: string;
  readonly dependency: string;
  readonly reason: string;
}

export interface WorkstationModuleDescriptor {
  readonly schema: typeof WORKSTATION_MODULE_SCHEMA;
  readonly moduleId: string;
  readonly version: string;
  readonly state: WorkstationModuleState;
  readonly acceptedSchemas: readonly string[];
  readonly emittedSchemas: readonly string[];
  readonly capabilities: readonly string[];
  readonly missingCapabilities: readonly MissingCapability[];
  readonly dependencyVersions: Readonly<Record<string, string>>;
  readonly startupDeadlineMs: number;
  readonly requestDeadlineMs: number;
}

export interface WorkstationRequest<T> {
  readonly schema: typeof WORKSTATION_REQUEST_SCHEMA;
  readonly requestId: string;
  readonly inputSchema: string;
  readonly sourceSha256: string;
  readonly payload: T;
}

export interface WorkstationResponse<T> {
  readonly schema: typeof WORKSTATION_RESPONSE_SCHEMA;
  readonly requestId: string;
  readonly sourceSha256: string;
  readonly outputSchema: string;
  readonly payload: T;
}

export interface ModuleHealth {
  readonly state: 'available' | 'degraded';
  readonly capabilities: readonly string[];
  readonly missingCapabilities: readonly MissingCapability[];
  readonly dependencyVersions: Readonly<Record<string, string>>;
}

export interface WorkstationModule<TInput, TOutput> {
  readonly descriptor: Omit<WorkstationModuleDescriptor,
  'schema' | 'state' | 'capabilities' | 'missingCapabilities' | 'dependencyVersions'> & {
    readonly capabilities: readonly string[];
    readonly missingCapabilities?: readonly MissingCapability[];
    readonly dependencyVersions?: Readonly<Record<string, string>>;
  };
  readonly start?: () => Promise<ModuleHealth>;
  readonly handle: (request: WorkstationRequest<TInput>) => Promise<WorkstationResponse<TOutput>>;
}

export class WorkstationModuleError extends Error {
  constructor(
    message: string,
    readonly code: 'missing-dependency' | 'unsupported-schema' | 'source-mismatch'
    | 'timeout' | 'verification-failed',
    readonly moduleId: string,
  ) {
    super(message);
    this.name = 'WorkstationModuleError';
  }
}

interface RegisteredModule {
  readonly module: WorkstationModule<unknown, unknown>;
  descriptor: WorkstationModuleDescriptor;
  startup?: Promise<void>;
}

function withDeadline<T>(
  work: Promise<T>,
  deadlineMs: number,
  moduleId: string,
  stage: 'startup' | 'request',
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => reject(new WorkstationModuleError(
      `${moduleId} ${stage} exceeded its ${deadlineMs} ms deadline`,
      'timeout',
      moduleId,
    )), deadlineMs);
  });
  return Promise.race([work, expired]).finally(() => {
    if (timeout !== undefined) clearTimeout(timeout);
  });
}

function unavailableDescriptor(
  descriptor: WorkstationModuleDescriptor,
  reason: string,
): WorkstationModuleDescriptor {
  return {
    ...descriptor,
    state: 'unavailable',
    capabilities: [],
    missingCapabilities: [
      ...descriptor.missingCapabilities,
      { capability: '*', dependency: descriptor.moduleId, reason },
    ],
  };
}

/** Discovery is inert. Startup occurs only on the first request to one module. */
export class WorkstationModuleRegistry {
  private readonly modules = new Map<string, RegisteredModule>();

  register<TInput, TOutput>(module: WorkstationModule<TInput, TOutput>): void {
    const base = module.descriptor;
    if (this.modules.has(base.moduleId)) {
      throw new WorkstationModuleError(
        `module ${base.moduleId} is already registered`, 'verification-failed', base.moduleId,
      );
    }
    if (base.startupDeadlineMs <= 0 || base.requestDeadlineMs <= 0) {
      throw new WorkstationModuleError(
        `module ${base.moduleId} deadlines must be positive`, 'verification-failed', base.moduleId,
      );
    }
    this.modules.set(base.moduleId, {
      module: module as WorkstationModule<unknown, unknown>,
      descriptor: {
        schema: WORKSTATION_MODULE_SCHEMA,
        ...base,
        state: 'uninitialized',
        missingCapabilities: base.missingCapabilities ?? [],
        dependencyVersions: base.dependencyVersions ?? {},
      },
    });
  }

  discover(): readonly WorkstationModuleDescriptor[] {
    return [...this.modules.values()].map((entry) => structuredClone(entry.descriptor));
  }

  private async start(entry: RegisteredModule): Promise<void> {
    if (entry.descriptor.state !== 'uninitialized') return;
    entry.startup ??= (async () => {
      try {
        const health = entry.module.start === undefined
          ? {
            state: entry.descriptor.missingCapabilities.length === 0
              ? 'available' as const : 'degraded' as const,
            capabilities: entry.descriptor.capabilities,
            missingCapabilities: entry.descriptor.missingCapabilities,
            dependencyVersions: entry.descriptor.dependencyVersions,
          }
          : await withDeadline(
            entry.module.start(), entry.descriptor.startupDeadlineMs,
            entry.descriptor.moduleId, 'startup',
          );
        entry.descriptor = { ...entry.descriptor, ...health };
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        entry.descriptor = unavailableDescriptor(entry.descriptor, reason);
        throw error instanceof WorkstationModuleError ? error : new WorkstationModuleError(
          reason, 'missing-dependency', entry.descriptor.moduleId,
        );
      }
    })();
    await entry.startup;
  }

  async request<TInput, TOutput>(
    moduleId: string,
    request: WorkstationRequest<TInput>,
  ): Promise<WorkstationResponse<TOutput>> {
    const entry = this.modules.get(moduleId);
    if (entry === undefined) {
      throw new WorkstationModuleError(`module ${moduleId} is not registered`, 'missing-dependency', moduleId);
    }
    if (request.schema !== WORKSTATION_REQUEST_SCHEMA
        || !entry.descriptor.acceptedSchemas.includes(request.inputSchema)) {
      throw new WorkstationModuleError(
        `module ${moduleId} does not accept schema ${request.inputSchema}`,
        'unsupported-schema', moduleId,
      );
    }
    if (request.requestId.length === 0 || !/^[0-9a-f]{64}$/.test(request.sourceSha256)) {
      throw new WorkstationModuleError(
        `module ${moduleId} received invalid request correlation`,
        'verification-failed', moduleId,
      );
    }
    await this.start(entry);
    if (entry.descriptor.state === 'disabled' || entry.descriptor.state === 'unavailable') {
      throw new WorkstationModuleError(
        `module ${moduleId} is ${entry.descriptor.state}`, 'missing-dependency', moduleId,
      );
    }
    const response = await withDeadline(
      entry.module.handle(request as WorkstationRequest<unknown>),
      entry.descriptor.requestDeadlineMs,
      moduleId,
      'request',
    );
    if (response.schema !== WORKSTATION_RESPONSE_SCHEMA
        || response.requestId !== request.requestId
        || response.sourceSha256 !== request.sourceSha256
        || !entry.descriptor.emittedSchemas.includes(response.outputSchema)) {
      throw new WorkstationModuleError(
        `module ${moduleId} returned a mismatched or unsupported response`,
        'source-mismatch', moduleId,
      );
    }
    return response as WorkstationResponse<TOutput>;
  }
}
