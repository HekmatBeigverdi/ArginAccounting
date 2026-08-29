import type {
  LegalEntityIdentityInput,
  NaturalPersonIdentityInput
} from "../../domain/party-identity.ts";
import type {
  PartyAddressInput
} from "../../domain/party-address.ts";
import type {
  PartyContactInput
} from "../../domain/party-contact.ts";
import type {
  PartyRole
} from "../../domain/party.ts";

export interface PartyCommandContext {
  readonly companyId: string;
  readonly actorId: string;
  readonly correlationId: string;
  readonly requestId?: string | null;
  readonly occurredAt: string;
}

export interface CreateNaturalPersonPartyCommand {
  readonly classification: "natural-person";
  readonly context: PartyCommandContext;
  readonly partyId: string;
  readonly code: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly roles?: readonly PartyRole[];
  readonly identity?: NaturalPersonIdentityInput;
  readonly contacts?: readonly PartyContactInput[];
  readonly addresses?: readonly PartyAddressInput[];
}

export interface CreateLegalEntityPartyCommand {
  readonly classification: "legal-entity";
  readonly context: PartyCommandContext;
  readonly partyId: string;
  readonly code: string;
  readonly legalName: string;
  readonly tradeName?: string | null;
  readonly roles?: readonly PartyRole[];
  readonly identity?: LegalEntityIdentityInput;
  readonly contacts?: readonly PartyContactInput[];
  readonly addresses?: readonly PartyAddressInput[];
}

export type CreatePartyCommand =
  | CreateNaturalPersonPartyCommand
  | CreateLegalEntityPartyCommand;

export interface UpdateNaturalPersonPartyCommand {
  readonly classification: "natural-person";
  readonly context: PartyCommandContext;
  readonly partyId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly identity: NaturalPersonIdentityInput;
  readonly contacts: readonly PartyContactInput[];
  readonly addresses: readonly PartyAddressInput[];
  readonly expectedVersion?: number | null;
}

export interface UpdateLegalEntityPartyCommand {
  readonly classification: "legal-entity";
  readonly context: PartyCommandContext;
  readonly partyId: string;
  readonly legalName: string;
  readonly tradeName?: string | null;
  readonly identity: LegalEntityIdentityInput;
  readonly contacts: readonly PartyContactInput[];
  readonly addresses: readonly PartyAddressInput[];
  readonly expectedVersion?: number | null;
}

export type UpdatePartyCommand =
  | UpdateNaturalPersonPartyCommand
  | UpdateLegalEntityPartyCommand;

export interface SetPartyStatusCommand {
  readonly context: PartyCommandContext;
  readonly partyId: string;
  readonly status: "active" | "inactive";
  readonly expectedVersion?: number | null;
}

export interface AddPartyRoleCommand {
  readonly context: PartyCommandContext;
  readonly partyId: string;
  readonly role: PartyRole;
  readonly expectedVersion?: number | null;
}

export interface RemovePartyRoleCommand {
  readonly context: PartyCommandContext;
  readonly partyId: string;
  readonly role: PartyRole;
  readonly expectedVersion?: number | null;
}
