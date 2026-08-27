import type { AccountingDimensionMember, AccountingDimensionType } from "@argin/accounting";
import type {
  AccountingReportDataReader,
  AccountingReportDataSnapshot,
  AccountingReportExecutionContext,
} from "@argin/accounting/reporting-application";
import type { AccountingReportJournalLineFact } from "@argin/accounting/reporting";
import type { GeneralLedgerJournalLineFact } from "@argin/accounting/general-ledger";
import type { JournalReportJournalLineFact } from "@argin/accounting/journal-report";
import type { DatabaseSession, DatabaseValue } from "@argin/database";
import { SqliteAccountRepository } from "./repositories/sqlite-account-repository.ts";

interface FactRow {
  company_id: string;
  currency_code: string;
  branch_id: string | null;
  fiscal_year_id: string;
  fiscal_period_id: string;
  voucher_id: string;
  journal_line_id: string;
  voucher_date: string;
  voucher_number: string;
  voucher_reference: string | null;
  voucher_description: string | null;
  line_order: number;
  account_id: string;
  line_description: string | null;
  debit_amount: number;
  credit_amount: number;
}

interface DimensionAssignmentRow {
  line_id: string;
  dimension_type_id: string;
  member_id: string;
}

interface DimensionTypeRow {
  id: string;
  company_id: string;
  code: string;
  name: string;
  english_name: string | null;
  hierarchical: number;
  allow_multiple_members: number;
  status: AccountingDimensionType["status"];
  display_order: number;
  source: AccountingDimensionType["source"];
  source_reference_id: string | null;
  created_at: string;
  updated_at: string;
  version: number;
}

interface DimensionMemberRow {
  id: string;
  company_id: string;
  dimension_type_id: string;
  code: string;
  name: string;
  english_name: string | null;
  parent_id: string | null;
  status: AccountingDimensionMember["status"];
  valid_from: string | null;
  valid_to: string | null;
  display_order: number;
  source: AccountingDimensionMember["source"];
  source_reference_id: string | null;
  created_at: string;
  updated_at: string;
  version: number;
}

export class SqliteAccountingReportDataReader implements AccountingReportDataReader {
  private readonly accountRepository: SqliteAccountRepository;

  constructor(private readonly database: DatabaseSession) {
    this.accountRepository = new SqliteAccountRepository(database);
  }

  async read(context: AccountingReportExecutionContext): Promise<AccountingReportDataSnapshot> {
    const { query, kind } = context;
    const accounts = await this.accountRepository.findByCompanyId(query.companyId);
    const { where, parameters } = createFactWhere(context);

    const factRows = await this.database.query<FactRow>(
      `SELECT
         v.company_id, v.currency_code, v.branch_id, v.fiscal_year_id, v.fiscal_period_id,
         v.id AS voucher_id, l.id AS journal_line_id, v.voucher_date, v.voucher_number,
         v.reference AS voucher_reference, v.description AS voucher_description,
         l.line_order, l.account_id, l.description AS line_description,
         l.debit_amount, l.credit_amount
       FROM journal_vouchers v
       JOIN journal_lines l ON l.voucher_id = v.id AND l.company_id = v.company_id
       ${where}
       ORDER BY v.voucher_date, v.voucher_number, v.id, l.line_order, l.id`,
      parameters,
    );

    const dimensionsByLine = await this.readAssignments(context);
    const balanceFacts = factRows.map((row) => mapBalanceFact(row, dimensionsByLine));
    const ledgerFacts = kind === "general-ledger" || kind === "subsidiary-ledger"
      ? factRows.map((row) => mapLedgerFact(row, dimensionsByLine))
      : [];
    const journalFacts = kind === "journal"
      ? factRows.map((row) => mapJournalFact(row, dimensionsByLine))
      : [];

    const [dimensionTypes, dimensionMembers] = kind === "dimensions"
      ? await Promise.all([
          this.readDimensionTypes(query.companyId),
          this.readDimensionMembers(query.companyId),
        ])
      : [[], []] as const;

    return Object.freeze({
      accounts: Object.freeze(accounts),
      balanceFacts: Object.freeze(balanceFacts),
      ledgerFacts: Object.freeze(ledgerFacts),
      journalFacts: Object.freeze(journalFacts),
      dimensionTypes: Object.freeze(dimensionTypes),
      dimensionMembers: Object.freeze(dimensionMembers),
    });
  }

  private async readAssignments(
    context: AccountingReportExecutionContext,
  ): Promise<ReadonlyMap<string, readonly Readonly<{ dimensionTypeId: string; memberId: string }>[]>> {
    const { where, parameters } = createFactWhere(context);
    const rows = await this.database.query<DimensionAssignmentRow>(
      `SELECT a.line_id, a.dimension_type_id, a.member_id
       FROM journal_line_dimension_assignments a
       JOIN journal_lines l ON l.id = a.line_id AND l.company_id = a.company_id
       JOIN journal_vouchers v ON v.id = l.voucher_id AND v.company_id = l.company_id
       ${where}
       ORDER BY a.line_id, a.dimension_type_id, a.member_id`,
      parameters,
    );
    const result = new Map<string, Readonly<{ dimensionTypeId: string; memberId: string }>[]>();
    for (const row of rows) {
      const list = result.get(row.line_id) ?? [];
      list.push(Object.freeze({ dimensionTypeId: row.dimension_type_id, memberId: row.member_id }));
      result.set(row.line_id, list);
    }
    return new Map([...result].map(([lineId, assignments]) => [lineId, Object.freeze(assignments)]));
  }

