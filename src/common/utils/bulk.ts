/**
 * Shared shape for bulk-action endpoints. The table's selection bar sends a set
 * of ids; the endpoint reports per-id outcomes so the SPA can show a
 * partial-success toast ("3 removed, 1 skipped: owner").
 */
export interface BulkResult {
  succeeded: string[];
  failed: { id: string; reason: string }[];
}

/**
 * Run a per-id handler over an id set, collecting successes and failures instead
 * of aborting on the first invariant violation (e.g. "cannot remove the owner").
 * Sequential by design — id sets are capped small and this keeps DB load bounded
 * and outcomes deterministic. Pre-load any shared state before calling so the
 * handler only performs its single write.
 */
export async function runBulk(ids: readonly string[], handle: (id: string) => Promise<void>): Promise<BulkResult> {
  const succeeded: string[] = [];
  const failed: { id: string; reason: string }[] = [];
  for (const id of ids) {
    try {
      await handle(id);
      succeeded.push(id);
    } catch (e) {
      failed.push({ id, reason: e instanceof Error ? e.message : 'Failed' });
    }
  }
  return { succeeded, failed };
}
