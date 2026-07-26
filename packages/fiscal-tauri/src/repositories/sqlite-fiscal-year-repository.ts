import type {
  CreateFiscalYearInput,
  FiscalYear,
  FiscalYearRepository
} from "@argin/fiscal";

import type {
  DatabaseSession
} from "@argin/database";

interface FiscalYearRow {
  id: string;
  company_id: string;
  code: string;
  title: string;
  start_date: string;
  end_date: string;
  status: FiscalYear["status"];
  is_current: number;
  closed_at: string | null;
  closed_by: string | null;
  created_at: string;
  updated_at: string;
}

function mapFiscalYear(
  row: FiscalYearRow
): FiscalYear {
  return {
    id: row.id,
    companyId: row.company_id,
    code: row.code,
    title: row.title,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    isCurrent: row.is_current === 1,
    closedAt: row.closed_at,
    closedBy: row.closed_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class SqliteFiscalYearRepository
  implements FiscalYearRepository {
  constructor(
    private readonly database: DatabaseSession
  ) {}

  async create(
    input: CreateFiscalYearInput
  ): Promise<FiscalYear> {
    const now = new Date().toISOString();

    const fiscalYear: FiscalYear = {
      id: crypto.randomUUID(),
      companyId: input.companyId,
      code: input.code,
      title: input.title,
      startDate: input.startDate,
      endDate: input.endDate,
      status: "open",
      isCurrent: false,
      closedAt: null,
      closedBy: null,
      createdAt: now,
      updatedAt: now
    };

    await this.database.execute(
      `
        INSERT INTO fiscal_years (
          id,
          company_id,
          code,
          title,
          start_date,
          end_date,
          status,
          is_current,
          closed_at,
          closed_by,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        fiscalYear.id,
        fiscalYear.companyId,
        fiscalYear.code,
        fiscalYear.title,
        fiscalYear.startDate,
        fiscalYear.endDate,
        fiscalYear.status,
        fiscalYear.isCurrent,
        fiscalYear.closedAt,
        fiscalYear.closedBy,
        fiscalYear.createdAt,
        fiscalYear.updatedAt
      ]
    );

    return fiscalYear;
  }

  async findById(
    id: string
  ): Promise<FiscalYear | null> {
    const row =
      await this.database.queryOne<FiscalYearRow>(
        "SELECT * FROM fiscal_years WHERE id = ?",
        [id]
      );

    return row ? mapFiscalYear(row) : null;
  }

  async findByCompanyId(
    companyId: string
  ): Promise<FiscalYear[]> {
    const rows =
      await this.database.query<FiscalYearRow>(
        `
          SELECT *
          FROM fiscal_years
          WHERE company_id = ?
          ORDER BY start_date DESC
        `,
        [companyId]
      );

    return rows.map(mapFiscalYear);
  }

  async findCurrent(
    companyId: string
  ): Promise<FiscalYear | null> {
    const row =
      await this.database.queryOne<FiscalYearRow>(
        `
          SELECT *
          FROM fiscal_years
          WHERE company_id = ?
            AND is_current = 1
        `,
        [companyId]
      );

    return row ? mapFiscalYear(row) : null;
  }

  async findOverlapping(
    companyId: string,
    startDate: string,
    endDate: string
  ): Promise<FiscalYear | null> {
    const row =
      await this.database.queryOne<FiscalYearRow>(
        `
          SELECT *
          FROM fiscal_years
          WHERE company_id = ?
            AND start_date <= ?
            AND end_date >= ?
          LIMIT 1
        `,
        [
          companyId,
          endDate,
          startDate
        ]
      );

    return row ? mapFiscalYear(row) : null;
  }

  async setCurrent(
    companyId: string,
    fiscalYearId: string
  ): Promise<void> {
    const now = new Date().toISOString();

    await this.database.execute(
      `
        UPDATE fiscal_years
        SET
          is_current = 0,
          updated_at = ?
        WHERE company_id = ?
      `,
      [now, companyId]
    );

    await this.database.execute(
      `
        UPDATE fiscal_years
        SET
          is_current = 1,
          updated_at = ?
        WHERE id = ?
          AND company_id = ?
      `,
      [
        now,
        fiscalYearId,
        companyId
      ]
    );
  }

  async updateStatus(
    fiscalYearId: string,
    status: FiscalYear["status"],
    updatedAt: string
  ): Promise<void> {
    await this.database.execute(
      `
        UPDATE fiscal_years
        SET
          status = ?,
          updated_at = ?
        WHERE id = ?
      `,
      [
        status,
        updatedAt,
        fiscalYearId
      ]
    );
  }
}