  private async readDimensionTypes(companyId: string): Promise<AccountingDimensionType[]> {
    const rows = await this.database.query<DimensionTypeRow>(
      `SELECT * FROM accounting_dimension_types
       WHERE company_id = ? ORDER BY display_order, code, id`,
      [companyId],
    );
    return rows.map((row) => Object.freeze({
      id: row.id,
      companyId: row.company_id,
      code: row.code,
      name: row.name,
      englishName: row.english_name,
      hierarchical: row.hierarchical === 1,
      allowMultipleMembers: row.allow_multiple_members === 1,
      status: row.status,
      displayOrder: row.display_order,
      source: row.source,
      sourceReferenceId: row.source_reference_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      version: row.version,
    }));
  }

  private async readDimensionMembers(companyId: string): Promise<AccountingDimensionMember[]> {
    const rows = await this.database.query<DimensionMemberRow>(
      `SELECT * FROM accounting_dimension_members
       WHERE company_id = ? ORDER BY dimension_type_id, display_order, code, id`,
      [companyId],
    );
    return rows.map((row) => Object.freeze({
      id: row.id,
      companyId: row.company_id,
      dimensionTypeId: row.dimension_type_id,
      code: row.code,
      name: row.name,
      englishName: row.english_name,
      parentId: row.parent_id,
      status: row.status,
      validFrom: row.valid_from,
      validTo: row.valid_to,
      displayOrder: row.display_order,
      source: row.source,
      sourceReferenceId: row.source_reference_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      version: row.version,
    }));
  }
}

function createFactWhere(context: AccountingReportExecutionContext): {
  where: string;
  parameters: DatabaseValue[];
} {
  const { query } = context;
  const clauses = [
    "v.company_id = ?",
    "v.currency_code = ?",
    "v.lifecycle_status IN ('posted', 'reversed')",
    "v.voucher_date <= ?",
  ];
  const parameters: DatabaseValue[] = [query.companyId, query.currency, query.period.toDate];

  if (query.branch.mode === "branch") {
    clauses.push("v.branch_id = ?");
    parameters.push(query.branch.branchId);
  }
  if (query.period.fiscalYearId) {
    clauses.push("v.fiscal_year_id = ?");
    parameters.push(query.period.fiscalYearId);
  }
  for (const filter of query.dimensions) {
    clauses.push(`EXISTS (
      SELECT 1 FROM journal_line_dimension_assignments fd
      WHERE fd.line_id = l.id AND fd.company_id = v.company_id
        AND fd.dimension_type_id = ?
        AND fd.member_id IN (${filter.memberIds.map(() => "?").join(", ")})
    )`);
    parameters.push(filter.dimensionTypeId, ...filter.memberIds);
  }

  return { where: `WHERE ${clauses.join(" AND ")}`, parameters };
}

function mapBalanceFact(
  row: FactRow,
  dimensionsByLine: ReadonlyMap<string, readonly Readonly<{ dimensionTypeId: string; memberId: string }>[]>,
): AccountingReportJournalLineFact {
  return Object.freeze({
    companyId: row.company_id,
    currency: row.currency_code,
    branchId: row.branch_id,
    fiscalYearId: row.fiscal_year_id,
    fiscalPeriodId: row.fiscal_period_id,
    voucherId: row.voucher_id,
    journalLineId: row.journal_line_id,
    voucherDate: row.voucher_date,
    accountId: row.account_id,
    debit: row.debit_amount,
    credit: row.credit_amount,
    isPostedFact: true,
    dimensions: dimensionsByLine.get(row.journal_line_id) ?? Object.freeze([]),
  });
}

function mapLedgerFact(
  row: FactRow,
  dimensionsByLine: ReadonlyMap<string, readonly Readonly<{ dimensionTypeId: string; memberId: string }>[]>,
): GeneralLedgerJournalLineFact {
  return Object.freeze({
    ...mapBalanceFact(row, dimensionsByLine),
    voucherNumber: row.voucher_number,
    lineOrder: row.line_order,
    voucherDescription: row.voucher_description,
    lineDescription: row.line_description,
  });
}

function mapJournalFact(
  row: FactRow,
  dimensionsByLine: ReadonlyMap<string, readonly Readonly<{ dimensionTypeId: string; memberId: string }>[]>,
): JournalReportJournalLineFact {
  return Object.freeze({
    ...mapLedgerFact(row, dimensionsByLine),
    voucherReference: row.voucher_reference,
  });
}
