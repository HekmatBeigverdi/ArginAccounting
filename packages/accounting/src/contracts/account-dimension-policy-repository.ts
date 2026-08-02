import type { PagedResult } from "@argin/platform";
import type { AccountDimensionPolicy } from "../domain/account-dimension-policy.ts";
import type { AccountDimensionPolicySearchQuery } from "./accounting-dimension-queries.ts";

export interface AccountDimensionPolicyRepository {
  create(policy: AccountDimensionPolicy): Promise<void>;
  findById(id: string): Promise<AccountDimensionPolicy | null>;
  findByAccountAndType(companyId: string, accountId: string, dimensionTypeId: string): Promise<AccountDimensionPolicy | null>;
  findByAccountId(companyId: string, accountId: string): Promise<readonly AccountDimensionPolicy[]>;
  search(query: AccountDimensionPolicySearchQuery): Promise<PagedResult<AccountDimensionPolicy>>;
  update(policy: AccountDimensionPolicy): Promise<void>;
  delete(policy: AccountDimensionPolicy): Promise<void>;
}
