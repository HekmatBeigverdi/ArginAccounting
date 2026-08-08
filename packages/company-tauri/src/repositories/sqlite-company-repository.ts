import type {
  Company,
  CompanyRepository,
  CreateCompanyInput
} from "@argin/company";

import type {
  DatabaseSession
} from "@argin/database";

interface CompanyRow {
  id: string;
  code: string;
  legal_name: string;
  trade_name: string | null;
  national_id: string | null;
  registration_number: string | null;
  activity_type?: Company["activityType"] | null;
  base_currency: "IRR";
  locale: "fa-IR";
  calendar: "jalali";
  status: Company["status"];
  created_at: string;
  updated_at: string;
}

function mapCompany(row: CompanyRow): Company {
  return {
    id: row.id,
    code: row.code,
    legalName: row.legal_name,
    tradeName: row.trade_name,
    nationalId: row.national_id,
    registrationNumber: row.registration_number,
    activityType: row.activity_type ?? "custom",
    baseCurrency: row.base_currency,
    locale: row.locale,
    calendar: row.calendar,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class SqliteCompanyRepository
  implements CompanyRepository {
  constructor(
    private readonly database: DatabaseSession
  ) {}

  async create(
    input: CreateCompanyInput
  ): Promise<Company> {
    const now = new Date().toISOString();

    const company: Company = {
      id: crypto.randomUUID(),
      code: input.code,
      legalName: input.legalName,
      tradeName: input.tradeName ?? null,
      nationalId: input.nationalId ?? null,
      registrationNumber:
        input.registrationNumber ?? null,
      activityType: input.activityType,
      baseCurrency: "IRR",
      locale: "fa-IR",
      calendar: "jalali",
      status: "active",
      createdAt: now,
      updatedAt: now
    };

    if (await this.supportsActivityType()) {
      await this.database.execute(
        `
        INSERT INTO companies (
          id,
          code,
          legal_name,
          trade_name,
          national_id,
          registration_number,
          activity_type,
          base_currency,
          locale,
          calendar,
          status,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          company.id,
          company.code,
          company.legalName,
          company.tradeName,
          company.nationalId,
          company.registrationNumber,
          company.activityType,
          company.baseCurrency,
          company.locale,
          company.calendar,
          company.status,
          company.createdAt,
          company.updatedAt
        ]
      );
    } else {
      await this.database.execute(
        `
          INSERT INTO companies (
            id, code, legal_name, trade_name, national_id,
            registration_number, base_currency, locale, calendar,
            status, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          company.id,
          company.code,
          company.legalName,
          company.tradeName,
          company.nationalId,
          company.registrationNumber,
          company.baseCurrency,
          company.locale,
          company.calendar,
          company.status,
          company.createdAt,
          company.updatedAt
        ]
      );
    }

    return company;
  }

  async findById(id: string): Promise<Company | null> {
    const row = await this.database.queryOne<CompanyRow>(
      "SELECT * FROM companies WHERE id = ?",
      [id]
    );

    return row ? mapCompany(row) : null;
  }

  async findByCode(
    code: string
  ): Promise<Company | null> {
    const row = await this.database.queryOne<CompanyRow>(
      "SELECT * FROM companies WHERE code = ?",
      [code]
    );

    return row ? mapCompany(row) : null;
  }

  async findAll(): Promise<Company[]> {
    const rows = await this.database.query<CompanyRow>(
      `
        SELECT *
        FROM companies
        ORDER BY legal_name
      `
    );

    return rows.map(mapCompany);
  }

  async update(company: Company): Promise<void> {
    if (!await this.supportsActivityType()) {
      await this.database.execute(
        `
          UPDATE companies
          SET legal_name = ?, trade_name = ?, national_id = ?,
              registration_number = ?, status = ?, updated_at = ?
          WHERE id = ?
        `,
        [
          company.legalName,
          company.tradeName,
          company.nationalId,
          company.registrationNumber,
          company.status,
          company.updatedAt,
          company.id
        ]
      );
      return;
    }

    await this.database.execute(
      `
        UPDATE companies
        SET
          legal_name = ?,
          trade_name = ?,
          national_id = ?,
          registration_number = ?,
          activity_type = ?,
          status = ?,
          updated_at = ?
        WHERE id = ?
      `,
      [
        company.legalName,
        company.tradeName,
        company.nationalId,
        company.registrationNumber,
        company.activityType,
        company.status,
        company.updatedAt,
        company.id
      ]
    );
  }

  private async supportsActivityType(): Promise<boolean> {
    const columns = await this.database.query<{ name: string }>(
      "PRAGMA table_info(companies)"
    );
    return columns.some((column) => column.name === "activity_type");
  }
}
