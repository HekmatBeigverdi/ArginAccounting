import type { CurrencyCode } from "@argin/platform";
import type { InventoryResolvedInboundCostBasis } from "../../domain/inventory-inbound-cost.ts";
import type { InventoryCostResolutionPolicy } from "../../domain/inventory-cost-resolution-policy.ts";
import type { InventoryStockMovementSnapshot } from "../../domain/inventory-stock.ts";
import type {
  InventoryCostLayerSnapshot,
  InventoryValuationEntrySnapshot,
  InventoryValuationMethod,
} from "../../domain/inventory-valuation.ts";
import type { InventoryValuationPolicySnapshot } from "../../domain/inventory-valuation-policy.ts";
import type {
  InventoryValuationRecalculationPlan,
  InventoryValuationRecalculationTrigger,
} from "../../domain/inventory-valuation-recalculation.ts";

export type InventoryValuationApplicationErrorCode =
  | "VALUATION_APP_INPUT_INVALID"
  | "VALUATION_APP_NOT_FOUND"
  | "VALUATION_APP_CONFLICT"
  | "VALUATION_APP_POLICY_LOCKED"
  | "VALUATION_APP_COST_UNRESOLVED"
  | "VALUATION_APP_RECALCULATION_REQUIRED";

export class InventoryValuationApplicationError extends Error {
  constructor(
    public readonly code: InventoryValuationApplicationErrorCode,
    public readonly field: string,
  ) {
    super(`${code}:${field}`);
    this.name = "InventoryValuationApplicationError";
  }
}

export interface InventoryValuationOperationContext {
  readonly companyId: string;
  readonly requestId: string;
  readonly actorId: string;
  readonly occurredAt: string;
}

const fail = (code: InventoryValuationApplicationErrorCode, field: string): never => {
  throw new InventoryValuationApplicationError(code, field);
};

function required(value: string, field: string): string {
  if (typeof value !== "string" || !value.trim()) return fail("VALUATION_APP_INPUT_INVALID", field);
  return value.trim();
}

export function createInventoryValuationOperationContext(input: InventoryValuationOperationContext): InventoryValuationOperationContext {
  if (!input || typeof input !== "object") return fail("VALUATION_APP_INPUT_INVALID", "context");
  const occurredAt = new Date(input.occurredAt);
  if (!Number.isFinite(occurredAt.getTime())) return fail("VALUATION_APP_INPUT_INVALID", "occurredAt");
  return Object.freeze({
    companyId: required(input.companyId, "companyId"),
    requestId: required(input.requestId, "requestId"),
    actorId: required(input.actorId, "actorId"),
    occurredAt: occurredAt.toISOString(),
  });
}

export interface SetInitialInventoryValuationPolicyCommand {
  readonly context: InventoryValuationOperationContext;
  readonly policyId: string;
  readonly method: InventoryValuationMethod;
  readonly strategyVersion: number;
  readonly currency: CurrencyCode;
  readonly effectiveFrom: string;
}

export interface TransitionInventoryValuationPolicyCommand {
  readonly context: InventoryValuationOperationContext;
  readonly policyId: string;
  readonly expectedCurrentPolicyId: string;
  readonly expectedCurrentRevision: number;
  readonly method: InventoryValuationMethod;
  readonly strategyVersion: number;
  readonly currency: CurrencyCode;
  readonly effectiveFrom: string;
  readonly changeReason: string;
}

export interface ResolveInventoryMovementValuationCommand {
  readonly context: InventoryValuationOperationContext;
  readonly movementId: string;
  readonly valuationEntryId: string;
  readonly expectedPolicyId: string;
  readonly costResolutionPolicy?: InventoryCostResolutionPolicy;
}

export interface RecalculateInventoryValuationCommand {
  readonly context: InventoryValuationOperationContext;
  readonly trigger: InventoryValuationRecalculationTrigger;
}

export interface GetInventoryValuationEntryQuery {
  readonly companyId: string;
  readonly movementId: string;
}

export interface ListInventoryUnresolvedValuationsQuery {
  readonly companyId: string;
  readonly productId?: string;
  readonly fromBusinessDate?: string;
  readonly limit?: number;
}

export interface GetInventoryValuationPolicyHistoryQuery {
  readonly companyId: string;
}

export interface InventoryValuationStateReference {
  readonly companyId: string;
  readonly productId: string;
  readonly warehouseId: string;
  readonly zoneId: string | null;
  readonly locationId: string | null;
  readonly businessDate: string;
}

export interface InventoryValuationStateSnapshot {
  readonly reference: InventoryValuationStateReference;
  readonly policyId: string;
  readonly method: InventoryValuationMethod;
  readonly strategyVersion: number;
  readonly currency: CurrencyCode;
  readonly quantity: string;
  readonly totalCost: number | null;
  readonly unresolvedCount: number;
}

