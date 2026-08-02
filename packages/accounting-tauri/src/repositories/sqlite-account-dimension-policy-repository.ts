import {
  normalizeAccountDimensionPolicySearchQuery,
  type AccountDimensionPolicy,
  type AccountDimensionPolicyRepository,
  type AccountDimensionPolicySearchQuery,
  type AccountDimensionPolicySortField,
} from "@argin/accounting";
import { assertVersionedUpdate, type DatabaseSession } from "@argin/database";
import { queryPage, sqlOrderBy } from "./sqlite-dimension-query.ts";

interface Row {
  id: string;
  company_id: string;
  account_id: string;
  dimension_type_id: string;
  requirement: AccountDimensionPolicy["requirement"];
  created_at: string;
  updated_at: string;
  version: number;
}

const columns: Record<AccountDimensionPolicySortField, string> = {
  accountId: "account_id",
  dimensionTypeId: "dimension_type_id",
  requirement: "requirement",
  createdAt: "created_at",
  id: "id",
};

const mapRow = (row: Row): AccountDimensionPolicy =>
  Object.freeze({
    id: row.id,
    companyId: row.company_id,
    accountId: row.account_id,
    dimensionTypeId: row.dimension_type_id,
    requirement: row.requirement,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
  });

export class SqliteAccountDimensionPolicyRepository
  implements AccountDimensionPolicyRepository
{
  constructor(private readonly database: DatabaseSession) {}

  async create(policy: AccountDimensionPolicy): Promise<void> {
    await this.database.execute(
      `INSERT INTO account_dimension_policies (
        id, company_id, account_id, dimension_type_id, requirement,
        created_at, updated_at, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      this.createParams(policy),
    );
  }

  async findById(id: string) {
    const row = await this.database.queryOne<Row>(
      "SELECT * FROM account_dimension_policies WHERE id = ?",
      [id],
    );

    return row ? mapRow(row) : null;
  }

  async findByAccountAndType(
    companyId: string,
    accountId: string,
    dimensionTypeId: string,
  ) {
    const row = await this.database.queryOne<Row>(
      `SELECT * FROM account_dimension_policies
       WHERE company_id = ? AND account_id = ? AND dimension_type_id = ?`,
      [companyId, accountId, dimensionTypeId],
    );

    return row ? mapRow(row) : null;
  }

  async findByAccountId(companyId: string, accountId: string) {
    const rows = await this.database.query<Row>(
      `SELECT * FROM account_dimension_policies
       WHERE company_id = ? AND account_id = ?
       ORDER BY dimension_type_id, id`,
      [companyId, accountId],
    );

    return rows.map(mapRow);
  }

  async search(input: AccountDimensionPolicySearchQuery) {
    const query = normalizeAccountDimensionPolicySearchQuery(input);
    const where = ["company_id = ?"];
    const params: string[] = [query.companyId];

    if (query.accountId) {
      where.push("account_id = ?");
      params.push(query.accountId);
    }

    if (query.dimensionTypeId) {
      where.push("dimension_type_id = ?");
      params.push(query.dimensionTypeId);
    }

    if (query.requirement) {
      where.push("requirement = ?");
      params.push(query.requirement);
    }

    return queryPage<Row, AccountDimensionPolicy>(
      this.database,
      "account_dimension_policies",
      where,
      params,
      sqlOrderBy(query.sorts, columns),
      query.pagination,
      mapRow,
    );
  }

  async update(policy: AccountDimensionPolicy): Promise<void> {
    const result = await this.database.execute(
      `UPDATE account_dimension_policies
       SET account_id = ?, dimension_type_id = ?, requirement = ?,
           updated_at = ?, version = ?
       WHERE id = ? AND company_id = ? AND version = ?`,
      [
        policy.accountId,
        policy.dimensionTypeId,
        policy.requirement,
        policy.updatedAt,
        policy.version,
        policy.id,
        policy.companyId,
        policy.version - 1,
      ],
    );

    assertVersionedUpdate(result, {
      entityType: "AccountDimensionPolicy",
      entityId: policy.id,
      expectedVersion: policy.version - 1,
    });
  }

  async delete(policy: AccountDimensionPolicy): Promise<void> {
    const result = await this.database.execute(
      `DELETE FROM account_dimension_policies
       WHERE id = ? AND company_id = ? AND version = ?`,
      [policy.id, policy.companyId, policy.version],
    );

    assertVersionedUpdate(result, {
      entityType: "AccountDimensionPolicy",
      entityId: policy.id,
      expectedVersion: policy.version,
    });
  }

  private createParams(policy: AccountDimensionPolicy) {
    return [
      policy.id,
      policy.companyId,
      policy.accountId,
      policy.dimensionTypeId,
      policy.requirement,
      policy.createdAt,
      policy.updatedAt,
      policy.version,
    ];
  }
}
