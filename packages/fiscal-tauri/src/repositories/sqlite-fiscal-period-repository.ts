import type {
  CreateFiscalPeriodInput,
  FiscalPeriod,
  FiscalPeriodRepository
} from "@argin/fiscal";

import type {
  DatabaseExecutor
} from "@argin/database";

interface FiscalPeriodRow {
  id: string;
  fiscal_year_id: string;
  sequence: number;
  code: string;
  title: string;
  start_date: string;
  end_date: string;
  status: FiscalPeriod["status"];
  lock_reason: string | null;
  locked_at: string | null;
  locked_by: string | null;
  created_at: string;
  updated_at: string;
}

function mapFiscalPeriod(
  row: FiscalPeriodRow
): FiscalPeriod {
  return {
    id: row.id,
    fiscalYearId: row.fiscal_year_id,
    sequence: row.sequence,
    code: row.code,
    title: row.title,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    lockReason: row.lock_reason,
    lockedAt: row.locked_at,
    lockedBy: row.locked_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class SqliteFiscalPeriodRepository
  implements FiscalPeriodRepository {
  constructor(
    private readonly database: DatabaseExecutor
  ) {}

  async create(
    input: CreateFiscalPeriodInput
  ): Promise<FiscalPeriod> {
    const now = new Date().toISOString();

    const period: FiscalPeriod = {
      id: crypto.randomUUID(),
      fiscalYearId: input.fiscalYearId,
      sequence: input.sequence,
      code: input.code,
      title: input.title,
      startDate: input.startDate,
      endDate: input.endDate,
      status: "open",
      lockReason: null,
      lockedAt: null,
      lockedBy: null,
      createdAt: now,
      updatedAt: now
    };

    await this.database.execute(
      `
        INSERT INTO fiscal_periods (
          id,
          fiscal_year_id,
          sequence,
          code,
          title,
          start_date,
          end_date,
          status,
          lock_reason,
          locked_at,
          locked_by,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        period.id,
        period.fiscalYearId,
        period.sequence,
        period.code,
        period.title,
        period.startDate,
        period.endDate,
        period.status,
        period.lockReason,
        period.lockedAt,
        period.lockedBy,
        period.createdAt,
        period.updatedAt
      ]
    );

    return period;
  }

  async createMany(
    inputs: CreateFiscalPeriodInput[]
  ): Promise<FiscalPeriod[]> {
    const periods: FiscalPeriod[] = [];

    for (const input of inputs) {
      periods.push(await this.create(input));
    }

    return periods;
  }

  async findById(
    id: string
  ): Promise<FiscalPeriod | null> {
    const row =
      await this.database.queryOne<FiscalPeriodRow>(
        "SELECT * FROM fiscal_periods WHERE id = ?",
        [id]
      );

    return row ? mapFiscalPeriod(row) : null;
  }

  async findByFiscalYearId(
    fiscalYearId: string
  ): Promise<FiscalPeriod[]> {
    const rows =
      await this.database.query<FiscalPeriodRow>(
        `
          SELECT *
          FROM fiscal_periods
          WHERE fiscal_year_id = ?
          ORDER BY sequence
        `,
        [fiscalYearId]
      );

    return rows.map(mapFiscalPeriod);
  }

  async findByDate(
    fiscalYearId: string,
    date: string
  ): Promise<FiscalPeriod | null> {
    const row =
      await this.database.queryOne<FiscalPeriodRow>(
        `
          SELECT *
          FROM fiscal_periods
          WHERE fiscal_year_id = ?
            AND start_date <= ?
            AND end_date >= ?
          LIMIT 1
        `,
        [
          fiscalYearId,
          date,
          date
        ]
      );

    return row ? mapFiscalPeriod(row) : null;
  }

  async updateStatus(
    periodId: string,
    status: FiscalPeriod["status"],
    lockReason: string | null,
    lockedBy: string | null,
    updatedAt: string
  ): Promise<void> {
    await this.database.execute(
      `
        UPDATE fiscal_periods
        SET
          status = ?,
          lock_reason = ?,
          locked_at = ?,
          locked_by = ?,
          updated_at = ?
        WHERE id = ?
      `,
      [
        status,
        lockReason,
        status === "locked" ? updatedAt : null,
        lockedBy,
        updatedAt,
        periodId
      ]
    );
  }
}
