import type { PartyClassification } from "../../domain/party.ts";

export type PartyDuplicateReason =
  | "code"
  | "nationalCode"
  | "nationalId"
  | "economicNumber"
  | "displayName";

export type PartyDuplicateSeverity = "hard" | "advisory";

export interface PartyDuplicateCandidate {
  readonly partyId: string;
  readonly code: string;
  readonly displayName: string;
  readonly classification: PartyClassification;
  readonly reason: PartyDuplicateReason;
  readonly severity: PartyDuplicateSeverity;
}

export interface PartyDuplicateProbe {
  readonly companyId: string;
  readonly excludePartyId?: string | null;
  readonly code: string;
  readonly classification: PartyClassification;
  readonly displayName: string;
  readonly nationalCode?: string | null;
  readonly nationalId?: string | null;
  readonly economicNumber?: string | null;
}

export interface PartyDuplicateLookup {
  findHardCandidates(probe: PartyDuplicateProbe): Promise<readonly PartyDuplicateCandidate[]>;
  findAdvisoryCandidates(probe: PartyDuplicateProbe): Promise<readonly PartyDuplicateCandidate[]>;
}

export interface PartyDuplicateAssessment {
  readonly hardConflicts: readonly PartyDuplicateCandidate[];
  readonly advisoryMatches: readonly PartyDuplicateCandidate[];
}
