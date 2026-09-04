import type { WarehouseBranchReference } from "../../domain/warehouse-organization.ts";

export interface WarehouseIdempotencyExecutor {
  run<T>(scope: string, requestId: string, work: () => Promise<T>): Promise<T>;
}

export interface WarehouseBranchResolver {
  findById(companyId: string, branchId: string): Promise<WarehouseBranchReference | null>;
}
