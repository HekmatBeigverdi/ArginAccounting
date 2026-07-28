import type {
  CompanyTaxProfile,
  CompanyTaxProfileRepository,
  CreateCompanyTaxProfileInput
} from "@argin/company";

import type {
  DatabaseSession
} from "@argin/database";

interface TaxProfileRow {
  id: string;
  company_id: string;
  economic_code: string | null;
  fiscal_id: string | null;
  seller_branch_code: string | null;
  taxpayer_type: CompanyTaxProfile["taxpayerType"];
  is_enabled: number;
  created_at: string;
  updated_at: string;
}

function mapTaxProfile(
  row: TaxProfileRow
): CompanyTaxProfile {
  return {
    id: row.id,
    companyId: row.company_id,
    economicCode: row.economic_code,
    fiscalId: row.fiscal_id,
    sellerBranchCode: row.seller_branch_code,
    taxpayerType: row.taxpayer_type,
    isEnabled: row.is_enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class SqliteCompanyTaxProfileRepository
  implements CompanyTaxProfileRepository {
  constructor(
    private readonly database: DatabaseSession
  ) {}

  async create(
    input: CreateCompanyTaxProfileInput
  ): Promise<CompanyTaxProfile> {
    const now = new Date().toISOString();

    const profile: CompanyTaxProfile = {
      id: crypto.randomUUID(),
      companyId: input.companyId,
      economicCode: input.economicCode ?? null,
      fiscalId: input.fiscalId ?? null,
      sellerBranchCode:
        input.sellerBranchCode ?? null,
      taxpayerType: input.taxpayerType,
      isEnabled: input.isEnabled,
      createdAt: now,
      updatedAt: now
    };

    await this.database.execute(
      `
        INSERT INTO company_tax_profiles (
          id,
          company_id,
          economic_code,
          fiscal_id,
          seller_branch_code,
          taxpayer_type,
          is_enabled,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        profile.id,
        profile.companyId,
        profile.economicCode,
        profile.fiscalId,
        profile.sellerBranchCode,
        profile.taxpayerType,
        profile.isEnabled ? 1 : 0,
        profile.createdAt,
        profile.updatedAt
      ]
    );

    return profile;
  }

  async findByCompanyId(
    companyId: string
  ): Promise<CompanyTaxProfile | null> {
    const row = await this.database.queryOne<TaxProfileRow>(
      `
        SELECT *
        FROM company_tax_profiles
        WHERE company_id = ?
      `,
      [companyId]
    );

    return row ? mapTaxProfile(row) : null;
  }

  async update(
    profile: CompanyTaxProfile
  ): Promise<void> {
    await this.database.execute(
      `
        UPDATE company_tax_profiles
        SET
          economic_code = ?,
          fiscal_id = ?,
          seller_branch_code = ?,
          taxpayer_type = ?,
          is_enabled = ?,
          updated_at = ?
        WHERE id = ?
      `,
      [
        profile.economicCode,
        profile.fiscalId,
        profile.sellerBranchCode,
        profile.taxpayerType,
        profile.isEnabled ? 1 : 0,
        profile.updatedAt,
        profile.id
      ]
    );
  }
}
