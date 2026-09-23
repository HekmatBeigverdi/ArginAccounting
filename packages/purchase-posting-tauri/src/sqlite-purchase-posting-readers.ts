import type { DatabaseSession, DatabaseValue } from "@argin/database";
import type {
  AccountDimensionPolicy,
  AccountingDimensionMember,
  AccountingDimensionType,
} from "@argin/accounting";
import type {
  PurchasePostingAccountReader,
  PurchasePostingAccountSnapshot,
  PurchasePostingDimensionReader,
  PurchasePostingDimensionSource,
  PurchasePostingFiscalContext,
  PurchasePostingHistoricalLock,
  PurchasePostingHistoricalLockScope,
} from "@argin/purchase-posting";

type AccountRow = {
  id: string;
  company_id: string;
  code: string;
  name: string;
  status: "active" | "inactive";
  posting_allowed: number;
};

type FiscalRow = {
  company_id: string;
  fiscal_year_id: string;
  fiscal_year_start_date: string;
  fiscal_year_end_date: string;
  fiscal_year_status: PurchasePostingFiscalContext["fiscalYearStatus"];
  fiscal_period_id: string;
  fiscal_period_start_date: string;
  fiscal_period_end_date: string;
  fiscal_period_status: PurchasePostingFiscalContext["fiscalPeriodStatus"];
};

type LockRow = {
  scope: PurchasePostingHistoricalLockScope;
  locked_through_date: string;
};

type PolicyRow = {
  id: string;
  company_id: string;
  account_id: string;
  dimension_type_id: string;
  requirement: AccountDimensionPolicy["requirement"];
  created_at: string;
  updated_at: string;
  version: number;
};

type TypeRow = {
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
};

type MemberRow = {
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
};

const mapPolicy = (row: PolicyRow): AccountDimensionPolicy => Object.freeze({
  id: row.id,
  companyId: row.company_id,
  accountId: row.account_id,
  dimensionTypeId: row.dimension_type_id,
  requirement: row.requirement,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  version: row.version,
});

