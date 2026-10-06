import type { DatabaseExecutor, DatabaseSession } from "@argin/database";
import type { PartyRole, PartySelectorDto } from "@argin/party";
import {
  SecuredSalesMutationService,
  createSalesCustomerSnapshot,
  createSalesInvoice,
  createSalesOrder,
  createSalesReturn,
  createSalesCorrection,
  createSalesIdempotencyRecord,
  createSalesLifecycle,
  createSalesMutationContext,
  decideSalesReplay,
  replaySalesResult,
  salesPermissions,
  type SalesAuditEvent,
  type SalesDocumentSnapshot,
  type SalesDocumentType,
  type SalesPersistedDocument,
} from "@argin/sales";
import { SqliteSalesDocumentRepository, SqliteSalesIdempotencyRepository } from "@argin/sales-tauri";

export interface SalesDesktopActor {
  readonly id: string;
  readonly displayName: string;
  readonly permissions: readonly string[];
  readonly branchIds: readonly string[];
}

export interface SalesDraftLineInput {
  readonly productId: string;
  readonly sourceLineId?: string;
  readonly lineId?: string;
  readonly preserveAdjustments?: boolean;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly discountRateBasisPoints: number;
  readonly taxRateBasisPoints: number;
}

export interface SalesDraftInput {
  readonly submissionId: string;
  readonly companyId: string;
  readonly branchId: string;
  readonly fiscalYearId: string;
  readonly documentType: SalesDocumentType;
  readonly customerId: string;
  readonly businessDate: string;
  readonly description: string;
  readonly relatedDocumentId: string;
  readonly lines: readonly SalesDraftLineInput[];
}

export interface SalesDraftPorts {
  validateScope(session: DatabaseSession, input: Pick<SalesDraftInput, "companyId" | "branchId" | "fiscalYearId" | "businessDate">): Promise<void>;
  getCustomer(session: DatabaseSession, companyId: string, customerId: string): Promise<{
    id: string; companyId: string; code: string; displayName: string; status: string; roles: readonly PartyRole[]; classification: PartySelectorDto["classification"];
  } | null>;
  getProduct(session: DatabaseSession, companyId: string, productId: string): Promise<{
    productId: string; companyId: string; title: string; kind: "product" | "service";
    status: string; sellable: boolean; stockTracking: boolean;
  } | null>;
  recordAudit(session: DatabaseSession, event: SalesAuditEvent, actor: SalesDesktopActor, fiscalYearId: string): Promise<void>;
}

export async function createSalesDraft(
  database: DatabaseExecutor,
  actor: SalesDesktopActor,
  input: SalesDraftInput,
  ports: SalesDraftPorts,
): Promise<SalesDocumentSnapshot> {
  const authorization = {
    async require() {
      const fullAccess = actor.permissions.includes("system.full-access");
      if (!actor.id || (!fullAccess && (
        !actor.permissions.includes(salesPermissions.create) || !actor.branchIds.includes(input.branchId)
      ))) throw new Error("مجوز ایجاد سند فروش در این شعبه را ندارید.");
    },
  };
  await authorization.require();

  const occurredAt = new Date().toISOString();
  const mutation = createSalesMutationContext({
    companyId: input.companyId,
    branchId: input.branchId,
    requestId: input.submissionId,
    operationId: input.submissionId,
    operation: "sales.document.create",
    payloadFingerprint: JSON.stringify({ actorId: actor.id, ...input }),
    actorUserId: actor.id,
    occurredAt,
  });

  return database.transaction(async (session) => {
    const documents = new SqliteSalesDocumentRepository(session);
    const idempotency = new SqliteSalesIdempotencyRepository(session);
    const replay = await decideSalesReplay(idempotency, mutation);
    if (replay.kind === "replay") return replaySalesResult<SalesPersistedDocument>(replay.record).document;

    const document = await prepareSalesDraft(session, input, ports, undefined, occurredAt);
    const state: SalesPersistedDocument = {
      document,
      lifecycle: createSalesLifecycle(document.documentId, document.documentType),
      version: 1,
      createdAt: occurredAt,
      updatedAt: occurredAt,
    };
    const secured = new SecuredSalesMutationService({
      authorization,
      audit: { record: (event) => ports.recordAudit(session, event, actor, input.fiscalYearId) },
    });
    await secured.execute({
      security: { actorId: actor.id, actorDisplayName: actor.displayName },
      mutation,
      permission: salesPermissions.create,
      action: "sales.document.create",
      documentId: document.documentId,
      execute: async () => {
        await documents.add(state);
        await idempotency.add(createSalesIdempotencyRecord({
          context: mutation,
          outcomeKind: "sales-document",
          outcomeId: document.documentId,
          outcomeVersion: state.version,
          outcomeStatus: state.lifecycle.status,
          resultJson: JSON.stringify(state),
          recordedAt: occurredAt,
        }));
        return state;
      },
    });
    return document;
  });
}

