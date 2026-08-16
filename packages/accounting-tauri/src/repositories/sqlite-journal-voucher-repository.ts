import {
  rehydrateJournalVoucher,
  type JournalVoucher,
  type JournalVoucherRepository,
  type NormalizedJournalVoucherSearchQuery,
} from "@argin/accounting/journal";
import {
  assertVersionedUpdate,
  type DatabaseSession,
  type DatabaseValue,
} from "@argin/database";
import { createPagedResult, type PagedResult } from "@argin/platform";

interface JournalVoucherRow {
  id: string;
  company_id: string;
  branch_id: string | null;
  voucher_number: string;
  reference: string | null;
  voucher_date: string;
  fiscal_year_id: string;
  fiscal_period_id: string;
  description: string | null;
  status: "draft";
  currency_code: string;
  source_type: JournalVoucher["source"]["type"];
  source_id: string | null;
  request_id: string | null;
  correlation_id: string | null;
  causation_id: string | null;
  total_debit: number;
  total_credit: number;
  created_at: string;
  updated_at: string;
  version: number;
}

interface JournalLineRow {
  id: string;
  voucher_id: string;
  line_order: number;
  account_id: string;
  description: string | null;
  debit_amount: number;
  credit_amount: number;
}

interface JournalDimensionRow {
  line_id: string;
  dimension_type_id: string;
  member_id: string;
}

interface CountRow { readonly count: number }

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/gu, (match) => `\\${match}`);
}

export class SqliteJournalVoucherRepository implements JournalVoucherRepository {
  constructor(private readonly database: DatabaseSession) {}

  async create(voucher: JournalVoucher): Promise<void> {
    await this.insertVoucher(voucher);
    await this.insertLines(voucher);
  }

  async findById(id: string): Promise<JournalVoucher | null> {
    const row = await this.database.queryOne<JournalVoucherRow>(
      "SELECT * FROM journal_vouchers WHERE id = ?",
      [id],
    );
    return row ? this.rehydrate(row) : null;
  }

  async findByNumber(
    companyId: string,
    fiscalYearId: string,
    branchId: string | null,
    number: string,
  ): Promise<JournalVoucher | null> {
    const row = await this.database.queryOne<JournalVoucherRow>(
      `SELECT * FROM journal_vouchers
       WHERE company_id = ? AND fiscal_year_id = ?
         AND ((branch_id = ?) OR (branch_id IS NULL AND ? IS NULL))
         AND voucher_number = ?`,
      [companyId, fiscalYearId, branchId, branchId, number],
    );
    return row ? this.rehydrate(row) : null;
  }

  async search(
    query: NormalizedJournalVoucherSearchQuery,
  ): Promise<PagedResult<JournalVoucher>> {
    const { where, parameters } = this.searchWhere(query);
    const countRow = await this.database.queryOne<CountRow>(
      `SELECT COUNT(*) AS count FROM journal_vouchers v ${where}`,
      parameters,
    );
    const rows = await this.database.query<JournalVoucherRow>(
      `SELECT v.* FROM journal_vouchers v ${where}
       ORDER BY v.voucher_date DESC, v.voucher_number DESC, v.id DESC
       LIMIT ? OFFSET ?`,
      [...parameters, query.pageSize, query.offset],
    );
    const items: JournalVoucher[] = [];
    for (const row of rows) items.push(await this.rehydrate(row));
    return createPagedResult(items, countRow?.count ?? 0, {
      page: query.page,
      pageSize: query.pageSize,
      offset: query.offset,
    });
  }

  async update(voucher: JournalVoucher, expectedVersion: number): Promise<void> {
    const result = await this.database.execute(
      `UPDATE journal_vouchers SET
        branch_id = ?, voucher_number = ?, reference = ?, voucher_date = ?,
        fiscal_year_id = ?, fiscal_period_id = ?, description = ?, status = ?,
        currency_code = ?, source_type = ?, source_id = ?, request_id = ?,
        correlation_id = ?, causation_id = ?, total_debit = ?, total_credit = ?,
        updated_at = ?, version = ?
       WHERE id = ? AND company_id = ? AND version = ?`,
      [
        voucher.branchId, voucher.number, voucher.reference, voucher.voucherDate,
        voucher.fiscalYearId, voucher.fiscalPeriodId, voucher.description,
        voucher.status, voucher.currency, voucher.source.type,
        voucher.source.sourceId, voucher.source.requestId,
        voucher.source.correlationId, voucher.source.causationId,
        voucher.totalDebit.amount, voucher.totalCredit.amount,
        voucher.updatedAt, voucher.version, voucher.id, voucher.companyId,
        expectedVersion,
      ],
    );
    assertVersionedUpdate(result, {
      entityType: "JournalVoucher",
      entityId: voucher.id,
      expectedVersion,
    });
    await this.database.execute(
      "DELETE FROM journal_lines WHERE voucher_id = ?",
      [voucher.id],
    );
    await this.insertLines(voucher);
  }

  async deleteDraft(
    id: string,
    companyId: string,
    expectedVersion: number,
  ): Promise<void> {
    const result = await this.database.execute(
      `DELETE FROM journal_vouchers
       WHERE id = ? AND company_id = ? AND status = 'draft' AND version = ?`,
      [id, companyId, expectedVersion],
    );
    assertVersionedUpdate(result, {
      entityType: "JournalVoucher",
      entityId: id,
      expectedVersion,
    });
  }

