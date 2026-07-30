import type { Account } from "../domain/account.ts";

export interface AccountRepository {
  create(account: Account): Promise<void>;
  findById(id: string): Promise<Account | null>;
  findByCode(companyId: string, code: string): Promise<Account | null>;
  findByCompanyId(companyId: string): Promise<Account[]>;
  findChildren(parentId: string): Promise<Account[]>;
  update(account: Account): Promise<void>;
}
