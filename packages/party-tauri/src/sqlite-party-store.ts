import type { DatabaseSession } from "@argin/database";
import {
  PartyApplicationError,
  createParty,
  type GetPartyByIdQuery,
  type ListPartiesQuery,
  type PageResult,
  type Party,
  type PartyAddress,
  type PartyContact,
  type PartyDetailDto,
  type PartyDuplicateCandidate,
  type PartyDuplicateLookup,
  type PartyDuplicateProbe,
  type PartyReader,
  type PartyRepository,
  type PartyRole,
  type PartySelectorDto,
  type PartySelectorQuery,
  type PartySummaryDto
} from "@argin/party";

interface PartyRow {
  id: string;
  company_id: string;
  code: string;
  classification: Party["classification"];
  status: Party["status"];
  first_name: string | null;
  last_name: string | null;
  legal_name: string | null;
  trade_name: string | null;
  display_name: string;
  national_code: string | null;
  national_id: string | null;
  registration_number: string | null;
  economic_number: string | null;
  legacy_economic_code: string | null;
  tax_file_number: string | null;
  created_at: string;
  updated_at: string;
  version: number;
}

interface RoleRow { role: PartyRole; }
interface ContactRow {
  id: string;
  contact_type: PartyContact["type"];
  value: string;
  purpose: PartyContact["purpose"];
  is_primary: number;
  contact_person: string | null;
  title: string | null;
}
interface AddressRow {
  id: string;
  purpose: PartyAddress["purpose"];
  country_code: "IR";
  province: string | null;
  city: string | null;
  district: string | null;
  address_line: string;
  postal_code: string | null;
  is_primary: number;
}

interface SummaryRow extends PartyRow {
  roles_csv: string | null;
  primary_phone: string | null;
  primary_mobile: string | null;
  primary_email: string | null;
}

interface CountRow { count: number; }

function mapRoles(csv: string | null): readonly PartyRole[] {
  if (!csv) return Object.freeze([]);
  return Object.freeze(csv.split(",").filter((value): value is PartyRole => value === "customer" || value === "supplier"));
}

function mapContacts(rows: readonly ContactRow[]): readonly PartyContact[] {
  return Object.freeze(rows.map((row) => Object.freeze({
    id: row.id,
    type: row.contact_type,
    value: row.value,
    purpose: row.purpose,
    isPrimary: row.is_primary === 1,
    contactPerson: row.contact_person,
    title: row.title
  })));
}

function mapAddresses(rows: readonly AddressRow[]): readonly PartyAddress[] {
  return Object.freeze(rows.map((row) => Object.freeze({
    id: row.id,
    purpose: row.purpose,
    countryCode: row.country_code,
    province: row.province,
    city: row.city,
    district: row.district,
    addressLine: row.address_line,
    postalCode: row.postal_code,
    isPrimary: row.is_primary === 1
  })));
}

function mapAggregate(row: PartyRow, roles: readonly PartyRole[], contacts: readonly PartyContact[], addresses: readonly PartyAddress[]): Party {
  const common = {
    id: row.id,
    companyId: row.company_id,
    code: row.code,
    roles,
    contacts,
    addresses,
    createdAt: row.created_at
  } as const;

  const created = row.classification === "natural-person"
    ? createParty({
        classification: "natural-person",
        ...common,
        firstName: row.first_name ?? "",
        lastName: row.last_name ?? "",
        identity: {
          nationalCode: row.national_code,
          economicNumber: row.economic_number,
          taxFileNumber: row.tax_file_number
        }
      })
    : createParty({
        classification: "legal-entity",
        ...common,
        legalName: row.legal_name ?? "",
        tradeName: row.trade_name,
        identity: {
          nationalId: row.national_id,
          registrationNumber: row.registration_number,
          economicNumber: row.economic_number,
          legacyEconomicCode: row.legacy_economic_code,
          taxFileNumber: row.tax_file_number
        }
      });

  return Object.freeze({ ...created, status: row.status, updatedAt: row.updated_at }) as Party;
}

