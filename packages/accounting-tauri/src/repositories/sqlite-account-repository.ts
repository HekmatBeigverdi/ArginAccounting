import type {
  Account,
  AccountRepository,
  AccountReportClassification,
} from "@argin/accounting";
import {
  assertVersionedUpdate,
  type DatabaseSession,
} from "@argin/database";

interface AccountRow {
  id: string; company_id: string; parent_id: string | null;
  level: Account["level"]; code: string; name: string;
  english_name: string | null; nature: Account["nature"];
  normal_balance: Account["normalBalance"];
  statement_type: Account["statementType"];
  balance_sheet_section: AccountReportClassification["balanceSheetSection"];
  income_statement_section: AccountReportClassification["incomeStatementSection"];
  cash_flow_category: AccountReportClassification["cashFlowCategory"];
  is_cash_equivalent: number; is_receivable: number; is_payable: number;
  posting_allowed: number; currency_enabled: number;
  revaluation_enabled: number; tracking_enabled: number;
  due_date_enabled: number; status: Account["status"];
  display_order: number; source_type: Account["sourceType"];
  source_reference_id: string | null; created_at: string;
  updated_at: string; version: number;
}

interface TagRow { account_id: string; tag: string }

function mapAccount(row: AccountRow, tags: readonly string[]): Account {
  return Object.freeze({
    id: row.id, companyId: row.company_id, parentId: row.parent_id,
    level: row.level, code: row.code as Account["code"],
    name: row.name as Account["name"], englishName: row.english_name,
    nature: row.nature, normalBalance: row.normal_balance,
    statementType: row.statement_type,
    reportClassification: Object.freeze({
      balanceSheetSection: row.balance_sheet_section,
      incomeStatementSection: row.income_statement_section,
      cashFlowCategory: row.cash_flow_category,
      cashEquivalent: row.is_cash_equivalent === 1,
      receivable: row.is_receivable === 1,
      payable: row.is_payable === 1,
      managementTags: Object.freeze([...tags]),
    }),
    postingAllowed: row.posting_allowed === 1,
    currencyEnabled: row.currency_enabled === 1,
    revaluationEnabled: row.revaluation_enabled === 1,
    trackingEnabled: row.tracking_enabled === 1,
    dueDateEnabled: row.due_date_enabled === 1,
    status: row.status, displayOrder: row.display_order,
    sourceType: row.source_type,
    sourceReferenceId: row.source_reference_id,
    createdAt: row.created_at, updatedAt: row.updated_at,
    version: row.version,
  });
}

export class SqliteAccountRepository implements AccountRepository {
  constructor(private readonly database: DatabaseSession) {}

  async create(account: Account): Promise<void> {
    await this.database.execute(
      `INSERT INTO accounts (
        id, company_id, parent_id, level, code, name, english_name,
        nature, normal_balance, statement_type, balance_sheet_section,
        income_statement_section, cash_flow_category, is_cash_equivalent,
        is_receivable, is_payable, posting_allowed, currency_enabled,
        revaluation_enabled, tracking_enabled, due_date_enabled, status,
        display_order, source_type, source_reference_id, created_at,
        updated_at, version
      ) VALUES (${Array.from({ length: 28 }, () => "?").join(", ")})`,
      this.parameters(account),
    );
    await this.replaceTags(account);
  }

  async findById(id: string): Promise<Account | null> {
    const row = await this.database.queryOne<AccountRow>(
      `SELECT * FROM accounts WHERE id = ?`,
      [id],
    );
    return row ? this.withTags(row) : null;
  }

  async findByCode(companyId: string, code: string): Promise<Account | null> {
    const row = await this.database.queryOne<AccountRow>(
      `SELECT * FROM accounts WHERE company_id = ? AND code = ?`,
      [companyId, code],
    );
    return row ? this.withTags(row) : null;
  }

