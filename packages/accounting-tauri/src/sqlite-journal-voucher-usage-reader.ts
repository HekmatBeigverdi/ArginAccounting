import type { JournalVoucherUsageReader } from "@argin/accounting/journal";
import type { DatabaseSession } from "@argin/database";

interface ExistsRow { readonly found: number }

export class SqliteJournalVoucherUsageReader implements JournalVoucherUsageReader {
  constructor(private readonly database: DatabaseSession) {}

  isAccountUsed(accountId: string): Promise<boolean> {
    return this.exists(
      `SELECT 1 AS found FROM journal_lines WHERE account_id = ? LIMIT 1`,
      [accountId],
    );
  }

  isDimensionTypeUsed(dimensionTypeId: string): Promise<boolean> {
    return this.exists(
      `SELECT 1 AS found FROM journal_line_dimension_assignments
       WHERE dimension_type_id = ? LIMIT 1`,
      [dimensionTypeId],
    );
  }

  isDimensionMemberUsed(dimensionMemberId: string): Promise<boolean> {
    return this.exists(
      `SELECT 1 AS found FROM journal_line_dimension_assignments
       WHERE member_id = ? LIMIT 1`,
      [dimensionMemberId],
    );
  }

  private async exists(sql: string, parameters: readonly string[]): Promise<boolean> {
    const row = await this.database.queryOne<ExistsRow>(sql, parameters);
    return row?.found === 1;
  }
}
