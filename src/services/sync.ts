import { mergeLifetime, type LifetimeStats } from '../engine/stats/lifetime';

export interface CloudProfile {
  settings: Record<string, unknown>;
  lifetime: LifetimeStats;
  updated_at: string;
}

export interface SyncPlan {
  lifetime: LifetimeStats;
  /** Settings to apply locally, or null to keep the local ones. */
  settings: Record<string, unknown> | null;
  /** Whether the merged result must be written back to the cloud. */
  push: boolean;
}

/**
 * Reconcile this device with the signed-in account.
 * - First sign-in (no profile yet): the guest's local data becomes the account's data.
 * - Otherwise lifetime stats merge per player (newest record wins), the account's
 *   settings win, and we push only if the merge added anything the cloud lacked.
 */
export function planSync(local: LifetimeStats, remote: CloudProfile | null): SyncPlan {
  if (!remote) return { lifetime: local, settings: null, push: true };
  const lifetime = mergeLifetime(remote.lifetime ?? {}, local);
  const push = JSON.stringify(lifetime) !== JSON.stringify(remote.lifetime ?? {});
  const hasSettings = remote.settings && Object.keys(remote.settings).length > 0;
  return { lifetime, settings: hasSettings ? remote.settings : null, push };
}
