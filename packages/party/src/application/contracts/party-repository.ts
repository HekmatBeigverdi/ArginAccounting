import type { Party } from "../../domain/party.ts";

export interface PartyRepository {
  findById(companyId: string, partyId: string): Promise<Party | null>;
  findByCode(companyId: string, code: string): Promise<Party | null>;
  add(party: Party): Promise<void>;
  update(party: Party, expectedVersion?: number | null): Promise<void>;
}
