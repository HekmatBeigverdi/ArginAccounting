import type { DatabaseSession } from "@argin/database";
import type { PartyMasterExportPage, PartyMasterExportReader, PartyMasterExportRow } from "@argin/party";

interface ExportRow {
  id: string; code: string; classification: "natural-person" | "legal-entity"; status: "active" | "inactive";
  first_name: string | null; last_name: string | null; legal_name: string | null; trade_name: string | null;
  national_code: string | null; national_id: string | null; registration_number: string | null;
  economic_number: string | null; legacy_economic_code: string | null; tax_file_number: string | null;
  roles: string | null; phone: string | null; mobile: string | null; email: string | null;
  address_line: string | null; postal_code: string | null; created_at: string; updated_at: string;
}
interface CountRow { count: number; }

export class SqlitePartyMasterExportReader implements PartyMasterExportReader {
  constructor(private readonly database: DatabaseSession) {}
  async listPage(companyId: string, page: number, pageSize: number): Promise<PartyMasterExportPage> {
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 2000) throw new RangeError("Invalid Party master export page request.");
    const offset = (page - 1) * pageSize;
    const [countRow, rows] = await Promise.all([
      this.database.queryOne<CountRow>("SELECT COUNT(*) AS count FROM parties WHERE company_id = ? AND deleted_at IS NULL", [companyId]),
      this.database.query<ExportRow>(`
        SELECT p.id, p.code, p.classification, p.status, p.first_name, p.last_name, p.legal_name, p.trade_name,
          p.national_code, p.national_id, p.registration_number, p.economic_number, p.legacy_economic_code,
          p.tax_file_number, p.created_at, p.updated_at,
          COALESCE((SELECT GROUP_CONCAT(pr.role, ',') FROM party_roles pr WHERE pr.company_id = p.company_id AND pr.party_id = p.id ORDER BY pr.role), '') AS roles,
          COALESCE((SELECT pc.value FROM party_contacts pc WHERE pc.company_id = p.company_id AND pc.party_id = p.id AND pc.contact_type = 'phone' ORDER BY pc.is_primary DESC, pc.id LIMIT 1), '') AS phone,
          COALESCE((SELECT pc.value FROM party_contacts pc WHERE pc.company_id = p.company_id AND pc.party_id = p.id AND pc.contact_type = 'mobile' ORDER BY pc.is_primary DESC, pc.id LIMIT 1), '') AS mobile,
          COALESCE((SELECT pc.value FROM party_contacts pc WHERE pc.company_id = p.company_id AND pc.party_id = p.id AND pc.contact_type = 'email' ORDER BY pc.is_primary DESC, pc.id LIMIT 1), '') AS email,
          COALESCE((SELECT pa.address_line FROM party_addresses pa WHERE pa.company_id = p.company_id AND pa.party_id = p.id ORDER BY pa.is_primary DESC, CASE pa.purpose WHEN 'registered' THEN 0 ELSE 1 END, pa.id LIMIT 1), '') AS address_line,
          COALESCE((SELECT pa.postal_code FROM party_addresses pa WHERE pa.company_id = p.company_id AND pa.party_id = p.id ORDER BY pa.is_primary DESC, CASE pa.purpose WHEN 'registered' THEN 0 ELSE 1 END, pa.id LIMIT 1), '') AS postal_code
        FROM parties p
        WHERE p.company_id = ? AND p.deleted_at IS NULL
        ORDER BY p.code ASC, p.id ASC
        LIMIT ? OFFSET ?`, [companyId, pageSize, offset])
    ]);
    const totalItems = countRow?.count ?? 0;
    return Object.freeze({ items: Object.freeze(rows.map(mapRow)), page, pageSize, totalItems, totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize) });
  }
}

function mapRow(row: ExportRow): PartyMasterExportRow {
  return Object.freeze({
    id: row.id, code: row.code, classification: row.classification, status: row.status,
    firstName: row.first_name ?? "", lastName: row.last_name ?? "", legalName: row.legal_name ?? "", tradeName: row.trade_name ?? "",
    nationalCode: row.national_code ?? "", nationalId: row.national_id ?? "", registrationNumber: row.registration_number ?? "",
    economicNumber: row.economic_number ?? "", legacyEconomicCode: row.legacy_economic_code ?? "", taxFileNumber: row.tax_file_number ?? "",
    roles: row.roles ?? "", phone: row.phone ?? "", mobile: row.mobile ?? "", email: row.email ?? "",
    addressLine: row.address_line ?? "", postalCode: row.postal_code ?? "", createdAt: row.created_at, updatedAt: row.updated_at
  });
}
