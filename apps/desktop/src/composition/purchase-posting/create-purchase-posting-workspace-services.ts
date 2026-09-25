import type { DatabaseExecutor } from "@argin/database";
import {
  purchasePostingPermissions,
  type PurchasePostingReconciliationSnapshot,
  type PurchasePostingSourceIdentity,
} from "@argin/purchase-posting";
import {
  SqlitePurchasePostingReconciliationReader,
} from "@argin/purchase-posting-tauri";

export interface PurchasePostingWorkspaceActor {
  readonly permissions: readonly string[];
  readonly branchIds: readonly string[];
}

export interface PurchasePostingWorkspaceServices {
  readonly canView: boolean;
  readonly canTrace: boolean;
  readonly canExecute: boolean;
  readonly canReverse: boolean;
  findBySource(input: {
    readonly companyId: string;
    readonly branchId: string;
    readonly sourceType: PurchasePostingSourceIdentity["sourceType"];
    readonly sourceId: string;
  }): Promise<readonly PurchasePostingReconciliationSnapshot[]>;
  findByPostingId(
    companyId: string,
    postingId: string,
  ): Promise<PurchasePostingReconciliationSnapshot | null>;
}

export function createPurchasePostingWorkspaceServices(input: {
  readonly database: DatabaseExecutor;
  readonly actor: PurchasePostingWorkspaceActor;
}): PurchasePostingWorkspaceServices {
  const permissions = new Set(input.actor.permissions);
  const branchIds = new Set(input.actor.branchIds);
  const reader = new SqlitePurchasePostingReconciliationReader(input.database);

  const can = (permission: string) =>
    permissions.has("system.full-access") || permissions.has(permission);

  const requireBranch = (branchId: string) => {
    if (
      !permissions.has("system.full-access")
      && !branchIds.has(branchId)
    ) {
      throw new Error("برای مشاهده ثبت حسابداری این شعبه مجوز ندارید.");
    }
  };

  return Object.freeze({
    canView: can(purchasePostingPermissions.view),
    canTrace: can(purchasePostingPermissions.viewTrace),
    canExecute: can(purchasePostingPermissions.execute),
    canReverse: can(purchasePostingPermissions.reverse),

    async findBySource({ companyId, branchId, sourceType, sourceId }) {
      if (!can(purchasePostingPermissions.view)) {
        throw new Error("برای مشاهده ثبت حسابداری خرید مجوز ندارید.");
      }
      requireBranch(branchId);
      const rows = await reader.findBySource(companyId, sourceType, sourceId);
      return Object.freeze(rows.filter(row => row.source.branchId === branchId));
    },

    async findByPostingId(companyId, postingId) {
      if (!can(purchasePostingPermissions.viewTrace)) {
        throw new Error("برای مشاهده مسیر ردیابی ثبت حسابداری مجوز ندارید.");
      }
      const row = await reader.findByPostingId(companyId, postingId);
      if (row) requireBranch(row.source.branchId);
      return row;
    },
  });
}
