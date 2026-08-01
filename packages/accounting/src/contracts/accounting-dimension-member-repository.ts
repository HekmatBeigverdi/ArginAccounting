import type { PagedResult } from "@argin/platform";
import type { AccountingDimensionMember } from "../domain/accounting-dimension-member.ts";
import type { AccountingDimensionMemberSearchQuery } from "./accounting-dimension-queries.ts";

export interface AccountingDimensionMemberRepository {
  create(member: AccountingDimensionMember): Promise<void>;
  findById(id: string): Promise<AccountingDimensionMember | null>;
  findByCode(companyId: string, dimensionTypeId: string, code: string): Promise<AccountingDimensionMember | null>;
  findChildren(companyId: string, parentId: string): Promise<readonly AccountingDimensionMember[]>;
  search(query: AccountingDimensionMemberSearchQuery): Promise<PagedResult<AccountingDimensionMember>>;
  update(member: AccountingDimensionMember): Promise<void>;
  delete(member: AccountingDimensionMember): Promise<void>;
}
