import {
  createCodingTemplateVersion,
  normalizeCodingTemplateApplicationHistoryQuery,
  normalizeCodingTemplateImportHistoryQuery,
  normalizeCodingTemplateSearchQuery,
  normalizeCodingTemplateVersionSearchQuery,
  type CodingTemplate,
  type CodingTemplateApplicationHistory,
  type CodingTemplateApplicationHistoryRepository,
  type CodingTemplateApplicationItemMapping,
  type CodingTemplateApplicationItemMappingRepository,
  type CodingTemplateCompanyBaseline,
  type CodingTemplateCompanyBaselineRepository,
  type CodingTemplateImportHistory,
  type CodingTemplateImportHistoryRepository,
  type CodingTemplateRepository,
  type CodingTemplateVersionRecord,
  type CodingTemplateVersionRepository,
} from "@argin/accounting";
import { assertVersionedUpdate, type DatabaseSession, type DatabaseValue } from "@argin/database";
import { queryPage, sqlOrderBy } from "./sqlite-dimension-query.ts";

type TemplateRow = { id: string; code: string; persian_name: string; english_name: string | null; activity_type: CodingTemplate["activityType"]; ownership: CodingTemplate["ownership"]; lifecycle: CodingTemplate["lifecycle"]; latest_published_version: number | null; created_at: string; updated_at: string; version: number };
type VersionRow = { id: string; template_id: string; template_code: string; version_number: number; persian_name: string; english_name: string | null; activity_type: CodingTemplate["activityType"]; ownership: CodingTemplate["ownership"]; source_type: "catalog" | "excel" | "manual"; source_reference: string | null; contract_version: string; content_fingerprint: string; published_at: string; published_by: string };
type ApplicationRow = { id: string; company_id: string; template_id: string; template_version_id: string; request_key: string; status: CodingTemplateApplicationHistory["status"]; baseline_fingerprint: string; applied_at: string | null; actor_id: string | null; created_at: string };
type MappingRow = { application_id: string; company_id: string; template_version_id: string; item_type: CodingTemplateApplicationItemMapping["itemType"]; logical_key: string; operational_id: string; action: CodingTemplateApplicationItemMapping["action"] };
type ImportRow = { id: string; import_key: string; file_name: string; file_fingerprint: string; contract_version: string; status: CodingTemplateImportHistory["status"]; template_id: string | null; template_version_id: string | null; actor_id: string | null; created_at: string; completed_at: string | null };

const template = (r: TemplateRow): CodingTemplate =>
  Object.freeze({
    id: r.id as CodingTemplate["id"],
    code: r.code as CodingTemplate["code"],
    persianName: r.persian_name as CodingTemplate["persianName"],
    englishName: r.english_name as CodingTemplate["englishName"],
    activityType: r.activity_type,
    ownership: r.ownership,
    lifecycle: r.lifecycle,
    latestPublishedVersion: r.latest_published_version,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    optimisticVersion: r.version,
  });

const application = (r: ApplicationRow): CodingTemplateApplicationHistory =>
  Object.freeze({
    id: r.id,
    companyId: r.company_id,
    templateId: r.template_id,
    templateVersionId: r.template_version_id,
    requestKey: r.request_key,
    status: r.status,
    baselineFingerprint: r.baseline_fingerprint,
    appliedAt: r.applied_at,
    actorId: r.actor_id,
    createdAt: r.created_at,
  });

const mapping = (r: MappingRow): CodingTemplateApplicationItemMapping =>
  Object.freeze({
    applicationId: r.application_id,
    companyId: r.company_id,
    templateVersionId: r.template_version_id,
    itemType: r.item_type,
    logicalKey: r.logical_key,
    operationalId: r.operational_id,
    action: r.action,
  });

const imported = (r: ImportRow): CodingTemplateImportHistory =>
  Object.freeze({
    id: r.id,
    importKey: r.import_key,
    fileName: r.file_name,
    fileFingerprint: r.file_fingerprint,
    contractVersion: r.contract_version,
    status: r.status,
    templateId: r.template_id,
    templateVersionId: r.template_version_id,
    actorId: r.actor_id,
    createdAt: r.created_at,
    completedAt: r.completed_at,
  });

export class SqliteCodingTemplateRepository implements CodingTemplateRepository {
  constructor(private readonly db: DatabaseSession) {}

