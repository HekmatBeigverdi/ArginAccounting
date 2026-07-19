import type {
  CreateNumberSeriesInput,
  NumberSeries,
  NumberSeriesRepository
} from "@argin/fiscal";

import type {
  DatabaseExecutor
} from "@argin/database";

interface NumberSeriesRow {
  id: string;
  company_id: string;
  branch_id: string | null;
  fiscal_year_id: string | null;
  entity_type: string;
  code: string;
  prefix: string;
  suffix: string;
  next_number: number;
  padding_length: number;
  reset_policy: NumberSeries["resetPolicy"];
  is_active: number;
  version: number;
  created_at: string;
  updated_at: string;
}

function mapNumberSeries(
  row: NumberSeriesRow
): NumberSeries {
  return {
    id: row.id,
    companyId: row.company_id,
    branchId: row.branch_id,
    fiscalYearId: row.fiscal_year_id,
    entityType: row.entity_type,
    code: row.code,
    prefix: row.prefix,
    suffix: row.suffix,
    nextNumber: row.next_number,
    paddingLength: row.padding_length,
    resetPolicy: row.reset_policy,
    isActive: row.is_active === 1,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class SqliteNumberSeriesRepository
  implements NumberSeriesRepository {
  constructor(
    private readonly database: DatabaseExecutor
  ) {}

  async create(
    input: CreateNumberSeriesInput
  ): Promise<NumberSeries> {
    const now = new Date().toISOString();

    const series: NumberSeries = {
      id: crypto.randomUUID(),
      companyId: input.companyId,
      branchId: input.branchId ?? null,
      fiscalYearId: input.fiscalYearId ?? null,
      entityType: input.entityType,
      code: input.code,
      prefix: input.prefix ?? "",
      suffix: input.suffix ?? "",
      nextNumber: input.startNumber ?? 1,
      paddingLength: input.paddingLength ?? 6,
      resetPolicy: input.resetPolicy,
      isActive: true,
      version: 1,
      createdAt: now,
      updatedAt: now
    };

    await this.database.execute(
      `
        INSERT INTO number_series (
          id,
          company_id,
          branch_id,
          fiscal_year_id,
          entity_type,
          code,
          prefix,
          suffix,
          next_number,
          padding_length,
          reset_policy,
          is_active,
          version,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        series.id,
        series.companyId,
        series.branchId,
        series.fiscalYearId,
        series.entityType,
        series.code,
        series.prefix,
        series.suffix,
        series.nextNumber,
        series.paddingLength,
        series.resetPolicy,
        series.isActive,
        series.version,
        series.createdAt,
        series.updatedAt
      ]
    );

    return series;
  }

  async findByCode(
    companyId: string,
    code: string
  ): Promise<NumberSeries | null> {
    const row =
      await this.database.queryOne<NumberSeriesRow>(
        `
          SELECT *
          FROM number_series
          WHERE company_id = ?
            AND code = ?
        `,
        [
          companyId,
          code
        ]
      );

    return row ? mapNumberSeries(row) : null;
  }

  async findApplicable(
    companyId: string,
    branchId: string | null,
    fiscalYearId: string | null,
    entityType: string
  ): Promise<NumberSeries | null> {
    const row =
      await this.database.queryOne<NumberSeriesRow>(
        `
          SELECT *
          FROM number_series
          WHERE company_id = ?
            AND entity_type = ?
            AND is_active = 1
            AND (
              branch_id = ?
              OR branch_id IS NULL
            )
            AND (
              fiscal_year_id = ?
              OR fiscal_year_id IS NULL
            )
          ORDER BY
            CASE
              WHEN branch_id IS NOT NULL THEN 0
              ELSE 1
            END,
            CASE
              WHEN fiscal_year_id IS NOT NULL THEN 0
              ELSE 1
            END
          LIMIT 1
        `,
        [
          companyId,
          entityType,
          branchId,
          fiscalYearId
        ]
      );

    return row ? mapNumberSeries(row) : null;
  }

  async reserveNext(
    seriesId: string
  ): Promise<{
    series: NumberSeries;
    reservedNumber: number;
  }> {
    return this.database.transaction(
      async (transaction) => {
        const row =
          await transaction.queryOne<NumberSeriesRow>(
            `
              SELECT *
              FROM number_series
              WHERE id = ?
                AND is_active = 1
            `,
            [seriesId]
          );

        if (!row) {
          throw new Error(
            "Number series does not exist."
          );
        }

        const series = mapNumberSeries(row);
        const reservedNumber = series.nextNumber;
        const nextVersion = series.version + 1;
        const updatedAt = new Date().toISOString();

        const result = await transaction.execute(
          `
            UPDATE number_series
            SET
              next_number = ?,
              version = ?,
              updated_at = ?
            WHERE id = ?
              AND version = ?
          `,
          [
            reservedNumber + 1,
            nextVersion,
            updatedAt,
            series.id,
            series.version
          ]
        );

        if (result.rowsAffected !== 1) {
          throw new Error(
            "Number series concurrency conflict."
          );
        }

        return {
          series: {
            ...series,
            nextNumber: reservedNumber + 1,
            version: nextVersion,
            updatedAt
          },
          reservedNumber
        };
      }
    );
  }
}