async function loadAggregate(database: DatabaseSession, row: PartyRow): Promise<Party> {
  const [roleRows, contactRows, addressRows] = await Promise.all([
    database.query<RoleRow>("SELECT role FROM party_roles WHERE company_id = ? AND party_id = ? ORDER BY role", [row.company_id, row.id]),
    database.query<ContactRow>(`SELECT id, contact_type, value, purpose, is_primary, contact_person, title FROM party_contacts WHERE company_id = ? AND party_id = ? ORDER BY contact_type, purpose, id`, [row.company_id, row.id]),
    database.query<AddressRow>(`SELECT id, purpose, country_code, province, city, district, address_line, postal_code, is_primary FROM party_addresses WHERE company_id = ? AND party_id = ? ORDER BY purpose, id`, [row.company_id, row.id])
  ]);
  return mapAggregate(row, Object.freeze(roleRows.map((item) => item.role)), mapContacts(contactRows), mapAddresses(addressRows));
}

function partyIdentityColumns(party: Party): readonly (string | null)[] {
  if (party.classification === "natural-person") {
    return [party.identity.nationalCode, null, null, party.identity.economicNumber, null, party.identity.taxFileNumber];
  }
  return [null, party.identity.nationalId, party.identity.registrationNumber, party.identity.economicNumber, party.identity.legacyEconomicCode, party.identity.taxFileNumber];
}

async function insertChildren(database: DatabaseSession, party: Party): Promise<void> {
  for (const role of party.roles) {
    await database.execute("INSERT INTO party_roles (company_id, party_id, role) VALUES (?, ?, ?)", [party.companyId, party.id, role]);
  }
  for (const contact of party.contacts) {
    await database.execute(`INSERT INTO party_contacts (id, company_id, party_id, contact_type, value, purpose, is_primary, contact_person, title) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [contact.id, party.companyId, party.id, contact.type, contact.value, contact.purpose, contact.isPrimary ? 1 : 0, contact.contactPerson, contact.title]);
  }
  for (const address of party.addresses) {
    await database.execute(`INSERT INTO party_addresses (id, company_id, party_id, purpose, country_code, province, city, district, address_line, postal_code, is_primary) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [address.id, party.companyId, party.id, address.purpose, address.countryCode, address.province, address.city, address.district, address.addressLine, address.postalCode, address.isPrimary ? 1 : 0]);
  }
}

export class SqlitePartyRepository implements PartyRepository {
  constructor(private readonly database: DatabaseSession) {}

  async findById(companyId: string, partyId: string): Promise<Party | null> {
    const row = await this.database.queryOne<PartyRow>("SELECT * FROM parties WHERE company_id = ? AND id = ?", [companyId, partyId]);
    return row ? loadAggregate(this.database, row) : null;
  }

  async findByCode(companyId: string, code: string): Promise<Party | null> {
    const row = await this.database.queryOne<PartyRow>("SELECT * FROM parties WHERE company_id = ? AND code = ?", [companyId, code]);
    return row ? loadAggregate(this.database, row) : null;
  }