  async create(v: Readonly<CodingTemplate>): Promise<void> {
    await this.db.execute(
      `INSERT INTO coding_templates
       (id, code, persian_name, english_name, activity_type, ownership, lifecycle,
        latest_published_version, created_at, updated_at, version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        v.id,
        v.code,
        v.persianName,
        v.englishName,
        v.activityType,
        v.ownership,
        v.lifecycle,
        v.latestPublishedVersion,
        v.createdAt,
        v.updatedAt,
        v.optimisticVersion,
      ],
    );
  }

  async findById(id: string): Promise<CodingTemplate | null> {
    const r = await this.db.queryOne<TemplateRow>(
      `SELECT * FROM coding_templates WHERE id = ?`,
      [id],
    );
    return r ? template(r) : null;
  }

  async findByCode(code: string): Promise<CodingTemplate | null> {
    const r = await this.db.queryOne<TemplateRow>(
      `SELECT * FROM coding_templates WHERE code = ? COLLATE NOCASE`,
      [code],
    );
    return r ? template(r) : null;
  }

  async search(input: Parameters<CodingTemplateRepository["search"]>[0]) {
    const q = normalizeCodingTemplateSearchQuery(input);
    const where: string[] = [];
    const p: DatabaseValue[] = [];

    if (q.text) {
      where.push(
        `(code LIKE ? ESCAPE '\\\\' OR persian_name LIKE ? ESCAPE '\\\\' OR english_name LIKE ? ESCAPE '\\\\')`,
      );
      const text = `%${q.text.replace(/[\\\\%_]/g, "\\\\$&")}%`;
      p.push(text, text, text);
    }

    for (const [key, column] of [
      ["activityType", "activity_type"],
      ["ownership", "ownership"],
      ["lifecycle", "lifecycle"],
    ] as const) {
      if (q[key]) {
        where.push(`${column} = ?`);
        p.push(q[key]!);
      }
    }

    return queryPage<TemplateRow, CodingTemplate>(
      this.db,
      "coding_templates",
      where,
      p,
      sqlOrderBy(q.sorts, {
        code: "code",
        name: "persian_name",
        activityType: "activity_type",
        updatedAt: "updated_at",
        id: "id",
      }),
      q.pagination,
      template,
    );
  }

  async update(v: Readonly<CodingTemplate>): Promise<void> {
    const result = await this.db.execute(
      `UPDATE coding_templates
       SET code = ?, persian_name = ?, english_name = ?, activity_type = ?,
           ownership = ?, lifecycle = ?, latest_published_version = ?,
           updated_at = ?, version = ?
       WHERE id = ? AND version = ?`,
      [
        v.code,
        v.persianName,
        v.englishName,
        v.activityType,
        v.ownership,
        v.lifecycle,
        v.latestPublishedVersion,
        v.updatedAt,
        v.optimisticVersion,
        v.id,
        v.optimisticVersion - 1,
      ],
    );
    assertVersionedUpdate(result, {
      entityType: "CodingTemplate",
      entityId: v.id,
      expectedVersion: v.optimisticVersion - 1,
    });
  }
}

export class SqliteCodingTemplateVersionRepository implements CodingTemplateVersionRepository {
  constructor(private readonly db: DatabaseSession) {}
  async create(r: CodingTemplateVersionRecord): Promise<void> {
    const v = r.version; await this.db.execute(`INSERT INTO coding_template_versions (id, template_id, template_code, version_number, persian_name, english_name, activity_type, ownership, source_type, source_reference, contract_version, content_fingerprint, published_at, published_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [v.id, v.templateId, v.templateCode, v.versionNumber, v.persianName, v.englishName, v.activityType, v.ownership, v.source.type, v.source.reference, v.source.contractVersion, v.source.contentFingerprint, v.publishedAt, v.publishedBy]);
    for (const x of r.content.accounts) await this.db.execute(`INSERT INTO coding_template_accounts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [v.id, x.logicalKey, x.parentLogicalKey, x.level, x.code, x.persianName, x.englishName, x.nature, x.normalBalance, x.statementType, JSON.stringify(x.reportClassification), +x.postingAllowed, +x.currencyEnabled, +x.revaluationEnabled, +x.trackingEnabled, +x.dueDateEnabled, +x.activeByDefault, x.displayOrder]);
    for (const x of r.content.dimensionTypes) await this.db.execute(`INSERT INTO coding_template_dimension_types VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [v.id, x.logicalKey, x.code, x.persianName, x.englishName, +x.hierarchical, +x.allowMultipleMembers, +x.activeByDefault, x.displayOrder]);
    for (const x of r.content.dimensionMembers) await this.db.execute(`INSERT INTO coding_template_dimension_members VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [v.id, x.logicalKey, x.dimensionTypeLogicalKey, x.parentLogicalKey, x.code, x.persianName, x.englishName, +x.activeByDefault, x.displayOrder]);
    for (const x of r.content.accountDimensionPolicies) await this.db.execute(`INSERT INTO coding_template_account_dimension_policies VALUES (?, ?, ?, ?)`, [v.id, x.accountLogicalKey, x.dimensionTypeLogicalKey, x.requirement]);
  }
  async findById(id: string) { const row = await this.db.queryOne<VersionRow>(`SELECT * FROM coding_template_versions WHERE id = ?`, [id]); return row ? this.record(row) : null; }
  async findByTemplateAndVersion(templateId: string, versionNumber: number) { const row = await this.db.queryOne<VersionRow>(`SELECT * FROM coding_template_versions WHERE template_id = ? AND version_number = ?`, [templateId, versionNumber]); return row ? this.record(row) : null; }
  async search(input: Parameters<CodingTemplateVersionRepository["search"]>[0]) { const q = normalizeCodingTemplateVersionSearchQuery(input); const page = await queryPage<VersionRow, VersionRow>(this.db, "coding_template_versions", ["template_id = ?"], [q.templateId], sqlOrderBy(q.sorts, { versionNumber: "version_number", publishedAt: "published_at", id: "id" }), q.pagination, (x) => x); return Object.freeze({ ...page, items: Object.freeze(await Promise.all(page.items.map((x) => this.record(x)))) }); }
  private async record(r: VersionRow): Promise<CodingTemplateVersionRecord> {
    const [accounts, dimensionTypes, dimensionMembers, policies] = await Promise.all([
      this.db.query<any>(`SELECT * FROM coding_template_accounts WHERE template_version_id = ? ORDER BY display_order, code`, [r.id]), this.db.query<any>(`SELECT * FROM coding_template_dimension_types WHERE template_version_id = ? ORDER BY display_order, code`, [r.id]), this.db.query<any>(`SELECT * FROM coding_template_dimension_members WHERE template_version_id = ? ORDER BY display_order, code`, [r.id]), this.db.query<any>(`SELECT * FROM coding_template_account_dimension_policies WHERE template_version_id = ? ORDER BY account_logical_key, dimension_type_logical_key`, [r.id]),
    ]);
    return Object.freeze({ version: createCodingTemplateVersion({ id: r.id, templateId: r.template_id, templateCode: r.template_code, versionNumber: r.version_number, persianName: r.persian_name, englishName: r.english_name, activityType: r.activity_type, ownership: r.ownership, source: { type: r.source_type, reference: r.source_reference, contractVersion: r.contract_version, contentFingerprint: r.content_fingerprint }, publishedAt: r.published_at, publishedBy: r.published_by }), content: Object.freeze({ accounts: Object.freeze(accounts.map((x) => Object.freeze({ logicalKey: x.logical_key, parentLogicalKey: x.parent_logical_key, level: x.level, code: x.code, persianName: x.persian_name, englishName: x.english_name, nature: x.nature, normalBalance: x.normal_balance, statementType: x.statement_type, reportClassification: Object.freeze(JSON.parse(x.report_classification_json)), postingAllowed: x.posting_allowed === 1, currencyEnabled: x.currency_enabled === 1, revaluationEnabled: x.revaluation_enabled === 1, trackingEnabled: x.tracking_enabled === 1, dueDateEnabled: x.due_date_enabled === 1, activeByDefault: x.active_by_default === 1, displayOrder: x.display_order }))), dimensionTypes: Object.freeze(dimensionTypes.map((x) => Object.freeze({ logicalKey: x.logical_key, code: x.code, persianName: x.persian_name, englishName: x.english_name, hierarchical: x.hierarchical === 1, allowMultipleMembers: x.allow_multiple_members === 1, activeByDefault: x.active_by_default === 1, displayOrder: x.display_order }))), dimensionMembers: Object.freeze(dimensionMembers.map((x) => Object.freeze({ logicalKey: x.logical_key, dimensionTypeLogicalKey: x.dimension_type_logical_key, parentLogicalKey: x.parent_logical_key, code: x.code, persianName: x.persian_name, englishName: x.english_name, activeByDefault: x.active_by_default === 1, displayOrder: x.display_order }))), accountDimensionPolicies: Object.freeze(policies.map((x) => Object.freeze({ accountLogicalKey: x.account_logical_key, dimensionTypeLogicalKey: x.dimension_type_logical_key, requirement: x.requirement }))) }) });
  }
}

abstract class HistoryRepository<TRow, TItem> {
  constructor(protected readonly db: DatabaseSession) {}

  protected async one(
    sql: string,
    p: readonly DatabaseValue[],
    map: (r: TRow) => TItem,
  ): Promise<TItem | null> {
    const r = await this.db.queryOne<TRow>(sql, p);
    return r ? map(r) : null;
  }
}
export class SqliteCodingTemplateApplicationHistoryRepository
  extends HistoryRepository<ApplicationRow, CodingTemplateApplicationHistory>
  implements CodingTemplateApplicationHistoryRepository
{
  async create(v: CodingTemplateApplicationHistory): Promise<void> {
    await this.db.execute(
      `INSERT INTO coding_template_applications
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        v.id,
        v.companyId,
        v.templateId,
        v.templateVersionId,
        v.requestKey,
        v.status,
        v.baselineFingerprint,
        v.appliedAt,
        v.actorId,
        v.createdAt,
      ],
    );
  }

