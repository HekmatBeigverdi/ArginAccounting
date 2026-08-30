import type {
  PartyClassification,
  PartyRole,
  PartyStatus
} from "../../domain/party.ts";

export type PartySortField =
  | "code"
  | "displayName"
  | "createdAt"
  | "updatedAt";

export type SortDirection = "asc" | "desc";

export interface PartyPageRequest {
  readonly page: number;
  readonly pageSize: number;
}

export interface PartySort {
  readonly field: PartySortField;
  readonly direction: SortDirection;
}

export interface PartyFilter {
  readonly companyId: string;
  readonly search?: string | null;
  readonly classifications?: readonly PartyClassification[];
  readonly roles?: readonly PartyRole[];
  readonly statuses?: readonly PartyStatus[];
  readonly nationalCode?: string | null;
  readonly nationalId?: string | null;
  readonly economicNumber?: string | null;
}

export interface ListPartiesQuery {
  readonly filter: PartyFilter;
  readonly page: PartyPageRequest;
  readonly sort?: PartySort;
}

export interface GetPartyByIdQuery {
  readonly companyId: string;
  readonly partyId: string;
}

export interface PartySelectorQuery {
  readonly companyId: string;
  readonly search?: string | null;
  readonly roles?: readonly PartyRole[];
  readonly statuses?: readonly PartyStatus[];
  readonly limit: number;
}
