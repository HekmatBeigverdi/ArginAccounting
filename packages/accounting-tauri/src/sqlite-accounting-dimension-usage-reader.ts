import type { AccountingDimensionUsageReader } from "@argin/accounting";
import type { DatabaseExecutor, DatabaseSession } from "@argin/database";

interface ExistsRow {
  readonly found: number;
}

export class SqliteAccountingDimensionUsageReader
  implements AccountingDimensionUsageReader
{
  constructor(private readonly database: DatabaseExecutor) {}

  isDimensionTypeInUse(
    companyId: string,
    dimensionTypeId: string,
  ): Promise<boolean> {
    return this.database.transaction(async (session) => {
      const memberExists = await this.exists(
        session,
        `SELECT 1 AS found
         FROM accounting_dimension_members
         WHERE company_id = ? AND dimension_type_id = ?
         LIMIT 1`,
        [companyId, dimensionTypeId],
      );

      if (memberExists) return true;

      return this.exists(
        session,
        `SELECT 1 AS found
         FROM account_dimension_policies
         WHERE company_id = ? AND dimension_type_id = ?
         LIMIT 1`,
        [companyId, dimensionTypeId],
      );
    });
  }

  isMemberInUse(companyId: string, memberId: string): Promise<boolean> {
    return this.database.transaction((session) =>
      this.exists(
        session,
        `SELECT 1 AS found
         FROM accounting_dimension_members
         WHERE company_id = ? AND parent_id = ?
         LIMIT 1`,
        [companyId, memberId],
      ),
    );
  }

  private async exists(
    session: DatabaseSession,
    sql: string,
    parameters: readonly string[],
  ): Promise<boolean> {
    const row = await session.queryOne<ExistsRow>(sql, parameters);
    return row?.found === 1;
  }
}