  findById(id: string): Promise<CodingTemplateApplicationHistory | null> {
    return this.one(
      `SELECT * FROM coding_template_applications WHERE id = ?`,
      [id],
      application,
    );
  }

  findByRequestKey(
    companyId: string,
    requestKey: string,
  ): Promise<CodingTemplateApplicationHistory | null> {
    return this.one(
      `SELECT * FROM coding_template_applications
       WHERE company_id = ? AND request_key = ?`,
      [companyId, requestKey],
      application,
    );
  }

  async search(
    input: Parameters<CodingTemplateApplicationHistoryRepository["search"]>[0],
  ) {
    const q = normalizeCodingTemplateApplicationHistoryQuery(input);
    const where = ["company_id = ?"];
    const p: DatabaseValue[] = [q.companyId];

    if (q.templateId) {
      where.push("template_id = ?");
      p.push(q.templateId);
    }
    if (q.status) {
      where.push("status = ?");
      p.push(q.status);
    }

    return queryPage<ApplicationRow, CodingTemplateApplicationHistory>(
      this.db,
      "coding_template_applications",
      where,
      p,
      sqlOrderBy(q.sorts, {
        createdAt: "created_at",
        status: "status",
        id: "id",
      }),
      q.pagination,
      application,
    );
  }

  async update(v: CodingTemplateApplicationHistory): Promise<void> {
    const result = await this.db.execute(
      `UPDATE coding_template_applications
       SET status = ?, baseline_fingerprint = ?, applied_at = ?, actor_id = ?
       WHERE id = ? AND company_id = ?`,
      [v.status, v.baselineFingerprint, v.appliedAt, v.actorId, v.id, v.companyId],
    );
    if (result.rowsAffected !== 1) {
      throw new Error(`Coding template application not found: ${v.id}`);
    }
  }
}
export class SqliteCodingTemplateApplicationItemMappingRepository
  implements CodingTemplateApplicationItemMappingRepository
{
  constructor(private readonly db: DatabaseSession) {}

  async createMany(
    values: readonly CodingTemplateApplicationItemMapping[],
  ): Promise<void> {
    for (const v of values) {
      await this.db.execute(
        `INSERT INTO coding_template_application_items
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          v.applicationId,
          v.companyId,
          v.templateVersionId,
          v.itemType,
          v.logicalKey,
          v.operationalId,
          v.action,
        ],
      );
    }
  }

  async findByApplicationId(
    id: string,
  ): Promise<readonly CodingTemplateApplicationItemMapping[]> {
    return Object.freeze(
      (await this.db.query<MappingRow>(
        `SELECT * FROM coding_template_application_items
         WHERE application_id = ?
         ORDER BY item_type, logical_key`,
        [id],
      )).map(mapping),
    );
  }
}
export class SqliteCodingTemplateImportHistoryRepository
  extends HistoryRepository<ImportRow, CodingTemplateImportHistory>
  implements CodingTemplateImportHistoryRepository
{
  async create(v: CodingTemplateImportHistory): Promise<void> {
    await this.db.execute(
      `INSERT INTO coding_template_imports
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        v.id,
        v.importKey,
        v.fileName,
        v.fileFingerprint,
        v.contractVersion,
        v.status,
        v.templateId,
        v.templateVersionId,
        v.actorId,
        v.createdAt,
        v.completedAt,
      ],
    );
  }

  findById(id: string): Promise<CodingTemplateImportHistory | null> {
    return this.one(
      `SELECT * FROM coding_template_imports WHERE id = ?`,
      [id],
      imported,
    );
  }

  findByImportKey(key: string): Promise<CodingTemplateImportHistory | null> {
    return this.one(
      `SELECT * FROM coding_template_imports WHERE import_key = ?`,
      [key],
      imported,
    );
  }

  async search(
    input: Parameters<CodingTemplateImportHistoryRepository["search"]>[0],
  ) {
    const q = normalizeCodingTemplateImportHistoryQuery(input);
    const where: string[] = [];
    const p: DatabaseValue[] = [];

    if (q.templateId) {
      where.push("template_id = ?");
      p.push(q.templateId);
    }
    if (q.status) {
      where.push("status = ?");
      p.push(q.status);
    }

    return queryPage<ImportRow, CodingTemplateImportHistory>(
      this.db,
      "coding_template_imports",
      where,
      p,
      sqlOrderBy(q.sorts, {
        createdAt: "created_at",
        status: "status",
        id: "id",
      }),
      q.pagination,
      imported,
    );
  }

  async update(v: CodingTemplateImportHistory): Promise<void> {
    const result = await this.db.execute(
      `UPDATE coding_template_imports
       SET status = ?, template_id = ?, template_version_id = ?,
           actor_id = ?, completed_at = ?
       WHERE id = ?`,
      [
        v.status,
        v.templateId,
        v.templateVersionId,
        v.actorId,
        v.completedAt,
        v.id,
      ],
    );
    if (result.rowsAffected !== 1) {
      throw new Error(`Coding template import not found: ${v.id}`);
    }
  }
}