export interface InventoryValuationEntryRepository {
  findByMovement(companyId: string, movementId: string): Promise<InventoryValuationEntrySnapshot | null>;
  listUnresolved(query: ListInventoryUnresolvedValuationsQuery): Promise<readonly InventoryValuationEntrySnapshot[]>;
  listByProductFrom(
    companyId: string,
    productId: string,
    businessDate: string,
    businessOrder: number,
  ): Promise<readonly InventoryValuationEntrySnapshot[]>;
  add(entry: InventoryValuationEntrySnapshot): Promise<void>;
  replaceDerivedFrom(plan: InventoryValuationRecalculationPlan, entries: readonly InventoryValuationEntrySnapshot[]): Promise<void>;
}

export interface InventoryValuationPolicyRepository {
  listByCompany(companyId: string): Promise<readonly InventoryValuationPolicySnapshot[]>;
  findCurrent(companyId: string): Promise<InventoryValuationPolicySnapshot | null>;
  hasAuthoritativeValuation(companyId: string): Promise<boolean>;
  add(policy: InventoryValuationPolicySnapshot): Promise<void>;
}

export interface InventoryCostLayerRepository {
  listByProductFrom(
    companyId: string,
    productId: string,
    businessDate: string,
    businessOrder: number,
  ): Promise<readonly InventoryCostLayerSnapshot[]>;
  replaceDerivedFrom(plan: InventoryValuationRecalculationPlan, layers: readonly InventoryCostLayerSnapshot[]): Promise<void>;
}

/**
 * Authoritative monetary inputs supplied by ERP/Purchase/Sales-facing adapters.
 * The valuation module owns neither invoice/vendor/freight workflow nor its persistence.
 */
export interface InventoryValuationCostInputProvider {
  getResolvedInboundCostBasis(companyId: string, movement: InventoryStockMovementSnapshot): Promise<InventoryResolvedInboundCostBasis | null>;
}

export interface InventoryValuationMovementReader {
  findById(companyId: string, movementId: string): Promise<InventoryStockMovementSnapshot | null>;
  listCompanyProductMovements(companyId: string, productId: string): Promise<readonly InventoryStockMovementSnapshot[]>;
  listCompanyMovementsFrom(companyId: string, businessDate: string): Promise<readonly InventoryStockMovementSnapshot[]>;
}

export interface InventoryValuationStateRepository {
  get(reference: InventoryValuationStateReference): Promise<InventoryValuationStateSnapshot | null>;
  replaceBatch(states: readonly InventoryValuationStateSnapshot[]): Promise<void>;
}

export interface InventoryValuationRecalculationResult {
  readonly plan: InventoryValuationRecalculationPlan;
  readonly recalculatedMovementCount: number;
  readonly unresolvedMovementCount: number;
}

/**
 * Application-facing orchestration seam. Step 9 owns deterministic planning/replay algorithms;
 * Step 11 only defines how an application service requests that work.
 */
export interface InventoryValuationRecalculationPort {
  recalculate(command: RecalculateInventoryValuationCommand): Promise<InventoryValuationRecalculationResult>;
}

export interface InventoryValuationUnitOfWorkContext {
  readonly entries: InventoryValuationEntryRepository;
  readonly policies: InventoryValuationPolicyRepository;
  readonly layers: InventoryCostLayerRepository;
  readonly states: InventoryValuationStateRepository;
  readonly movements: InventoryValuationMovementReader;
  readonly costInputs: InventoryValuationCostInputProvider;
}

export interface InventoryValuationUnitOfWork {
  execute<T>(work: (context: InventoryValuationUnitOfWorkContext) => Promise<T>): Promise<T>;
}

export interface InventoryValuationCommandService {
  setInitialPolicy(command: SetInitialInventoryValuationPolicyCommand): Promise<InventoryValuationPolicySnapshot>;
  transitionPolicy(command: TransitionInventoryValuationPolicyCommand): Promise<InventoryValuationPolicySnapshot>;
  resolveMovement(command: ResolveInventoryMovementValuationCommand): Promise<InventoryValuationEntrySnapshot>;
  recalculate(command: RecalculateInventoryValuationCommand): Promise<InventoryValuationRecalculationResult>;
}

export interface InventoryValuationQueryService {
  getEntry(query: GetInventoryValuationEntryQuery): Promise<InventoryValuationEntrySnapshot | null>;
  listUnresolved(query: ListInventoryUnresolvedValuationsQuery): Promise<readonly InventoryValuationEntrySnapshot[]>;
  getPolicyHistory(query: GetInventoryValuationPolicyHistoryQuery): Promise<readonly InventoryValuationPolicySnapshot[]>;
  getState(reference: InventoryValuationStateReference): Promise<InventoryValuationStateSnapshot | null>;
}