  async add(party: Party): Promise<void> {
    const [nationalCode, nationalId, registrationNumber, economicNumber, legacyEconomicCode, taxFileNumber] = partyIdentityColumns(party);
    await this.database.execute(`
      INSERT INTO parties (
        id, company_id, code, classification, status,
        first_name, last_name, legal_name, trade_name, display_name,
        national_code, national_id, registration_number, economic_number,
        legacy_economic_code, tax_file_number, created_at, updated_at, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [
      party.id, party.companyId, party.code, party.classification, party.status,
      party.classification === "natural-person" ? party.firstName : null,
      party.classification === "natural-person" ? party.lastName : null,
      party.classification === "legal-entity" ? party.legalName : null,
      party.classification === "legal-entity" ? party.tradeName : null,
      party.displayName, nationalCode, nationalId, registrationNumber, economicNumber,
      legacyEconomicCode, taxFileNumber, party.createdAt, party.updatedAt
    ]);
    await insertChildren(this.database, party);
  }

  async update(party: Party, expectedVersion?: number | null): Promise<void> {
    const [nationalCode, nationalId, registrationNumber, economicNumber, legacyEconomicCode, taxFileNumber] = partyIdentityColumns(party);
    const versionPredicate = expectedVersion == null ? "" : " AND version = ?";
    const parameters: Array<string | number | null> = [
      party.status,
      party.classification === "natural-person" ? party.firstName : null,
      party.classification === "natural-person" ? party.lastName : null,
      party.classification === "legal-entity" ? party.legalName : null,
      party.classification === "legal-entity" ? party.tradeName : null,
      party.displayName, nationalCode, nationalId, registrationNumber, economicNumber,
      legacyEconomicCode, taxFileNumber, party.updatedAt, party.companyId, party.id
    ];
    if (expectedVersion != null) parameters.push(expectedVersion);

    const result = await this.database.execute(`
      UPDATE parties SET
        status = ?, first_name = ?, last_name = ?, legal_name = ?, trade_name = ?,
        display_name = ?, national_code = ?, national_id = ?, registration_number = ?,
        economic_number = ?, legacy_economic_code = ?, tax_file_number = ?,
        updated_at = ?, version = version + 1
      WHERE company_id = ? AND id = ?${versionPredicate}
    `, parameters);

    if (result.rowsAffected !== 1) {
      const exists = await this.database.queryOne<{ version: number }>("SELECT version FROM parties WHERE company_id = ? AND id = ?", [party.companyId, party.id]);
      if (!exists) throw new PartyApplicationError("party.notFound", "Party was not found in the requested company scope.");
      throw new PartyApplicationError("party.concurrentModification", "Party has been modified by another operation.");
    }

    await this.database.execute("DELETE FROM party_roles WHERE company_id = ? AND party_id = ?", [party.companyId, party.id]);
    await this.database.execute("DELETE FROM party_contacts WHERE company_id = ? AND party_id = ?", [party.companyId, party.id]);
    await this.database.execute("DELETE FROM party_addresses WHERE company_id = ? AND party_id = ?", [party.companyId, party.id]);
    await insertChildren(this.database, party);
  }
}

function validatePage(query: ListPartiesQuery): void {
  if (!Number.isInteger(query.page.page) || query.page.page < 1 || !Number.isInteger(query.page.pageSize) || query.page.pageSize < 1 || query.page.pageSize > 200) {
    throw new PartyApplicationError("party.invalidQuery", "Party paging must use page >= 1 and pageSize between 1 and 200.");
  }
}

function placeholders(count: number): string { return Array.from({ length: count }, () => "?").join(", "); }

function buildFilter(query: ListPartiesQuery): { sql: string; params: Array<string | number> } {
  const { filter } = query;
  const clauses = ["p.company_id = ?"];
  const params: Array<string | number> = [filter.companyId];
  const search = filter.search?.trim();
  if (search) {
    clauses.push("(p.code LIKE ? ESCAPE '\\' OR p.display_name LIKE ? ESCAPE '\\')");
    const escaped = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
    params.push(escaped, escaped);
  }
  if (filter.classifications?.length) {
    clauses.push(`p.classification IN (${placeholders(filter.classifications.length)})`);
    params.push(...filter.classifications);
  }
  if (filter.statuses?.length) {
    clauses.push(`p.status IN (${placeholders(filter.statuses.length)})`);
    params.push(...filter.statuses);
  }
  if (filter.roles?.length) {
    clauses.push(`EXISTS (SELECT 1 FROM party_roles prf WHERE prf.company_id = p.company_id AND prf.party_id = p.id AND prf.role IN (${placeholders(filter.roles.length)}))`);
    params.push(...filter.roles);
  }
  if (filter.nationalCode) { clauses.push("p.national_code = ?"); params.push(filter.nationalCode); }
  if (filter.nationalId) { clauses.push("p.national_id = ?"); params.push(filter.nationalId); }
  if (filter.economicNumber) { clauses.push("p.economic_number = ?"); params.push(filter.economicNumber); }
  return { sql: clauses.join(" AND "), params };
}

const summarySelect = `
  SELECT p.*,
    (SELECT GROUP_CONCAT(pr.role, ',') FROM party_roles pr WHERE pr.company_id = p.company_id AND pr.party_id = p.id ORDER BY pr.role) AS roles_csv,
    (SELECT pc.value FROM party_contacts pc WHERE pc.company_id = p.company_id AND pc.party_id = p.id AND pc.contact_type = 'phone' AND pc.is_primary = 1 ORDER BY pc.purpose, pc.id LIMIT 1) AS primary_phone,
    (SELECT pc.value FROM party_contacts pc WHERE pc.company_id = p.company_id AND pc.party_id = p.id AND pc.contact_type = 'mobile' AND pc.is_primary = 1 ORDER BY pc.purpose, pc.id LIMIT 1) AS primary_mobile,
    (SELECT pc.value FROM party_contacts pc WHERE pc.company_id = p.company_id AND pc.party_id = p.id AND pc.contact_type = 'email' AND pc.is_primary = 1 ORDER BY pc.purpose, pc.id LIMIT 1) AS primary_email
  FROM parties p`;

function mapSummary(row: SummaryRow): PartySummaryDto {
  return Object.freeze({
    id: row.id, companyId: row.company_id, code: row.code,
    classification: row.classification, displayName: row.display_name,
    status: row.status, roles: mapRoles(row.roles_csv),
    primaryPhone: row.primary_phone, primaryMobile: row.primary_mobile,
    primaryEmail: row.primary_email, updatedAt: row.updated_at
  });
}

function mapDetail(party: Party): PartyDetailDto {
  const primary = (type: PartyContact["type"]) => party.contacts.find((item) => item.type === type && item.isPrimary)?.value ?? null;
  return Object.freeze({
    id: party.id, companyId: party.companyId, code: party.code,
    classification: party.classification, displayName: party.displayName,
    status: party.status, roles: party.roles,
    primaryPhone: primary("phone"), primaryMobile: primary("mobile"), primaryEmail: primary("email"),
    firstName: party.classification === "natural-person" ? party.firstName : null,
    lastName: party.classification === "natural-person" ? party.lastName : null,
    legalName: party.classification === "legal-entity" ? party.legalName : null,
    tradeName: party.classification === "legal-entity" ? party.tradeName : null,
    identity: party.classification === "natural-person"
      ? { nationalCode: party.identity.nationalCode, nationalId: null, registrationNumber: null, economicNumber: party.identity.economicNumber, legacyEconomicCode: null, taxFileNumber: party.identity.taxFileNumber }
      : { nationalCode: null, nationalId: party.identity.nationalId, registrationNumber: party.identity.registrationNumber, economicNumber: party.identity.economicNumber, legacyEconomicCode: party.identity.legacyEconomicCode, taxFileNumber: party.identity.taxFileNumber },
    contacts: party.contacts, addresses: party.addresses,
    createdAt: party.createdAt, updatedAt: party.updatedAt
  });
}

export class SqlitePartyReader implements PartyReader {
  constructor(private readonly database: DatabaseSession) {}

  async getById(query: GetPartyByIdQuery): Promise<PartyDetailDto | null> {
    const party = await new SqlitePartyRepository(this.database).findById(query.companyId, query.partyId);
    return party ? mapDetail(party) : null;
  }

  async list(query: ListPartiesQuery): Promise<PageResult<PartySummaryDto>> {
    validatePage(query);
    const filter = buildFilter(query);
    const count = await this.database.queryOne<CountRow>(`SELECT COUNT(*) AS count FROM parties p WHERE ${filter.sql}`, filter.params);
    const sortMap = { code: "p.code", displayName: "p.display_name", createdAt: "p.created_at", updatedAt: "p.updated_at" } as const;
    const sortField = sortMap[query.sort?.field ?? "displayName"];
    const direction = query.sort?.direction === "desc" ? "DESC" : "ASC";
    const offset = (query.page.page - 1) * query.page.pageSize;
    const rows = await this.database.query<SummaryRow>(`${summarySelect} WHERE ${filter.sql} ORDER BY ${sortField} ${direction}, p.id ASC LIMIT ? OFFSET ?`, [...filter.params, query.page.pageSize, offset]);
    const totalItems = count?.count ?? 0;
    return Object.freeze({
      items: Object.freeze(rows.map(mapSummary)), page: query.page.page, pageSize: query.page.pageSize,
      totalItems, totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / query.page.pageSize)
    });
  }

  async select(query: PartySelectorQuery): Promise<readonly PartySelectorDto[]> {
    if (!Number.isInteger(query.limit) || query.limit < 1 || query.limit > 100) {
      throw new PartyApplicationError("party.invalidQuery", "Party selector limit must be between 1 and 100.");
    }
    const clauses = ["p.company_id = ?"];
    const params: Array<string | number> = [query.companyId];
    const search = query.search?.trim();
    if (search) {
      clauses.push("(p.code LIKE ? ESCAPE '\\' OR p.display_name LIKE ? ESCAPE '\\')");
      const escaped = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
      params.push(escaped, escaped);
    }
    if (query.statuses?.length) { clauses.push(`p.status IN (${placeholders(query.statuses.length)})`); params.push(...query.statuses); }
    if (query.roles?.length) {
      clauses.push(`EXISTS (SELECT 1 FROM party_roles prf WHERE prf.company_id = p.company_id AND prf.party_id = p.id AND prf.role IN (${placeholders(query.roles.length)}))`);
      params.push(...query.roles);
    }
    const rows = await this.database.query<SummaryRow>(`${summarySelect} WHERE ${clauses.join(" AND ")} ORDER BY p.display_name ASC, p.code ASC, p.id ASC LIMIT ?`, [...params, query.limit]);
    return Object.freeze(rows.map((row) => Object.freeze({ id: row.id, companyId: row.company_id, code: row.code, displayName: row.display_name, classification: row.classification, status: row.status, roles: mapRoles(row.roles_csv) })));
  }
}

interface DuplicateRow {
  id: string; code: string; display_name: string; classification: Party["classification"];
  national_code: string | null; national_id: string | null; economic_number: string | null;
}

export class SqlitePartyDuplicateLookup implements PartyDuplicateLookup {
  constructor(private readonly database: DatabaseSession) {}

  async findHardCandidates(probe: PartyDuplicateProbe): Promise<readonly PartyDuplicateCandidate[]> {
    const tests: string[] = ["p.code = ?"];
    const params: Array<string> = [probe.companyId, probe.code];
    if (probe.nationalCode) { tests.push("p.national_code = ?"); params.push(probe.nationalCode); }
    if (probe.nationalId) { tests.push("p.national_id = ?"); params.push(probe.nationalId); }
    if (probe.economicNumber) { tests.push("p.economic_number = ?"); params.push(probe.economicNumber); }
    let sql = `SELECT id, code, display_name, classification, national_code, national_id, economic_number FROM parties p WHERE p.company_id = ? AND (${tests.join(" OR ")})`;
    if (probe.excludePartyId) { sql += " AND p.id <> ?"; params.push(probe.excludePartyId); }
    const rows = await this.database.query<DuplicateRow>(sql, params);
    const candidates: PartyDuplicateCandidate[] = [];
    for (const row of rows) {
      const add = (reason: PartyDuplicateCandidate["reason"]) => candidates.push(Object.freeze({ partyId: row.id, code: row.code, displayName: row.display_name, classification: row.classification, reason, severity: "hard" }));
      if (row.code === probe.code) add("code");
      if (probe.nationalCode && row.national_code === probe.nationalCode) add("nationalCode");
      if (probe.nationalId && row.national_id === probe.nationalId) add("nationalId");
      if (probe.economicNumber && row.economic_number === probe.economicNumber) add("economicNumber");
    }
    return Object.freeze(candidates);
  }

  async findAdvisoryCandidates(probe: PartyDuplicateProbe): Promise<readonly PartyDuplicateCandidate[]> {
    const params: string[] = [probe.companyId, probe.classification, probe.displayName];
    let sql = `SELECT id, code, display_name, classification, national_code, national_id, economic_number FROM parties p WHERE p.company_id = ? AND p.classification = ? AND lower(trim(p.display_name)) = lower(trim(?))`;
    if (probe.excludePartyId) { sql += " AND p.id <> ?"; params.push(probe.excludePartyId); }
    sql += " ORDER BY p.display_name, p.id LIMIT 25";
    const rows = await this.database.query<DuplicateRow>(sql, params);
    return Object.freeze(rows.map((row) => Object.freeze({ partyId: row.id, code: row.code, displayName: row.display_name, classification: row.classification, reason: "displayName" as const, severity: "advisory" as const })));
  }
}
