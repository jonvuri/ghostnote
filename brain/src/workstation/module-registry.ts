/** Lazy, isolated registry for experimental workstation modules. */
export const WORKSTATION_MODULE_SCHEMA = 'ghostnote-workstation-module-v0';
export const WORKSTATION_REQUEST_SCHEMA = 'ghostnote-workstation-request-v0';
export const WORKSTATION_RESPONSE_SCHEMA = 'ghostnote-workstation-response-v0';
export const WORKSTATION_DEADLINE_CLEANUP_GRACE_MS = 1_000;

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
  readonly preflight?: (
    request: WorkstationRequest<TInput>, signal?: AbortSignal,
  ) => Promise<void> | void;
  readonly start?: (signal?: AbortSignal) => Promise<ModuleHealth>;
  readonly handle: (
    request: WorkstationRequest<TInput>, signal?: AbortSignal,
  ) => Promise<WorkstationResponse<TOutput>>;
}

export class WorkstationModuleError extends Error {
  constructor(
    message: string,
    readonly code: 'missing-dependency' | 'unsupported-schema' | 'source-mismatch'
    | 'capture-ambiguous' | 'timeout' | 'verification-failed',
    readonly moduleId: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'WorkstationModuleError';
  }
}

interface RegisteredModule {
  readonly module: WorkstationModule<unknown, unknown>;
  descriptor: WorkstationModuleDescriptor;
  startup?: Promise<void>;
}

function withDeadline<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  deadlineMs: number,
  moduleId: string,
  stage: 'startup' | 'request',
  parentSignal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const operationSignal = parentSignal === undefined
    ? controller.signal
    : AbortSignal.any([controller.signal, parentSignal]);
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let parentAborted: (() => void) | undefined;
  const timeoutError = new WorkstationModuleError(
    `${moduleId} ${stage} exceeded its ${deadlineMs} ms deadline`,
    'timeout',
    moduleId,
  );
  const expired = new Promise<{ readonly kind: 'expired' }>((resolve) => {
    const expire = (): void => {
      controller.abort();
      resolve({ kind: 'expired' });
    };
    timeout = setTimeout(expire, deadlineMs);
    parentAborted = expire;
    if (parentSignal?.aborted === true) expire();
    else parentSignal?.addEventListener('abort', expire, { once: true });
  });
  const work = operation(operationSignal).then(
    (value) => ({ kind: 'value' as const, value }),
    (error: unknown) => ({ kind: 'error' as const, error }),
  );
  return Promise.race([work, expired]).then(async (first) => {
    if (first.kind === 'value') return first.value;
    if (first.kind === 'error') throw first.error;

    let cleanupTimeout: ReturnType<typeof setTimeout> | undefined;
    const cleanupGrace = new Promise<void>((resolve) => {
      cleanupTimeout = setTimeout(resolve, WORKSTATION_DEADLINE_CLEANUP_GRACE_MS);
    });
    await Promise.race([work.then(() => undefined), cleanupGrace]);
    if (cleanupTimeout !== undefined) clearTimeout(cleanupTimeout);
    throw timeoutError;
  }).finally(() => {
    if (timeout !== undefined) clearTimeout(timeout);
    if (parentAborted !== undefined) parentSignal?.removeEventListener('abort', parentAborted);
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

  private async start(entry: RegisteredModule, requestSignal?: AbortSignal): Promise<void> {
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
            (signal) => entry.module.start!(signal), entry.descriptor.startupDeadlineMs,
            entry.descriptor.moduleId, 'startup', requestSignal,
          );
        if (requestSignal?.aborted === true) {
          throw new WorkstationModuleError(
            `module ${entry.descriptor.moduleId} startup was cancelled`,
            'timeout', entry.descriptor.moduleId,
          );
        }
        entry.descriptor = { ...entry.descriptor, ...health };
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        if (requestSignal?.aborted === true) {
          throw new WorkstationModuleError(
            `module ${entry.descriptor.moduleId} startup was cancelled`,
            'timeout', entry.descriptor.moduleId, { cause: error },
          );
        }
        entry.descriptor = unavailableDescriptor(entry.descriptor, reason);
        throw error instanceof WorkstationModuleError ? error : new WorkstationModuleError(
          reason, 'missing-dependency', entry.descriptor.moduleId,
        );
      }
    })();
    try {
      await entry.startup;
    } finally {
      if (entry.descriptor.state === 'uninitialized') entry.startup = undefined;
    }
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
    return withDeadline(async (signal) => {
      await entry.module.preflight?.(request as WorkstationRequest<unknown>, signal);
      if (signal.aborted) {
        throw new WorkstationModuleError(
          `module ${moduleId} request was cancelled after preflight`, 'timeout', moduleId,
        );
      }
      await this.start(entry, signal);
      if (signal.aborted) {
        throw new WorkstationModuleError(
          `module ${moduleId} request was cancelled after startup`, 'timeout', moduleId,
        );
      }
      if (entry.descriptor.state === 'disabled' || entry.descriptor.state === 'unavailable') {
        throw new WorkstationModuleError(
          `module ${moduleId} is ${entry.descriptor.state}`, 'missing-dependency', moduleId,
        );
      }
      const response = await entry.module.handle(
        request as WorkstationRequest<unknown>, signal,
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
    },
      entry.descriptor.requestDeadlineMs,
      moduleId,
      'request',
    );
  }
}
