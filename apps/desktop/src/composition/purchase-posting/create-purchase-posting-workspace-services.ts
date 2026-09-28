import type { DatabaseExecutor } from "@argin/database";
import {
  createPurchaseFulfillmentAccountingPolicy,
  createPurchasePosting,
  createPurchasePostingFact,
  createPurchasePostingSourceIdentityFromFact,
  createPurchasePostingTraceContext,
  evaluateSupplierInvoiceAccountingEligibility,
  orchestrateSupplierInvoicePosting,
  purchasePostingPermissions,
  type PurchasePostingReconciliationSnapshot,
  type PurchasePostingSourceIdentity,
  type SupplierInvoicePostingOrchestrationResult,
} from "@argin/purchase-posting";
import {
  calculatePurchaseDocumentTotals,
  calculatePurchaseLineTotals,
  calculatePurchaseMatchingStatus,
  createPurchaseCommercialTerms,
  type PurchaseCommercialTerms,
} from "@argin/purchase";
import {
  SqlitePurchasePostingReconciliationReader,
  SqlitePurchasePostingReplayUnitOfWork,
  SqlitePurchasePostingUnitOfWork,
} from "@argin/purchase-posting-tauri";

export interface PurchasePostingWorkspaceActor {
  readonly permissions: readonly string[];
  readonly branchIds: readonly string[];
}

export interface PurchasePostingWorkspaceServices {
  readonly canView: boolean;
  readonly canTrace: boolean;
  readonly canExecute: boolean;
  readonly canReverse: boolean;
  findBySource(input: {
    readonly companyId: string;
    readonly branchId: string;
    readonly sourceType: PurchasePostingSourceIdentity["sourceType"];
    readonly sourceId: string;
  }): Promise<readonly PurchasePostingReconciliationSnapshot[]>;
  findByPostingId(
    companyId: string,
    postingId: string,
  ): Promise<PurchasePostingReconciliationSnapshot | null>;
  executeSupplierInvoice(input: {
    readonly companyId: string;
    readonly branchId: string;
    readonly sourceId: string;
  }): Promise<SupplierInvoicePostingOrchestrationResult>;
}


type PurchaseDocumentRow = {
  id: string;
  company_id: string;
  branch_id: string;
  fiscal_year_id: string;
  fiscal_period_id: string;
  document_type: "supplier-invoice" | string;
  status: string;
  document_number: string | null;
  business_date: string;
  version: number;
  supplier_snapshot_json: string;
};

type PurchaseLineRow = {
  id: string;
  position: number;
  line_kind: "stock-product" | "non-stock-product" | "service";
  item_id: string;
  item_snapshot_json: string;
  commercial_terms_json: string;
};

type ValuationRow = {
  valuation_entry_id: string;
  movement_id: string;
  document_id: string;
  line_id: string;
  product_id: string;
  warehouse_id: string;
  method: "fifo" | "moving_average";
  strategy_version: number;
  currency: string;
  quantity: string;
  unit_cost: string;
  total_cost: number;
  policy_id: string | null;
};

const parse = <T>(value: string, field: string): T => {
  try { return JSON.parse(value) as T; }
  catch { throw new Error("داده ذخیره‌شده برای " + field + " معتبر نیست."); }
};

const postingIdFor = (sourceId: string, version: number) =>
  `purchase-posting:${sourceId}:v${version}`;
