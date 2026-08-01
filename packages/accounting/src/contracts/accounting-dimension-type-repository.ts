import type { PagedResult } from "@argin/platform";
import type { AccountingDimensionType } from "../domain/accounting-dimension-type.ts";
import type { AccountingDimensionTypeSearchQuery } from "./accounting-dimension-queries.ts";

export interface AccountingDimensionTypeRepository {
  create(dimensionType: AccountingDimensionType): Promise<void>;
  findById(id: string): Promise<AccountingDimensionType | null>;
  findByCode(companyId: string, code: string): Promise<AccountingDimensionType | null>;
  search(query: AccountingDimensionTypeSearchQuery): Promise<PagedResult<AccountingDimensionType>>;
  update(dimensionType: AccountingDimensionType): Promise<void>;
  delete(dimensionType: AccountingDimensionType): Promise<void>;
}
