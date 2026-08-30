import type {
  PartyClassification,
  PartyRole,
  PartyStatus
} from "../../domain/party.ts";
import type { PartyAddress } from "../../domain/party-address.ts";
import type { PartyContact } from "../../domain/party-contact.ts";

export interface PartyIdentityDto {
  readonly nationalCode: string | null;
  readonly nationalId: string | null;
  readonly registrationNumber: string | null;
  readonly economicNumber: string | null;
  readonly legacyEconomicCode: string | null;
  readonly taxFileNumber: string | null;
}

export interface PartySummaryDto {
  readonly id: string;
  readonly companyId: string;
  readonly code: string;
  readonly classification: PartyClassification;
  readonly displayName: string;
  readonly status: PartyStatus;
  readonly roles: readonly PartyRole[];
  readonly primaryPhone: string | null;
  readonly primaryMobile: string | null;
  readonly primaryEmail: string | null;
  readonly updatedAt: string;
}

export interface PartyDetailDto extends PartySummaryDto {
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly legalName: string | null;
  readonly tradeName: string | null;
  readonly identity: PartyIdentityDto;
  readonly contacts: readonly PartyContact[];
  readonly addresses: readonly PartyAddress[];
  readonly createdAt: string;
}

export interface PartySelectorDto {
  readonly id: string;
  readonly companyId: string;
  readonly code: string;
  readonly displayName: string;
  readonly classification: PartyClassification;
  readonly status: PartyStatus;
  readonly roles: readonly PartyRole[];
}

export interface PageResult<TItem> {
  readonly items: readonly TItem[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalItems: number;
  readonly totalPages: number;
}
