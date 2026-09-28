import type { JournalVoucher } from "@argin/accounting/journal";

import {
  createPurchaseChargePostingPlan,
} from "../domain/purchase-charge-posting.ts";
import {
  createSupplierInvoiceDraftComponents,
  createPurchasePostingDraftJournal,
} from "../domain/draft-journal-generation.ts";
import {
  resolveSupplierInvoiceInventoryValuation,
} from "../domain/inventory-valuation-integration.ts";
import {
  createSupplierInvoicePostingPlan,
} from "../domain/supplier-invoice-posting.ts";
import {
  createPurchaseTaxPostingPlan,
} from "../domain/purchase-tax-posting.ts";
import type {
  PurchaseTaxRecoverability,
} from "../domain/purchase-tax-posting.ts";
import type {
  PurchasePostingFactSnapshot,
} from "../domain/purchase-posting-facts.ts";
import type {
  PurchasePostingAggregate,
} from "../domain/purchase-posting.ts";
import type {
  PurchasePostingAccountReader,
  PurchasePostingRule,
} from "../domain/purchase-posting-rules.ts";
import type {
  PurchasePostingDimensionContext,
  PurchasePostingDimensionReader,
} from "../domain/purchase-posting-dimensions.ts";
import type {
  PurchasePostingSourceIdentity,
  PurchasePostingTraceContext,
} from "../domain/purchase-posting-source-reference.ts";
import type {
  PurchaseAccountingEligibilityResult,
  PurchasePostingMode,
} from "../domain/purchase-fulfillment-accounting-policy.ts";
import {
  commitPurchasePostingReplaySafe,
} from "./replay-safe-posting.ts";
import type {
  PurchasePostingReplayUnitOfWork,
  ReplaySafePurchasePostingResult,
} from "./replay-safe-posting.ts";

export const PURCHASE_POSTING_ORCHESTRATION_STATUSES = Object.freeze([
  "blocked",
  "awaiting-accountant-approval",
  "journal-created",
] as const);

export type PurchasePostingOrchestrationStatus =
  (typeof PURCHASE_POSTING_ORCHESTRATION_STATUSES)[number];

export interface PurchasePostingJournalIdentity {
  readonly voucherId: string;
  readonly voucherNumber: string;
  readonly lineIds: readonly string[];
  readonly createdAt: string;
  readonly reference?: string | null;
  readonly description?: string | null;
}

export interface OrchestrateSupplierInvoicePostingInput {
  readonly fact: PurchasePostingFactSnapshot;
  readonly source: PurchasePostingSourceIdentity;
  readonly trace: PurchasePostingTraceContext;
  readonly eligibility: PurchaseAccountingEligibilityResult;
  readonly postingMode: PurchasePostingMode;
  readonly taxRecoverability: PurchaseTaxRecoverability;
  readonly taxPolicyId: string;
  readonly payloadFingerprint: string;
  readonly occurredAt: string;
  readonly journal: PurchasePostingJournalIdentity;
  readonly dimensionContext?: PurchasePostingDimensionContext | null;
}

export interface SupplierInvoicePostingOrchestratorDependencies {
  readonly posting: {
    loadOrCreate(input: {
      readonly fact: PurchasePostingFactSnapshot;
      readonly source: PurchasePostingSourceIdentity;
      readonly occurredAt: string;
    }): Promise<PurchasePostingAggregate>;
  };
  readonly rules: {
    listActive(companyId: string): Promise<readonly PurchasePostingRule[]>;
  };
  readonly accounts: PurchasePostingAccountReader;
  readonly dimensions: PurchasePostingDimensionReader;
  readonly unitOfWork: PurchasePostingReplayUnitOfWork;
}

export interface SupplierInvoicePostingOrchestrationResult {
  readonly status: PurchasePostingOrchestrationStatus;
  readonly eligibility: PurchaseAccountingEligibilityResult;
  readonly posting: PurchasePostingAggregate | null;
  readonly journal: JournalVoucher | null;
  readonly replayed: boolean;
}

function assertReady(input: OrchestrateSupplierInvoicePostingInput): PurchasePostingOrchestrationStatus | null {
  if (input.fact.documentType !== "supplier-invoice" || input.fact.sourceStatus !== "confirmed") {
    throw new TypeError("purchase_posting.orchestrator.invalid_supplier_invoice");
  }
  if (input.postingMode === "accountant-approval") {
    if (input.eligibility.status === "blocked") return "blocked";
    return "awaiting-accountant-approval";
  }
  if (input.eligibility.status === "blocked") return "blocked";
  if (input.eligibility.status !== "ready-for-automatic-posting") {
    throw new TypeError("purchase_posting.orchestrator.eligibility_mismatch");
  }
  return null;
}

export async function orchestrateSupplierInvoicePosting(
  input: OrchestrateSupplierInvoicePostingInput,
  deps: SupplierInvoicePostingOrchestratorDependencies,
): Promise<SupplierInvoicePostingOrchestrationResult> {
  const deferred = assertReady(input);
  if (deferred !== null) {
    return Object.freeze({
      status: deferred,
      eligibility: input.eligibility,
      posting: null,
      journal: null,
      replayed: false,
    });
  }

  const posting = await deps.posting.loadOrCreate({
    fact: input.fact,
    source: input.source,
    occurredAt: input.occurredAt,
  });

  const basePlan = createSupplierInvoicePostingPlan(input.fact);
  const valuedPlan = resolveSupplierInvoiceInventoryValuation(input.fact, basePlan);
  const taxPlan = createPurchaseTaxPostingPlan(input.fact, {
    policyId: input.taxPolicyId,
    companyId: input.fact.companyId,
    recoverability: input.taxRecoverability,
  });
  const chargePlan = createPurchaseChargePostingPlan(input.fact);
  const components = createSupplierInvoiceDraftComponents(
    valuedPlan,
    taxPlan,
    chargePlan,
  );
  const rules = await deps.rules.listActive(input.fact.companyId);

  const journalLineIds =
    input.journal.lineIds.length === 0
      ? Object.freeze(components.map((_, index) => `${input.journal.voucherId}:line:${index + 1}`))
      : input.journal.lineIds;

  const journal = await createPurchasePostingDraftJournal({
    fact: input.fact,
    eventKind: "supplier-invoice-recognition",
    components,
    rules,
    accounts: deps.accounts,
    dimensions: deps.dimensions,
    dimensionContext: input.dimensionContext ?? null,
    trace: input.trace,
    journal: {
      ...input.journal,
      lineIds: journalLineIds,
    },
  });

  const committed: ReplaySafePurchasePostingResult =
    await commitPurchasePostingReplaySafe({
      posting,
      journal,
      source: input.source,
      purpose: "accounting-recognition",
      payloadFingerprint: input.payloadFingerprint,
      expectedPostingVersion: posting.version,
      occurredAt: input.occurredAt,
    }, deps.unitOfWork);

  return Object.freeze({
    status: "journal-created",
    eligibility: input.eligibility,
    posting: committed.posting,
    journal: committed.journal,
    replayed: committed.replayed,
  });
}
