import {
  createDomainEvent,
  type Clock,
  type DomainEvent,
  type IdGenerator,
} from "@argin/platform";
import type { AccountDimensionPolicy } from "../domain/account-dimension-policy.ts";
import type { AccountingDimensionMember } from "../domain/accounting-dimension-member.ts";
import type { AccountingDimensionType } from "../domain/accounting-dimension-type.ts";
import type { ChartOfAccountsContext } from "./chart-of-accounts-context.ts";

type DimensionAggregate =
  | AccountingDimensionType
  | AccountingDimensionMember
  | AccountDimensionPolicy;

export type AccountingDimensionsEventType =
  | `accounting.dimension-${"type" | "member" | "policy"}.${"created" | "updated" | "deleted"}`
  | `accounting.dimension-${"type" | "member"}.status-changed`;

export interface AccountingDimensionsEventPayload {
  readonly companyId: string;
  readonly action: "create" | "update" | "status-change" | "delete";
  readonly actor: ChartOfAccountsContext["actor"];
  readonly source: NonNullable<ChartOfAccountsContext["source"]>;
  readonly before: DimensionAggregate | null;
  readonly after: DimensionAggregate | null;
}

export type AccountingDimensionsEvent = DomainEvent<
  AccountingDimensionsEventPayload,
  AccountingDimensionsEventType
>;

export function createAccountingDimensionsEvent(
  dependencies: { readonly clock: Clock; readonly idGenerator: IdGenerator },
  context: ChartOfAccountsContext,
  input: {
    readonly eventType: AccountingDimensionsEventType;
    readonly action: AccountingDimensionsEventPayload["action"];
    readonly aggregateId: string;
    readonly aggregateType: "accounting-dimension-type" | "accounting-dimension-member" | "account-dimension-policy";
    readonly aggregateVersion: number;
    readonly companyId: string;
    readonly before: DimensionAggregate | null;
    readonly after: DimensionAggregate | null;
  },
): AccountingDimensionsEvent {
  return createDomainEvent(dependencies, {
    eventType: input.eventType,
    aggregateId: input.aggregateId,
    aggregateType: input.aggregateType,
    aggregateVersion: input.aggregateVersion,
    ...(context.correlation === undefined ? {} : { correlationContext: context.correlation }),
    payload: Object.freeze({
      companyId: input.companyId,
      action: input.action,
      actor: Object.freeze({ ...context.actor }),
      source: context.source ?? "desktop",
      before: input.before,
      after: input.after,
    }),
    metadata: Object.freeze({ module: "accounting", audit: true }),
  });
}