export class SqliteCodingTemplateCompanyBaselineRepository
  implements CodingTemplateCompanyBaselineRepository
{
  constructor(private readonly db: DatabaseSession) {}

  async read(
    companyId: string,
  ): Promise<Readonly<CodingTemplateCompanyBaseline>> {
    // Load all baseline data in parallel
    const [accounts, tags, types, members, policies] = await Promise.all([
      this.loadAccounts(companyId),
      this.loadTags(companyId),
      this.loadDimensionTypes(companyId),
      this.loadDimensionMembers(companyId),
      this.loadPolicies(companyId),
    ]);

    // Build tag index
    const tagsByAccount = this.indexTags(tags);

    // Map and return all entities
    return Object.freeze({
      companyId,
      accounts: Object.freeze(
        accounts.map((x) => this.mapAccount(x, tagsByAccount)),
      ),
      dimensionTypes: Object.freeze(
        types.map((x) => this.mapDimensionType(x)),
      ),
      dimensionMembers: Object.freeze(
        members.map((x) => this.mapDimensionMember(x)),
      ),
      accountDimensionPolicies: Object.freeze(
        policies.map((x) => this.mapPolicy(x)),
      ),
    });
  }

  private async loadAccounts(companyId: string): Promise<any[]> {
    return this.db.query<any>(
      `SELECT a.*, p.source_reference_id AS parent_logical_key
       FROM accounts a
       LEFT JOIN accounts p ON p.id = a.parent_id
                           AND p.company_id = a.company_id
       WHERE a.company_id = ?
       ORDER BY a.display_order, a.code`,
      [companyId],
    );
  }

  private async loadTags(
    companyId: string,
  ): Promise<{ account_id: string; tag: string }[]> {
    return this.db.query<{ account_id: string; tag: string }>(
      `SELECT t.account_id, t.tag
       FROM account_management_tags t
       JOIN accounts a ON a.id = t.account_id
       WHERE a.company_id = ?
       ORDER BY t.account_id, t.display_order, t.tag`,
      [companyId],
    );
  }

  private async loadDimensionTypes(companyId: string): Promise<any[]> {
    return this.db.query<any>(
      `SELECT * FROM accounting_dimension_types
       WHERE company_id = ?
       ORDER BY display_order, code`,
      [companyId],
    );
  }

  private async loadDimensionMembers(companyId: string): Promise<any[]> {
    return this.db.query<any>(
      `SELECT m.*,
              t.source_reference_id AS dimension_type_logical_key,
              p.source_reference_id AS parent_logical_key
       FROM accounting_dimension_members m
       JOIN accounting_dimension_types t
         ON t.id = m.dimension_type_id
         AND t.company_id = m.company_id
       LEFT JOIN accounting_dimension_members p
         ON p.id = m.parent_id
         AND p.company_id = m.company_id
       WHERE m.company_id = ?
       ORDER BY m.display_order, m.code`,
      [companyId],
    );
  }

  private async loadPolicies(companyId: string): Promise<any[]> {
    return this.db.query<any>(
      `SELECT p.*,
              a.source_reference_id AS account_logical_key,
              t.source_reference_id AS dimension_type_logical_key
       FROM account_dimension_policies p
       JOIN accounts a
         ON a.id = p.account_id
         AND a.company_id = p.company_id
       JOIN accounting_dimension_types t
         ON t.id = p.dimension_type_id
         AND t.company_id = p.company_id
       WHERE p.company_id = ?
       ORDER BY p.id`,
      [companyId],
    );
  }

  private indexTags(
    tags: { account_id: string; tag: string }[],
  ): Map<string, string[]> {
    const tagsByAccount = new Map<string, string[]>();
    for (const { account_id: accountId, tag } of tags) {
      const values = tagsByAccount.get(accountId) ?? [];
      values.push(tag);
      tagsByAccount.set(accountId, values);
    }
    return tagsByAccount;
  }

  private mapAccount(x: any, tagsByAccount: Map<string, string[]>): any {
    return Object.freeze({
      id: x.id,
      companyId: x.company_id,
      logicalKey: x.source_reference_id,
      code: x.code,
      parentLogicalKey: x.parent_logical_key,
      level: x.level,
      persianName: x.name,
      englishName: x.english_name,
      nature: x.nature,
      normalBalance: x.normal_balance,
      statementType: x.statement_type,
      reportClassification: Object.freeze({
        balanceSheetSection: x.balance_sheet_section,
        incomeStatementSection: x.income_statement_section,
        cashFlowCategory: x.cash_flow_category,
        cashEquivalent: x.is_cash_equivalent === 1,
        receivable: x.is_receivable === 1,
        payable: x.is_payable === 1,
        managementTags: Object.freeze(tagsByAccount.get(x.id) ?? []),
      }),
      postingAllowed: x.posting_allowed === 1,
      currencyEnabled: x.currency_enabled === 1,
      revaluationEnabled: x.revaluation_enabled === 1,
      trackingEnabled: x.tracking_enabled === 1,
      dueDateEnabled: x.due_date_enabled === 1,
      active: x.status === "active",
      displayOrder: x.display_order,
    });
  }

  private mapDimensionType(x: any): any {
    return Object.freeze({
      id: x.id,
      companyId: x.company_id,
      logicalKey: x.source_reference_id,
      code: x.code,
      persianName: x.name,
      englishName: x.english_name,
      hierarchical: x.hierarchical === 1,
      allowMultipleMembers: x.allow_multiple_members === 1,
      active: x.status === "active",
      displayOrder: x.display_order,
    });
  }

  private mapDimensionMember(x: any): any {
    return Object.freeze({
      id: x.id,
      companyId: x.company_id,
      logicalKey: x.source_reference_id,
      code: x.code,
      dimensionTypeLogicalKey: x.dimension_type_logical_key,
      parentLogicalKey: x.parent_logical_key,
      persianName: x.name,
      englishName: x.english_name,
      active: x.status === "active",
      displayOrder: x.display_order,
    });
  }

  private mapPolicy(x: any): any {
    return Object.freeze({
      id: x.id,
      companyId: x.company_id,
      accountLogicalKey: x.account_logical_key,
      dimensionTypeLogicalKey: x.dimension_type_logical_key,
      requirement: x.requirement,
    });
  }
}
