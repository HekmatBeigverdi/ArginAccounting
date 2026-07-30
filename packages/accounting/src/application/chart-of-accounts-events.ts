import {
  createDomainEvent,
  type Clock,
  type DomainEvent,
  type IdGenerator,
} from "@argin/platform";
import type { AccountCodingSettings } from "../domain/account-coding-settings.ts";
import type { Account } from "../domain/account.ts";
import type { ChartOfAccountsContext } from "./chart-of-accounts-context.ts";

export type ChartOfAccountsEventType =
  | "accounting.account.created"
  | "accounting.account.updated"
  | "accounting.account.status-changed"
  | "accounting.coding-settings.created"
  | "accounting.coding-settings.updated";

export interface ChartOfAccountsEventPayload {
  readonly companyId: string;
  readonly action: "create" | "update" | "status-change";
  readonly actor: ChartOfAccountsContext["actor"];
  readonly source: NonNullable<ChartOfAccountsContext["source"]>;
  readonly before: Account | AccountCodingSettings | null;
  readonly after: Account | AccountCodingSettings;
}

export type ChartOfAccountsEvent = DomainEvent<
  ChartOfAccountsEventPayload,
  ChartOfAccountsEventType
>;

export function createChartOfAccountsEvent(
  dependencies: {
    readonly clock: Clock;
    readonly idGenerator: IdGenerator;
  },
  context: ChartOfAccountsContext,
  input: {
    readonly eventType: ChartOfAccountsEventType;
    readonly action: ChartOfAccountsEventPayload["action"];
    readonly aggregateId: string;
    readonly aggregateType: "account" | "account-coding-settings";
    readonly aggregateVersion: number;
    readonly companyId: string;
    readonly before: ChartOfAccountsEventPayload["before"];
    readonly after: ChartOfAccountsEventPayload["after"];
  },
): ChartOfAccountsEvent {
  return createDomainEvent(dependencies, {
    eventType: input.eventType,
    aggregateId: input.aggregateId,
    aggregateType: input.aggregateType,
    aggregateVersion: input.aggregateVersion,
    ...(context.correlation === undefined
      ? {}
      : { correlationContext: context.correlation }),
    payload: Object.freeze({
      companyId: input.companyId,
      action: input.action,
      actor: Object.freeze({ ...context.actor }),
      source: context.source ?? "desktop",
      before: input.before,
      after: input.after,
    }),
    metadata: Object.freeze({
      module: "accounting",
      audit: true,
    }),
  });
}