/** Build a validated snapshot without writing, shared by create and edit. */
export async function prepareSalesDraft(
  session: DatabaseSession,
  input: SalesDraftInput,
  ports: SalesDraftPorts,
  previous?: SalesDocumentSnapshot,
  occurredAt = new Date().toISOString(),
): Promise<SalesDocumentSnapshot> {
  const documents = new SqliteSalesDocumentRepository(session);
  await ports.validateScope(session, input);
  if (!input.lines.length) throw new Error("حداقل یک ردیف کالا یا خدمت اضافه کنید.");

  const customer = await ports.getCustomer(session, input.companyId, input.customerId);
  if (!customer || customer.id !== input.customerId || customer.companyId !== input.companyId ||
      customer.status !== "active" || !customer.roles.includes("customer")) {
    throw new Error("یک مشتری فعال از شرکت جاری انتخاب کنید.");
  }

  const needsReference = input.documentType === "sales-return" || input.documentType === "sales-correction";
  const original = needsReference ? await documents.findById(input.companyId, input.relatedDocumentId) : null;
  if (needsReference) {
    if (!original || original.document.documentType !== "sales-invoice" ||
        original.lifecycle.status !== "finalized" || original.document.scope.branchId !== input.branchId ||
        original.document.customer.partyId !== input.customerId) {
      throw new Error("برای برگشت یا اصلاح، فاکتور فروش قطعیِ همین مشتری و شعبه را انتخاب کنید.");
    }
    if (!input.description.trim()) throw new Error("علت برگشت یا اصلاح را در توضیحات وارد کنید.");
  }

  const lines = [];
  for (const [index, line] of input.lines.entries()) {
    const product = await ports.getProduct(session, input.companyId, line.productId);
    if (!product || product.productId !== line.productId || product.companyId !== input.companyId ||
        product.status !== "active" || !product.sellable) {
      throw new Error(`کالا یا خدمت ردیف ${index + 1} فعال یا قابل فروش نیست.`);
    }
    const sourceLine = original?.document.lines.find(value => value.lineId === line.sourceLineId);
    if (needsReference && (!sourceLine || sourceLine.item.productId !== line.productId)) {
      throw new Error(`ردیف ${index + 1} باید به ردیف متناظر فاکتور اصلی مرتبط باشد.`);
    }
    const previousLine = line.lineId ? previous?.lines.find(value => value.lineId === line.lineId) : undefined;
    if (line.lineId && !previousLine) throw new Error("شناسهٔ ردیف برای این سند معتبر نیست.");
    const sameItem = previousLine?.item.productId === line.productId ? previousLine : undefined;
    const sourceTerms = sourceLine?.commercialTerms ?? (line.preserveAdjustments ? sameItem?.commercialTerms : null);
    if (sourceLine && !sourceTerms) throw new Error("اطلاعات تجاری ردیف فاکتور اصلی کامل نیست.");
    const previousTerms = sameItem?.commercialTerms;
    const keepPriceOrigin = previousTerms && previousTerms.unitPrice === line.unitPrice;
    lines.push({
      lineId: previousLine?.lineId ?? crypto.randomUUID(),
      position: index + 1,
      productId: product.productId,
      itemType: product.kind,
      lineKind: sameItem?.lineKind ?? sourceLine?.lineKind ?? (product.kind === "service" ? "service" as const
        : product.stockTracking ? "stock-product" as const : "non-stock-product" as const),
      sourceReference: sourceLine && original ? { sourceSystem: "sales", sourceDocumentId: original.document.documentId, sourceLineId: sourceLine.lineId } : sameItem?.sourceReference ?? null,
      description: sameItem?.description ?? product.title,
      commercialTerms: {
        quantity: line.quantity,
        currency: sameItem?.commercialTerms?.currency ?? sourceTerms?.currency ?? "IRR",
        unitPrice: line.unitPrice,
        priceOrigin: keepPriceOrigin ? previousTerms.priceOrigin : "manual" as const,
        priceListId: keepPriceOrigin ? previousTerms.priceListId : null,
        priceListItemId: keepPriceOrigin ? previousTerms.priceListItemId : null,
        priceRevisionId: keepPriceOrigin ? previousTerms.priceRevisionId : null,
        priceRevision: keepPriceOrigin ? previousTerms.priceRevision : null,
        discounts: sourceTerms
          ? sourceTerms.discounts.map(discount => ({ id: discount.discountId, mode: discount.mode, value: discount.value, reason: discount.reason }))
          : [{
            id: previousTerms?.discounts[0]?.discountId ?? crypto.randomUUID(),
            mode: "percent" as const,
            value: line.discountRateBasisPoints,
            reason: previousTerms?.discounts[0]?.reason ?? null,
          }],
        charges: (sourceTerms ?? sameItem?.commercialTerms)?.charges.map(charge => ({ id: charge.chargeId, mode: charge.mode, value: charge.value, reason: charge.reason })),
        taxes: sourceTerms?.taxes ?? [{
          taxId: previousTerms?.taxes[0]?.taxId ?? crypto.randomUUID(),
          rateBasisPoints: line.taxRateBasisPoints,
          taxCode: previousTerms?.taxes[0]?.taxCode ?? null,
        }],
      },
    });
  }

  const documentInput = {
    ...input,
    documentId: previous?.documentId ?? crypto.randomUUID(),
    documentNumber: previous?.documentNumber ?? null,
    sourceReference: previous?.sourceReference ?? null,
    customer: createSalesCustomerSnapshot({ partyId: customer.id, code: customer.code, displayName: customer.displayName, roles: customer.roles, classification: customer.classification }),
    relatedDocumentReference: needsReference
      ? { documentId: input.relatedDocumentId, relationType: "sales-invoice" }
      : previous?.relatedDocumentReference ?? null,
    lines,
    capturedAt: occurredAt,
  };
  const creators = {
    "sales-order": createSalesOrder,
    "sales-invoice": createSalesInvoice,
    "sales-return": createSalesReturn,
    "sales-correction": createSalesCorrection,
  };
  const create = creators[input.documentType];
  if (!create) throw new Error("نوع سند فروش معتبر نیست.");
  const { document } = create(documentInput);
  return document;
}
