import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Per-request correlation context, propagated via AsyncLocalStorage so any code
 * deep in a service can log the request id without threading it through every
 * signature. Populated by the `requestId` middleware.
 */
interface RequestStore {
  requestId: string;
}

const als = new AsyncLocalStorage<RequestStore>();

export function runWithRequestContext<T>(store: RequestStore, fn: () => T): T {
  return als.run(store, fn);
}

export function getRequestId(): string | undefined {
  return als.getStore()?.requestId;
}