  private async insertVoucher(voucher: JournalVoucher): Promise<void> {
    await this.database.execute(
      `INSERT INTO journal_vouchers (
        id, company_id, branch_id, voucher_number, reference, voucher_date,
        fiscal_year_id, fiscal_period_id, description, status, currency_code,
        source_type, source_id, request_id, correlation_id, causation_id,
        total_debit, total_credit, created_at, updated_at, version
      ) VALUES (${Array.from({ length: 21 }, () => "?").join(", ")})`,
      [
        voucher.id, voucher.companyId, voucher.branchId, voucher.number,
        voucher.reference, voucher.voucherDate, voucher.fiscalYearId,
        voucher.fiscalPeriodId, voucher.description, voucher.status,
        voucher.currency, voucher.source.type, voucher.source.sourceId,
        voucher.source.requestId, voucher.source.correlationId,
        voucher.source.causationId, voucher.totalDebit.amount,
        voucher.totalCredit.amount, voucher.createdAt, voucher.updatedAt,
        voucher.version,
      ],
    );
  }

  private async insertLines(voucher: JournalVoucher): Promise<void> {
    for (const line of voucher.lines) {
      await this.database.execute(
        `INSERT INTO journal_lines (
          id, voucher_id, company_id, line_order, account_id, description,
          debit_amount, credit_amount, currency_code
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          line.id, voucher.id, voucher.companyId, line.order, line.accountId,
          line.description, line.debit.amount, line.credit.amount, voucher.currency,
        ],
      );
      for (const assignment of line.dimensionAssignments) {
        for (const memberId of assignment.memberIds) {
          await this.database.execute(
            `INSERT INTO journal_line_dimension_assignments (
              voucher_id, line_id, company_id, dimension_type_id, member_id
            ) VALUES (?, ?, ?, ?, ?)`,
            [
              voucher.id, line.id, voucher.companyId,
              assignment.dimensionTypeId, memberId,
            ],
          );
        }
      }
    }
  }

  private async rehydrate(row: JournalVoucherRow): Promise<JournalVoucher> {
    const lineRows = await this.database.query<JournalLineRow>(
      `SELECT id, voucher_id, line_order, account_id, description,
              debit_amount, credit_amount
       FROM journal_lines WHERE voucher_id = ? ORDER BY line_order, id`,
      [row.id],
    );
    const dimensionRows = lineRows.length === 0
      ? []
      : await this.database.query<JournalDimensionRow>(
          `SELECT line_id, dimension_type_id, member_id
           FROM journal_line_dimension_assignments
           WHERE voucher_id = ?
           ORDER BY line_id, dimension_type_id, member_id`,
          [row.id],
        );
    const byLine = new Map<string, Map<string, string[]>>();
    for (const dimension of dimensionRows) {
      const byType = byLine.get(dimension.line_id) ?? new Map<string, string[]>();
      const members = byType.get(dimension.dimension_type_id) ?? [];
      members.push(dimension.member_id);
      byType.set(dimension.dimension_type_id, members);
      byLine.set(dimension.line_id, byType);
    }
    return rehydrateJournalVoucher({
      id: row.id,
      companyId: row.company_id,
      branchId: row.branch_id,
      number: row.voucher_number,
      reference: row.reference,
      voucherDate: row.voucher_date,
      fiscalYearId: row.fiscal_year_id,
      fiscalPeriodId: row.fiscal_period_id,
      description: row.description,
      currency: row.currency_code as JournalVoucher["currency"],
      source: {
        type: row.source_type,
        sourceId: row.source_id,
        requestId: row.request_id,
        correlationId: row.correlation_id,
        causationId: row.causation_id,
      },
      lines: lineRows.map((line) => ({
        id: line.id,
        order: line.line_order,
        accountId: line.account_id,
        description: line.description,
        debit: line.debit_amount,
        credit: line.credit_amount,
        dimensionAssignments: [...(byLine.get(line.id) ?? new Map())].map(
          ([dimensionTypeId, memberIds]) => ({
            dimensionTypeId,
            memberIds: Object.freeze([...memberIds]),
          }),
        ),
      })),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      version: row.version,
    });
  }

  private searchWhere(query: NormalizedJournalVoucherSearchQuery): {
    where: string;
    parameters: DatabaseValue[];
  } {
    const clauses = ["v.company_id = ?"];
    const parameters: DatabaseValue[] = [query.companyId];
    if (query.branchId !== undefined) {
      if (query.branchId === null) clauses.push("v.branch_id IS NULL");
      else { clauses.push("v.branch_id = ?"); parameters.push(query.branchId); }
    }
    if (query.fiscalYearId) { clauses.push("v.fiscal_year_id = ?"); parameters.push(query.fiscalYearId); }
    if (query.fiscalPeriodId) { clauses.push("v.fiscal_period_id = ?"); parameters.push(query.fiscalPeriodId); }
    if (query.accountId) {
      clauses.push("EXISTS (SELECT 1 FROM journal_lines l WHERE l.voucher_id = v.id AND l.account_id = ?)");
      parameters.push(query.accountId);
    }
    if (query.sourceType) { clauses.push("v.source_type = ?"); parameters.push(query.sourceType); }
    if (query.reference) { clauses.push("v.reference = ?"); parameters.push(query.reference); }
    if (query.number) { clauses.push("v.voucher_number = ?"); parameters.push(query.number); }
    if (query.dateFrom) { clauses.push("v.voucher_date >= ?"); parameters.push(query.dateFrom); }
    if (query.dateTo) { clauses.push("v.voucher_date <= ?"); parameters.push(query.dateTo); }
    if (query.text) {
      const pattern = `%${escapeLike(query.text)}%`;
      clauses.push("(v.voucher_number LIKE ? ESCAPE '\\' OR v.reference LIKE ? ESCAPE '\\' OR v.description LIKE ? ESCAPE '\\')");
      parameters.push(pattern, pattern, pattern);
    }
    return { where: `WHERE ${clauses.join(" AND ")}`, parameters };
  }
}
