import type { DatabaseSession } from "@argin/database";
import type { WarehouseBranchReference, WarehouseBranchResolver } from "@argin/warehouse";

type BranchRow = {
  readonly id: string;
  readonly company_id: string;
  readonly status: "active" | "inactive";
};

export class SqliteWarehouseBranchResolver implements WarehouseBranchResolver {
  constructor(private readonly database: DatabaseSession) {}

  async findById(companyId: string, branchId: string): Promise<WarehouseBranchReference | null> {
    const row = await this.database.queryOne<BranchRow>(
      "SELECT id, company_id, status FROM branches WHERE company_id = ? AND id = ?",
      [companyId, branchId],
    );
    return row
      ? Object.freeze({ branchId: row.id, companyId: row.company_id, status: row.status })
      : null;
  }
}
