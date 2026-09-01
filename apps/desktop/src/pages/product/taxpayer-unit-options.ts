import type { DatabaseExecutor } from "@argin/database";

import "./product-help-controller";

export interface TaxpayerUnitOption {
  readonly code: string;
  readonly title: string;
  readonly label: string;
}

interface TaxpayerUnitRow {
  readonly code: string;
  readonly title: string;
}

/**
 * Desktop composition adapter for the versioned Taxpayer unit reference table.
 * The React page consumes bounded reference options and remains free of SQL.
 */
export async function loadTaxpayerUnitOptions(
  database: DatabaseExecutor,
  limit = 200,
): Promise<readonly TaxpayerUnitOption[]> {
  const boundedLimit = Math.max(1, Math.min(200, Math.trunc(limit)));
  const rows = await database.query<TaxpayerUnitRow>(
    `SELECT code, title
       FROM taxpayer_units
      WHERE is_active = 1
      ORDER BY title COLLATE NOCASE ASC, code ASC
      LIMIT ?`,
    [boundedLimit],
  );

  return Object.freeze(
    rows.map((row) => Object.freeze({
      code: row.code,
      title: row.title,
      label: `${row.title} — ${row.code}`,
    })),
  );
}