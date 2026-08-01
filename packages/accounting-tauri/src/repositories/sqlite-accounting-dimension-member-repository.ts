import {
  normalizeAccountingDimensionMemberSearchQuery,
  type AccountingDimensionMember,
  type AccountingDimensionMemberRepository,
  type AccountingDimensionMemberSearchQuery,
  type AccountingDimensionMemberSortField,
} from "@argin/accounting";
import { assertVersionedUpdate, type DatabaseSession } from "@argin/database";
import { queryPage, sqlOrderBy } from "./sqlite-dimension-query.ts";

interface Row {
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

const columns: Record<AccountingDimensionMemberSortField, string> = {
  displayOrder: "display_order",
  code: "code",
  name: "name",
  validFrom: "valid_from",
  createdAt: "created_at",
  id: "id",
};

const mapRow = (row: Row): AccountingDimensionMember =>
  Object.freeze({
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
  });

export class SqliteAccountingDimensionMemberRepository
  implements AccountingDimensionMemberRepository
{
  constructor(private readonly database: DatabaseSession) {}

  async create(member: AccountingDimensionMember): Promise<void> {
    await this.database.execute(
      `INSERT INTO accounting_dimension_members (
        id, company_id, dimension_type_id, code, name, english_name, parent_id,
        status, valid_from, valid_to, display_order, source, source_reference_id,
        created_at, updated_at, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      this.createParams(member),
    );
  }

  async findById(id: string) {
    const row = await this.database.queryOne<Row>(
      "SELECT * FROM accounting_dimension_members WHERE id = ?",
      [id],
    );

    return row ? mapRow(row) : null;
  }

  async findByCode(companyId: string, dimensionTypeId: string, code: string) {
    const row = await this.database.queryOne<Row>(
      `SELECT * FROM accounting_dimension_members
       WHERE company_id = ? AND dimension_type_id = ? AND code = ? COLLATE NOCASE`,
      [companyId, dimensionTypeId, code],
    );

    return row ? mapRow(row) : null;
  }

  async findChildren(companyId: string, parentId: string) {
    const rows = await this.database.query<Row>(
      `SELECT * FROM accounting_dimension_members
       WHERE company_id = ? AND parent_id = ?
       ORDER BY display_order, code, id`,
      [companyId, parentId],
    );

    return rows.map(mapRow);
  }

  async search(input: AccountingDimensionMemberSearchQuery) {
    const query = normalizeAccountingDimensionMemberSearchQuery(input);
    const where = ["company_id = ?"];
    const params: (string | number | null)[] = [query.companyId];

    if (query.dimensionTypeId) {
      where.push("dimension_type_id = ?");
      params.push(query.dimensionTypeId);
    }

    if (query.status) {
      where.push("status = ?");
      params.push(query.status);
    }

    if (query.parentId !== undefined) {
      where.push(query.parentId === null ? "parent_id IS NULL" : "parent_id = ?");

      if (query.parentId !== null) {
        params.push(query.parentId);
      }
    }

    if (query.effectiveOn) {
      where.push(
        "(valid_from IS NULL OR valid_from <= ?)",
        "(valid_to IS NULL OR valid_to >= ?)",
      );
      params.push(query.effectiveOn, query.effectiveOn);
    }

    if (query.text) {
      where.push(
        "(code LIKE ? ESCAPE '\\' OR name LIKE ? ESCAPE '\\' OR english_name LIKE ? ESCAPE '\\')",
      );
      const searchPattern = `%${escapeLike(query.text)}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    return queryPage<Row, AccountingDimensionMember>(
      this.database,
      "accounting_dimension_members",
      where,
      params,
      sqlOrderBy(query.sorts, columns),
      query.pagination,
      mapRow,
    );
  }

  async update(member: AccountingDimensionMember): Promise<void> {
    const result = await this.database.execute(
      `UPDATE accounting_dimension_members
       SET dimension_type_id = ?, code = ?, name = ?, english_name = ?,
           parent_id = ?, status = ?, valid_from = ?, valid_to = ?,
           display_order = ?, source = ?, source_reference_id = ?,
           updated_at = ?, version = ?
       WHERE id = ? AND company_id = ? AND version = ?`,
      [
        member.dimensionTypeId,
        member.code,
        member.name,
        member.englishName,
        member.parentId,
        member.status,
        member.validFrom,
        member.validTo,
        member.displayOrder,
        member.source,
        member.sourceReferenceId,
        member.updatedAt,
        member.version,
        member.id,
        member.companyId,
        member.version - 1,
      ],
    );

    assertVersionedUpdate(result, {
      entityType: "AccountingDimensionMember",
      entityId: member.id,
      expectedVersion: member.version - 1,
    });
  }

  async delete(member: AccountingDimensionMember): Promise<void> {
    const result = await this.database.execute(
      `DELETE FROM accounting_dimension_members
       WHERE id = ? AND company_id = ? AND version = ?`,
      [member.id, member.companyId, member.version],
    );

    assertVersionedUpdate(result, {
      entityType: "AccountingDimensionMember",
      entityId: member.id,
      expectedVersion: member.version,
    });
  }

  private createParams(member: AccountingDimensionMember) {
    return [
      member.id,
      member.companyId,
      member.dimensionTypeId,
      member.code,
      member.name,
      member.englishName,
      member.parentId,
      member.status,
      member.validFrom,
      member.validTo,
      member.displayOrder,
      member.source,
      member.sourceReferenceId,
      member.createdAt,
      member.updatedAt,
      member.version,
    ];
  }
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}
