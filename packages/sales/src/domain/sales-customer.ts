import type { PartySelectionReference } from "@argin/party";
import { SALES_DOMAIN_ERROR_CODES, SalesDomainError } from "./sales-domain-errors.ts";

export interface SalesCustomerSnapshot {
  readonly partyId: string;
  readonly code: string;
  readonly displayName: string;
}

function fail(field: string): never {
  throw new SalesDomainError(SALES_DOMAIN_ERROR_CODES.customerInvalid, field);
}

function required(value: string, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) return fail(field);
  return value.trim();
}

export function createSalesCustomerSnapshot(party: PartySelectionReference): SalesCustomerSnapshot {
  if (typeof party !== "object" || party === null) return fail("customer");
  if (!party.roles.includes("customer")) {
    throw new SalesDomainError(SALES_DOMAIN_ERROR_CODES.customerRoleRequired, "customer.roles");
  }
  return Object.freeze({
    partyId: required(party.partyId, "customer.partyId"),
    code: required(party.code, "customer.code"),
    displayName: required(party.displayName, "customer.displayName"),
  });
}
