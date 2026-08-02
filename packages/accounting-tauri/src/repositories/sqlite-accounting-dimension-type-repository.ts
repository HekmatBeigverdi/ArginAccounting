import {
  normalizeAccountingDimensionTypeSearchQuery,
  type AccountingDimensionType,
  type AccountingDimensionTypeRepository,
  type AccountingDimensionTypeSearchQuery,
  type AccountingDimensionTypeSortField,
} from "@argin/accounting";
import { assertVersionedUpdate, type DatabaseSession } from "@argin/database";
import { queryPage, sqlOrderBy } from "./sqlite-dimension-query.ts";

interface Row {
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

const columns: Record<AccountingDimensionTypeSortField, string> = {
  displayOrder: "display_order",
  code: "code",
  name: "name",
  createdAt: "created_at",
  id: "id",
};

const mapRow = (row: Row): AccountingDimensionType =>
  Object.freeze({
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
  });

export class SqliteAccountingDimensionTypeRepository
  implements AccountingDimensionTypeRepository
{
  constructor(private readonly database: DatabaseSession) {}

  async create(dimensionType: AccountingDimensionType): Promise<void> {
    await this.database.execute(
      `INSERT INTO accounting_dimension_types (
        id, company_id, code, name, english_name, hierarchical,
        allow_multiple_members, status, display_order, source,
        source_reference_id, created_at, updated_at, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      this.createParams(dimensionType),
    );
  }

  async findById(id: string) {
    const row = await this.database.queryOne<Row>(
      "SELECT * FROM accounting_dimension_types WHERE id = ?",
      [id],
    );

    return row ? mapRow(row) : null;
  }

  async findByCode(companyId: string, code: string) {
    const row = await this.database.queryOne<Row>(
      `SELECT * FROM accounting_dimension_types
       WHERE company_id = ? AND code = ? COLLATE NOCASE`,
      [companyId, code],
    );

    return row ? mapRow(row) : null;
  }

  async search(input: AccountingDimensionTypeSearchQuery) {
    const query = normalizeAccountingDimensionTypeSearchQuery(input);
    const where = ["company_id = ?"];
    const params: (string | number | null)[] = [query.companyId];

    if (query.status) {
      where.push("status = ?");
      params.push(query.status);
    }

    if (query.text) {
      where.push(
        "(code LIKE ? ESCAPE '\\' OR name LIKE ? ESCAPE '\\' OR english_name LIKE ? ESCAPE '\\')",
      );
      const searchPattern = `%${escapeLike(query.text)}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    return queryPage<Row, AccountingDimensionType>(
      this.database,
      "accounting_dimension_types",
      where,
      params,
      sqlOrderBy(query.sorts, columns),
      query.pagination,
      mapRow,
    );
  }

  async update(dimensionType: AccountingDimensionType): Promise<void> {
    const result = await this.database.execute(
      `UPDATE accounting_dimension_types
       SET code = ?, name = ?, english_name = ?, hierarchical = ?,
           allow_multiple_members = ?, status = ?, display_order = ?, source = ?,
           source_reference_id = ?, updated_at = ?, version = ?
       WHERE id = ? AND company_id = ? AND version = ?`,
      [
        dimensionType.code,
        dimensionType.name,
        dimensionType.englishName,
        dimensionType.hierarchical ? 1 : 0,
        dimensionType.allowMultipleMembers ? 1 : 0,
        dimensionType.status,
        dimensionType.displayOrder,
        dimensionType.source,
        dimensionType.sourceReferenceId,
        dimensionType.updatedAt,
        dimensionType.version,
        dimensionType.id,
        dimensionType.companyId,
        dimensionType.version - 1,
      ],
    );

    assertVersionedUpdate(result, {
      entityType: "AccountingDimensionType",
      entityId: dimensionType.id,
      expectedVersion: dimensionType.version - 1,
    });
  }

  async delete(dimensionType: AccountingDimensionType): Promise<void> {
    const result = await this.database.execute(
      `DELETE FROM accounting_dimension_types
       WHERE id = ? AND company_id = ? AND version = ?`,
      [dimensionType.id, dimensionType.companyId, dimensionType.version],
    );

    assertVersionedUpdate(result, {
      entityType: "AccountingDimensionType",
      entityId: dimensionType.id,
      expectedVersion: dimensionType.version,
    });
  }

  private createParams(dimensionType: AccountingDimensionType) {
    return [
      dimensionType.id,
      dimensionType.companyId,
      dimensionType.code,
      dimensionType.name,
      dimensionType.englishName,
      dimensionType.hierarchical ? 1 : 0,
      dimensionType.allowMultipleMembers ? 1 : 0,
      dimensionType.status,
      dimensionType.displayOrder,
      dimensionType.source,
      dimensionType.sourceReferenceId,
      dimensionType.createdAt,
      dimensionType.updatedAt,
      dimensionType.version,
    ];
  }
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}
