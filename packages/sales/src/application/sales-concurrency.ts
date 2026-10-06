import { SALES_DOMAIN_ERROR_CODES, SalesDomainError } from "../domain/sales-domain-errors.ts";
import {
  decideSalesReplay,
  type SalesIdempotencyReader,
  type SalesMutationContext,
  type SalesReplayDecision,
} from "./sales-replay-safety.ts";
import {
  transitionSalesLifecycle,
  type SalesLifecycleState,
  type TransitionSalesLifecycleInput,
} from "../domain/sales-lifecycle.ts";

export interface SalesVersionedAggregate<T> {
  readonly value: T;
  readonly version: number;
}

export interface SalesCompareAndSwapCommand {
  readonly expectedVersion: number;
}

function fail(code: (typeof SALES_DOMAIN_ERROR_CODES)[keyof typeof SALES_DOMAIN_ERROR_CODES], field: string): never {
  throw new SalesDomainError(code, field);
}

function version(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    return fail(SALES_DOMAIN_ERROR_CODES.versionInvalid, field);
  }
  return value;
}

export function createSalesVersionedAggregate<T>(
  value: T,
  initialVersion = 1,
): SalesVersionedAggregate<T> {
  if (value == null) return fail(SALES_DOMAIN_ERROR_CODES.inputInvalid, "aggregate.value");
  return Object.freeze({
    value,
    version: version(initialVersion, "aggregate.version"),
  });
}

export function assertSalesExpectedVersion(
  currentVersion: number,
  expectedVersion: number,
): void {
  const current = version(currentVersion, "aggregate.currentVersion");
  const expected = version(expectedVersion, "aggregate.expectedVersion");
  if (current !== expected) {
    return fail(SALES_DOMAIN_ERROR_CODES.concurrencyConflict, "aggregate.expectedVersion");
  }
}

export function applySalesCompareAndSwap<T>(
  current: SalesVersionedAggregate<T>,
  command: SalesCompareAndSwapCommand,
  mutate: (value: T) => T,
): SalesVersionedAggregate<T> {
  if (!current || typeof current !== "object" || typeof mutate !== "function") {
    return fail(SALES_DOMAIN_ERROR_CODES.inputInvalid, "aggregate");
  }
  assertSalesExpectedVersion(current.version, command.expectedVersion);
  const nextValue = mutate(current.value);
  if (nextValue == null) return fail(SALES_DOMAIN_ERROR_CODES.inputInvalid, "aggregate.nextValue");
  return Object.freeze({
    value: nextValue,
    version: current.version + 1,
  });
}

export function transitionSalesLifecycleWithVersion(
  current: SalesVersionedAggregate<SalesLifecycleState>,
  input: TransitionSalesLifecycleInput & SalesCompareAndSwapCommand,
): SalesVersionedAggregate<SalesLifecycleState> {
  return applySalesCompareAndSwap(
    current,
    { expectedVersion: input.expectedVersion },
    (state) => transitionSalesLifecycle(state, input),
  );
}

export async function prepareSalesMutation(
  reader: SalesIdempotencyReader,
  context: SalesMutationContext,
  currentVersion: number,
  expectedVersion: number,
): Promise<SalesReplayDecision> {
  const replay = await decideSalesReplay(reader, context);
  if (replay.kind === "replay") return replay;
  assertSalesExpectedVersion(currentVersion, expectedVersion);
  return replay;
}
