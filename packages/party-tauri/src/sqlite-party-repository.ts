import type { DatabaseSession } from "@argin/database";
import {
  PartyApplicationError,
  type Party,
  type PartyRepository
} from "@argin/party";

import { SqlitePartyRepository as BaseSqlitePartyRepository } from "./sqlite-party-store.ts";

function mapSqliteConflict(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (normalized.includes("unique constraint failed: parties.id")) {
    throw new PartyApplicationError("party.id.conflict", "Party durable id already exists.");
  }
  if (
    normalized.includes("unique constraint failed: parties.company_id, parties.code") ||
    normalized.includes("uq_parties_company_code")
  ) {
    throw new PartyApplicationError("party.code.conflict", "Party code already exists in the company scope.");
  }
  if (
    normalized.includes("parties.company_id, parties.national_code") ||
    normalized.includes("parties.company_id, parties.national_id") ||
    normalized.includes("parties.company_id, parties.economic_number") ||
    normalized.includes("uq_parties_company_national_code") ||
    normalized.includes("uq_parties_company_national_id") ||
    normalized.includes("uq_parties_company_economic_number")
  ) {
    throw new PartyApplicationError("party.identity.conflict", "Party official identity already exists in the company scope.");
  }

  throw error;
}

export class SqlitePartyRepository implements PartyRepository {
  private readonly inner: BaseSqlitePartyRepository;

  constructor(database: DatabaseSession) {
    this.inner = new BaseSqlitePartyRepository(database);
  }

  findById(companyId: string, partyId: string): Promise<Party | null> {
    return this.inner.findById(companyId, partyId);
  }

  findByCode(companyId: string, code: string): Promise<Party | null> {
    return this.inner.findByCode(companyId, code);
  }

  async add(party: Party): Promise<void> {
    try {
      await this.inner.add(party);
    } catch (error) {
      mapSqliteConflict(error);
    }
  }

  async update(party: Party, expectedVersion?: number | null): Promise<void> {
    try {
      await this.inner.update(party, expectedVersion);
    } catch (error) {
      if (error instanceof PartyApplicationError) throw error;
      mapSqliteConflict(error);
    }
  }
}