const mapType = (row: TypeRow): AccountingDimensionType => Object.freeze({
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

const mapMember = (row: MemberRow): AccountingDimensionMember => Object.freeze({
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

export class SqlitePurchasePostingAccountReader implements PurchasePostingAccountReader {
  constructor(private readonly db: DatabaseSession) {}

  async findById(companyId: string, accountId: string): Promise<PurchasePostingAccountSnapshot | null> {
    const row = await this.db.queryOne<AccountRow>(
      "SELECT id,company_id,code,name,status,posting_allowed FROM accounts WHERE company_id=? AND id=?",
      [companyId, accountId],
    );
    return row ? Object.freeze({
      accountId: row.id,
      companyId: row.company_id,
      code: row.code,
      name: row.name,
      status: row.status,
      postingAllowed: row.posting_allowed === 1,
    }) : null;
  }
}

export class SqlitePurchasePostingFiscalReader {
  constructor(private readonly db: DatabaseSession) {}

  async resolve(companyId: string, operationDate: string): Promise<PurchasePostingFiscalContext | null> {
    const row = await this.db.queryOne<FiscalRow>(
      `SELECT fy.company_id,
              fy.id AS fiscal_year_id, fy.start_date AS fiscal_year_start_date,
              fy.end_date AS fiscal_year_end_date, fy.status AS fiscal_year_status,
              fp.id AS fiscal_period_id, fp.start_date AS fiscal_period_start_date,
              fp.end_date AS fiscal_period_end_date, fp.status AS fiscal_period_status
         FROM fiscal_years fy
         JOIN fiscal_periods fp ON fp.fiscal_year_id=fy.id
        WHERE fy.company_id=?
          AND fy.start_date<=? AND fy.end_date>=?
          AND fp.start_date<=? AND fp.end_date>=?
        ORDER BY fp.sequence
        LIMIT 1`,
      [companyId, operationDate, operationDate, operationDate, operationDate],
    );
    return row ? Object.freeze({
      companyId: row.company_id,
      fiscalYearId: row.fiscal_year_id,
      fiscalYearStartDate: row.fiscal_year_start_date,
      fiscalYearEndDate: row.fiscal_year_end_date,
      fiscalYearStatus: row.fiscal_year_status,
      fiscalPeriodId: row.fiscal_period_id,
      fiscalPeriodStartDate: row.fiscal_period_start_date,
      fiscalPeriodEndDate: row.fiscal_period_end_date,
      fiscalPeriodStatus: row.fiscal_period_status,
    }) : null;
  }

  async findActiveHistoricalLocks(
    companyId: string,
    branchId: string | null,
    scope: PurchasePostingHistoricalLockScope,
  ): Promise<readonly PurchasePostingHistoricalLock[]> {
    const rows = await this.db.query<LockRow>(
      `SELECT scope,locked_through_date
         FROM historical_locks
        WHERE company_id=? AND is_active=1
          AND (branch_id IS NULL OR branch_id=?)
          AND (?='all' AND scope='all' OR ?<>'all' AND (scope='all' OR scope=?))
        ORDER BY locked_through_date DESC`,
      [companyId, branchId, scope, scope, scope],
    );
    return Object.freeze(rows.map(row => Object.freeze({
      scope: row.scope,
      lockedThroughDate: row.locked_through_date,
    })));
  }
}

const DIMENSION_CODES: Readonly<Record<PurchasePostingDimensionSource, readonly string[]>> = Object.freeze({
  party: Object.freeze(["PARTY"]),
  product: Object.freeze(["PRODUCT"]),
  warehouse: Object.freeze(["WAREHOUSE"]),
  "cost-center": Object.freeze(["COST_CENTER", "COSTCENTER"]),
  project: Object.freeze(["PROJECT"]),
});

export class SqlitePurchasePostingDimensionReader implements PurchasePostingDimensionReader {
  constructor(private readonly db: DatabaseSession) {}

  async findPoliciesForAccount(companyId: string, accountId: string): Promise<readonly AccountDimensionPolicy[]> {
    const rows = await this.db.query<PolicyRow>(
      "SELECT * FROM account_dimension_policies WHERE company_id=? AND account_id=? ORDER BY dimension_type_id,id",
      [companyId, accountId],
    );
    return Object.freeze(rows.map(mapPolicy));
  }

  async findTypesByCompanyId(companyId: string): Promise<readonly AccountingDimensionType[]> {
    const rows = await this.db.query<TypeRow>(
      "SELECT * FROM accounting_dimension_types WHERE company_id=? ORDER BY display_order,code,id",
      [companyId],
    );
    return Object.freeze(rows.map(mapType));
  }

  async resolveMemberBySource(
    companyId: string,
    source: PurchasePostingDimensionSource,
    sourceReferenceId: string,
  ): Promise<AccountingDimensionMember | null> {
    const codes = DIMENSION_CODES[source];
    const placeholders = codes.map(() => "?").join(",");
    const parameters: DatabaseValue[] = [companyId, sourceReferenceId, ...codes];
    const row = await this.db.queryOne<MemberRow>(
      `SELECT m.*
         FROM accounting_dimension_members m
         JOIN accounting_dimension_types t
           ON t.company_id=m.company_id AND t.id=m.dimension_type_id
        WHERE m.company_id=?
          AND m.source_reference_id=?
          AND upper(t.code) IN (${placeholders})
        ORDER BY t.display_order,t.code,m.display_order,m.id
        LIMIT 1`,
      parameters,
    );
    return row ? mapMember(row) : null;
  }

  async findMembersByIds(ids: readonly string[]): Promise<readonly AccountingDimensionMember[]> {
    if (ids.length === 0) return Object.freeze([]);
    const rows = await this.db.query<MemberRow>(
      `SELECT * FROM accounting_dimension_members
        WHERE id IN (${ids.map(() => "?").join(",")})
        ORDER BY dimension_type_id,id`,
      ids,
    );
    return Object.freeze(rows.map(mapMember));
  }
}