  async findByCompanyId(companyId: string): Promise<Account[]> {
    return this.findMany(
      `SELECT * FROM accounts WHERE company_id = ? ORDER BY display_order, code`,
      [companyId],
    );
  }

  async findChildren(parentId: string): Promise<Account[]> {
    return this.findMany(
      `SELECT * FROM accounts WHERE parent_id = ? ORDER BY display_order, code`,
      [parentId],
    );
  }

  async update(account: Account): Promise<void> {
    const result = await this.database.execute(
      `UPDATE accounts SET parent_id = ?, level = ?, code = ?, name = ?,
        english_name = ?, nature = ?, normal_balance = ?, statement_type = ?,
        balance_sheet_section = ?, income_statement_section = ?,
        cash_flow_category = ?, is_cash_equivalent = ?, is_receivable = ?,
        is_payable = ?, posting_allowed = ?, currency_enabled = ?,
        revaluation_enabled = ?, tracking_enabled = ?, due_date_enabled = ?,
        status = ?, display_order = ?, source_type = ?, source_reference_id = ?,
        updated_at = ?, version = ?
      WHERE id = ? AND company_id = ? AND version = ?`,
      [
        ...this.parameters(account).slice(2, 25),
        account.updatedAt, account.version,
        account.id, account.companyId, account.version - 1,
      ],
    );
    assertVersionedUpdate(result, {
      entityType: "Account",
      entityId: account.id,
      expectedVersion: account.version - 1,
    });
    await this.replaceTags(account);
  }

  private parameters(account: Account) {
    const report = account.reportClassification;
    return [
      account.id, account.companyId, account.parentId, account.level,
      account.code, account.name, account.englishName, account.nature,
      account.normalBalance, account.statementType, report.balanceSheetSection,
      report.incomeStatementSection, report.cashFlowCategory,
      report.cashEquivalent ? 1 : 0, report.receivable ? 1 : 0,
      report.payable ? 1 : 0, account.postingAllowed ? 1 : 0,
      account.currencyEnabled ? 1 : 0, account.revaluationEnabled ? 1 : 0,
      account.trackingEnabled ? 1 : 0, account.dueDateEnabled ? 1 : 0,
      account.status, account.displayOrder, account.sourceType,
      account.sourceReferenceId, account.createdAt, account.updatedAt,
      account.version,
    ];
  }

  private async replaceTags(account: Account): Promise<void> {
    await this.database.execute(
      `DELETE FROM account_management_tags WHERE account_id = ?`,
      [account.id],
    );
    for (const [displayOrder, tag] of
      account.reportClassification.managementTags.entries()) {
      await this.database.execute(
        `INSERT INTO account_management_tags (account_id, tag, display_order)
         VALUES (?, ?, ?)`,
        [account.id, tag, displayOrder],
      );
    }
  }

  private async withTags(row: AccountRow): Promise<Account> {
    const tags = await this.database.query<TagRow>(
      `SELECT account_id, tag FROM account_management_tags
       WHERE account_id = ? ORDER BY display_order, tag`,
      [row.id],
    );
    return mapAccount(row, tags.map(({ tag }) => tag));
  }

  private async findMany(
    sql: string,
    parameters: readonly string[],
  ): Promise<Account[]> {
    const rows = await this.database.query<AccountRow>(sql, parameters);
    if (rows.length === 0) return [];

    const tags = await this.database.query<TagRow>(
      `SELECT account_id, tag FROM account_management_tags
       WHERE account_id IN (${rows.map(() => "?").join(", ")})
       ORDER BY account_id, display_order, tag`,
      rows.map(({ id }) => id),
    );
    const tagsByAccount = new Map<string, string[]>();
    for (const { account_id: accountId, tag } of tags) {
      const values = tagsByAccount.get(accountId) ?? [];
      values.push(tag);
      tagsByAccount.set(accountId, values);
    }
    return rows.map((row) =>
      mapAccount(row, tagsByAccount.get(row.id) ?? [])
    );
  }
}