const journalIdFor = (sourceId: string, version: number) =>
  `purchase-journal:${sourceId}:v${version}`;

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export function createPurchasePostingWorkspaceServices(input: {
  readonly database: DatabaseExecutor;
  readonly actor: PurchasePostingWorkspaceActor;
}): PurchasePostingWorkspaceServices {
  const permissions = new Set(input.actor.permissions);
  const branchIds = new Set(input.actor.branchIds);
  const reader = new SqlitePurchasePostingReconciliationReader(input.database);
  const replayUow = new SqlitePurchasePostingReplayUnitOfWork(input.database);

  const can = (permission: string) =>
    permissions.has("system.full-access") || permissions.has(permission);

  const requireBranch = (branchId: string) => {
    if (
      !permissions.has("system.full-access")
      && !branchIds.has(branchId)
    ) {
      throw new Error("برای مشاهده ثبت حسابداری این شعبه مجوز ندارید.");
    }
  };

  return Object.freeze<PurchasePostingWorkspaceServices>({
    canView: can(purchasePostingPermissions.view),
    canTrace: can(purchasePostingPermissions.viewTrace),
    canExecute: can(purchasePostingPermissions.execute),
    canReverse: can(purchasePostingPermissions.reverse),

    async findBySource({ companyId, branchId, sourceType, sourceId }) {
      if (!can(purchasePostingPermissions.view)) {
        throw new Error("برای مشاهده ثبت حسابداری خرید مجوز ندارید.");
      }
      requireBranch(branchId);
      const rows = await reader.findBySource(companyId, sourceType, sourceId);
      return Object.freeze(rows.filter(row => row.source.branchId === branchId));
    },

    async findByPostingId(companyId, postingId) {
      if (!can(purchasePostingPermissions.viewTrace)) {
        throw new Error("برای مشاهده مسیر ردیابی ثبت حسابداری مجوز ندارید.");
      }
      const row = await reader.findByPostingId(companyId, postingId);
      if (row) requireBranch(row.source.branchId);
      return row;
    },
    async executeSupplierInvoice({ companyId, branchId, sourceId }) {
      if (!can(purchasePostingPermissions.execute)) {
        throw new Error("برای ایجاد ثبت حسابداری خرید مجوز ندارید.");
      }
      requireBranch(branchId);

      const document = await input.database.queryOne<PurchaseDocumentRow>(
        `SELECT id,company_id,branch_id,fiscal_year_id,fiscal_period_id,document_type,status,
                document_number,business_date,version,supplier_snapshot_json
           FROM purchase_documents
          WHERE company_id=? AND id=?`,
        [companyId, sourceId],
      );
      if (!document || document.branch_id !== branchId) {
        throw new Error("فاکتور تأمین‌کننده در شعبه فعال یافت نشد.");
      }
      if (document.document_type !== "supplier-invoice" || document.status !== "confirmed") {
        throw new Error("ثبت خودکار فقط برای فاکتور تأمین‌کننده قطعی قابل اجرا است.");
      }

      const lines = await input.database.query<PurchaseLineRow>(
        `SELECT l.id,l.position,l.line_kind,l.item_id,l.item_snapshot_json,
                f.commercial_terms_json
           FROM purchase_document_lines l
           JOIN purchase_commercial_facts f
             ON f.company_id=l.company_id
            AND f.purchase_document_id=l.document_id
            AND f.purchase_line_id=l.id
          WHERE l.company_id=? AND l.document_id=?
          ORDER BY l.position,l.id`,
        [companyId, sourceId],
      );
      if (!lines.length) throw new Error("فاکتور فاقد ردیف تجاری معتبر است.");

      const postingLines = [];
      const eligibilityLines = [];
      const totalsByLine = [];

      for (const line of lines) {
        const persisted = parse<PurchaseCommercialTerms>(line.commercial_terms_json, "شرایط تجاری خرید");
        const terms = createPurchaseCommercialTerms({
          enteredQuantity: persisted.quantity.enteredQuantity,
          enteredUnit: persisted.quantity.enteredUnit,
          baseUnit: persisted.quantity.baseUnit,
          unitPrice: persisted.unitPrice,
          discounts: persisted.discounts,
          charges: persisted.charges,
          tax: persisted.tax,
        });
        const lineTotals = calculatePurchaseLineTotals(terms);
        totalsByLine.push(lineTotals);

        const item = parse<any>(line.item_snapshot_json, "تصویر کالا/خدمت");
        let fulfillmentState: "not-required" | "not-received" | "partially-received" | "fully-received" = "not-required";
        let valuations: ValuationRow[] = [];

        if (line.line_kind === "stock-product") {
          const matches = await input.database.query<{ matched_base_quantity: string }>(
            `SELECT matched_base_quantity
               FROM purchase_receipt_invoice_matches
              WHERE company_id=? AND invoice_document_id=? AND invoice_line_id=?
              ORDER BY match_id`,
            [companyId, sourceId, line.id],
          );
          const matching = calculatePurchaseMatchingStatus(
            terms.quantity.baseQuantity,
            matches.map(value => value.matched_base_quantity),
          );
          fulfillmentState =
            matching.status === "fully-matched" ? "fully-received"
              : matching.status === "partially-matched" ? "partially-received"
                : "not-received";

          valuations = await input.database.query<ValuationRow>(
            `SELECT v.valuation_entry_id,v.movement_id,v.document_id,v.line_id,v.product_id,
                    v.warehouse_id,v.method,v.strategy_version,v.currency,v.quantity,v.unit_cost,
                    v.total_cost,
                    (SELECT p.policy_id
                       FROM inventory_valuation_policies p
                      WHERE p.company_id=v.company_id
                        AND p.method=v.method
                        AND p.strategy_version=v.strategy_version
                        AND p.effective_from<=v.business_date
                      ORDER BY p.effective_from DESC,p.revision DESC
                      LIMIT 1) AS policy_id
               FROM purchase_receipt_invoice_matches m
               JOIN inventory_valuation_entries v
                 ON v.company_id=m.company_id
                AND v.document_id=m.receipt_document_id
                AND v.line_id=m.receipt_line_id
              WHERE m.company_id=?
                AND m.invoice_document_id=?
                AND m.invoice_line_id=?
                AND v.cost_state='resolved'
              ORDER BY v.business_date,v.business_order,v.valuation_entry_id`,
            [companyId, sourceId, line.id],
          );
        }

        eligibilityLines.push({
          purchaseLineId: line.id,
          lineKind: line.line_kind,
          fulfillmentState,
        });

        postingLines.push({
          purchaseLineId: line.id,
          position: line.position,
          lineKind: line.line_kind,
          item: {
            itemId: line.item_id,
            itemType: item.itemType,
            code: item.code,
            displayName: item.displayName,
            taxpayerGoodsServiceId: item.taxpayerGoodsServiceId ?? null,
            stockTracking: Boolean(item.stockTracking),
          },
          baseQuantity: terms.quantity.baseQuantity,
          amounts: {
            currency: lineTotals.currency,
            grossAmount: lineTotals.grossAmount,
            discountAmount: lineTotals.discountAmount,
            netAfterDiscount: lineTotals.netAfterDiscount,
            chargeAmount: lineTotals.chargeAmount,
            taxBaseAmount: lineTotals.taxBaseAmount,
            taxAmount: lineTotals.taxAmount,
            grandTotal: lineTotals.grandTotal,
          },
          valuations: valuations.map(value => {
            if (!value.policy_id || value.total_cost == null || value.unit_cost == null) {
              throw new Error("ارزش‌گذاری قطعی یکی از رسیدهای خرید کامل نشده است.");
            }
            return {
              companyId,
              valuationEntryId: value.valuation_entry_id,
              movementId: value.movement_id,
              inventoryDocumentId: value.document_id,
              inventoryLineId: value.line_id,
              productId: value.product_id,
              warehouseId: value.warehouse_id,
              policyId: value.policy_id,
              method: value.method,
              strategyVersion: value.strategy_version,
              currency: value.currency,
              quantity: value.quantity.replace(/^-/, ""),
              unitCost: value.unit_cost,
              totalCost: value.total_cost,
            };
          }),
        });
      }

      const total = calculatePurchaseDocumentTotals(totalsByLine);
      const capturedAt = new Date().toISOString();
      const fact = createPurchasePostingFact({
        factId: `purchase-fact:${sourceId}:v${document.version}`,
        companyId,
        branchId,
        fiscalYearId: document.fiscal_year_id,
        fiscalPeriodId: document.fiscal_period_id,
        purchaseDocumentId: sourceId,
        purchaseDocumentVersion: document.version,
        documentType: "supplier-invoice",
        sourceStatus: "confirmed",
        documentNumber: document.document_number,
        businessDate: document.business_date,
        supplier: parse<any>(document.supplier_snapshot_json, "تصویر تأمین‌کننده"),
        lines: postingLines,
        totals: {
          currency: total.currency,
          grossAmount: total.grossAmount,
          discountAmount: total.discountAmount,
          netAfterDiscount: total.netAfterDiscount,
          chargeAmount: total.chargeAmount,
          taxBaseAmount: total.taxBaseAmount,
          taxAmount: total.taxAmount,
          grandTotal: total.grandTotal,
        },
        capturedAt,
      });

      const policy = createPurchaseFulfillmentAccountingPolicy("automatic");
      const eligibility = evaluateSupplierInvoiceAccountingEligibility({
        sourceStatus: "confirmed",
        policy,
        lines: eligibilityLines,
      });
      if (eligibility.status === "blocked") {
        throw new Error(
          eligibility.reasonCode === "stock_receipt_missing"
            ? "برای ثبت حسابداری، رسید قطعی کالای انباری هنوز ثبت نشده است."
            : eligibility.reasonCode === "stock_receipt_partial"
              ? "برای ثبت حسابداری، دریافت کالای انباری هنوز کامل نشده است."
              : "فاکتور هنوز شرایط ثبت حسابداری را ندارد.",
        );
      }

      const dimensionTypes = await input.database.query<{ id: string; code: string }>(
        "SELECT id,code FROM accounting_dimension_types WHERE company_id=? AND status='active'",
        [companyId],
      );
      const dimensionTypeId = (code: string) =>
        dimensionTypes.find(value => value.code.toUpperCase() === code)?.id;
      const partyDimensionId = dimensionTypeId("PARTY");
      const productDimensionId = dimensionTypeId("PRODUCT");
      const warehouseDimensionId = dimensionTypeId("WAREHOUSE");
      const costCenterDimensionId = dimensionTypeId("COST_CENTER");
      const projectDimensionId = dimensionTypeId("PROJECT");
      const scopedPostingUow = new SqlitePurchasePostingUnitOfWork(input.database, Object.freeze({
        ...(partyDimensionId ? { party: partyDimensionId } : {}),
        ...(productDimensionId ? { product: productDimensionId } : {}),
        ...(warehouseDimensionId ? { warehouse: warehouseDimensionId } : {}),
        ...(costCenterDimensionId ? { "cost-center": costCenterDimensionId } : {}),
        ...(projectDimensionId ? { project: projectDimensionId } : {}),
      }));

      const source = createPurchasePostingSourceIdentityFromFact(fact);
      const postingId = postingIdFor(sourceId, document.version);
      const voucherId = journalIdFor(sourceId, document.version);
      const requestId = `purchase-post:${sourceId}:v${document.version}`;
      const trace = createPurchasePostingTraceContext({
        requestId,
        operationId: requestId + ":operation",
        correlationId: requestId + ":correlation",
      });

      const payloadFingerprint = await sha256Hex(JSON.stringify({
        source,
        totals: fact.totals,
        lines: fact.lines.map(line => ({
          id: line.purchaseLineId,
          quantity: line.baseQuantity,
          amount: line.amounts.grandTotal,
          valuations: line.valuations.map(value => [value.valuationEntryId, value.totalCost]),
        })),
      }));

      return orchestrateSupplierInvoicePosting({
        fact,
        source,
        trace,
        eligibility,
        postingMode: "automatic",
        taxRecoverability: "recoverable",
        taxPolicyId: "purchase-vat-default-recoverable",
        payloadFingerprint,
        occurredAt: capturedAt,
        journal: {
          voucherId,
          voucherNumber: `PUR-${document.document_number ?? sourceId}-V${document.version}`,
          lineIds: [],
          createdAt: capturedAt,
          reference: document.document_number,
          description: `ثبت حسابداری خودکار خرید ${document.document_number ?? sourceId}`,
        },
      }, {
        posting: {
          async loadOrCreate() {
            return scopedPostingUow.execute(async context => {
              const existing = await context.postings.findById(postingId);
              if (existing) return existing;
              const created = createPurchasePosting({
                postingId,
                companyId,
                branchId,
                createdAt: capturedAt,
              });
              await context.postings.add(created);
              return created;
            });
          },
        },
        rules: {
          listActive: targetCompanyId =>
            scopedPostingUow.execute(context => context.rules.listActive(targetCompanyId)),
        },
        accounts: {
          findById: (targetCompanyId, accountId) =>
            scopedPostingUow.execute(context => context.accounts.findById(targetCompanyId, accountId)),
        },
        dimensions: {
          findPoliciesForAccount: (targetCompanyId, accountId) =>
            scopedPostingUow.execute(context => context.dimensions.findPoliciesForAccount(targetCompanyId, accountId)),
          findTypesByCompanyId: targetCompanyId =>
            scopedPostingUow.execute(context => context.dimensions.findTypesByCompanyId(targetCompanyId)),
          resolveMemberBySource: (targetCompanyId, sourceKind, sourceReferenceId) =>
            scopedPostingUow.execute(context => context.dimensions.resolveMemberBySource(targetCompanyId, sourceKind, sourceReferenceId)),
          findMembersByIds: ids =>
            scopedPostingUow.execute(context => context.dimensions.findMembersByIds(ids)),
        },
        unitOfWork: replayUow,
      });
    },
  });
}
