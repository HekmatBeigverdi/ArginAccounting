import type {
  AccountCodingSettings,
  AccountCodingSettingsRepository,
} from "@argin/accounting";
import {
  assertVersionedUpdate,
  type DatabaseSession,
} from "@argin/database";

interface SettingsRow {
  company_id: string;
  group_code_length: number;
  general_code_length: number;
  subsidiary_code_length: number;
  enforce_hierarchical_codes: number;
  allow_code_change_after_use: number;
  version: number;
}

function mapSettings(row: SettingsRow): AccountCodingSettings {
  return Object.freeze({
    companyId: row.company_id,
    groupCodeLength: row.group_code_length,
    generalCodeLength: row.general_code_length,
    subsidiaryCodeLength: row.subsidiary_code_length,
    enforceHierarchicalCodes:
      row.enforce_hierarchical_codes === 1,
    allowCodeChangeAfterUse:
      row.allow_code_change_after_use === 1,
    version: row.version,
  });
}

export class SqliteAccountCodingSettingsRepository
implements AccountCodingSettingsRepository {
  constructor(private readonly database: DatabaseSession) {}

  async findByCompanyId(
    companyId: string,
  ): Promise<AccountCodingSettings | null> {
    const row = await this.database.queryOne<SettingsRow>(
      `SELECT * FROM account_coding_settings WHERE company_id = ?`,
      [companyId],
    );
    return row ? mapSettings(row) : null;
  }

  async save(settings: AccountCodingSettings): Promise<void> {
    const now = new Date().toISOString();
    if (settings.version === 1) {
      await this.database.execute(
        `INSERT INTO account_coding_settings (
          company_id, group_code_length, general_code_length,
          subsidiary_code_length, enforce_hierarchical_codes,
          allow_code_change_after_use, version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          settings.companyId,
          settings.groupCodeLength,
          settings.generalCodeLength,
          settings.subsidiaryCodeLength,
          settings.enforceHierarchicalCodes ? 1 : 0,
          settings.allowCodeChangeAfterUse ? 1 : 0,
          settings.version,
          now,
          now,
        ],
      );
      return;
    }

    const result = await this.database.execute(
      `UPDATE account_coding_settings SET
        group_code_length = ?, general_code_length = ?,
        subsidiary_code_length = ?, enforce_hierarchical_codes = ?,
        allow_code_change_after_use = ?, version = ?, updated_at = ?
      WHERE company_id = ? AND version = ?`,
      [
        settings.groupCodeLength,
        settings.generalCodeLength,
        settings.subsidiaryCodeLength,
        settings.enforceHierarchicalCodes ? 1 : 0,
        settings.allowCodeChangeAfterUse ? 1 : 0,
        settings.version,
        now,
        settings.companyId,
        settings.version - 1,
      ],
    );
    assertVersionedUpdate(result, {
      entityType: "AccountCodingSettings",
      entityId: settings.companyId,
      expectedVersion: settings.version - 1,
    });
  }
}
