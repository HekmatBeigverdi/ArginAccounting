import type { DatabaseExecutor, DatabaseSession } from "@argin/database";
import {
  SalesDomainError, SecuredSalesMutationService, assertSalesExpectedVersion,
  createSalesIdempotencyRecord, createSalesMutationContext, decideSalesReplay,
  replaySalesResult, salesPermissions, transitionSalesLifecycle,
  calculateSalesDocumentTotals, calculateSalesLineTotals, createSalesCommercialSnapshot, BelowCostSalesGuardService,
  InventorySalesIssueGateway, InventorySalesReturnReceiptGateway,
  type SalesInvoice, type SalesReturn, type SalesLifecycleAction, type SalesPermission, type SalesPersistedDocument, type BelowCostLineRouting,
} from "@argin/sales";
import {
  SqliteSalesDocumentRepository, SqliteSalesIdempotencyRepository,
  SqliteBelowCostSalesPolicyRepository, SqliteBelowCostSalesDecisionRepository, SqliteSalesInventoryCostQuotePort,
  ensureSalesNumberSeries, SALES_NUMBER_SERIES_TYPES,
} from "@argin/sales-tauri";
import {
  InventoryDraftService, createInventoryDocumentLine, createInventoryLineOperation,
  type InventorySourceDocumentPort,
} from "@argin/inventory";
import { SqliteInventoryUnitOfWork } from "@argin/inventory-tauri";
import { generateDocumentNumber } from "@argin/fiscal";
import { SqliteFiscalUnitOfWork } from "@argin/fiscal-tauri";
import { SqliteProductReader } from "@argin/product-tauri";
import { SqliteWarehouseReader } from "@argin/warehouse-tauri";
import { prepareSalesDraft, type SalesDesktopActor, type SalesDraftInput, type SalesDraftPorts } from "./create-sales-draft.ts";

export interface SalesDocumentMutationInput {
  companyId: string;
  branchId: string;
  fiscalYearId: string;
  documentId: string;
  expectedVersion: number;
  submissionId: string;
  reason?: string;
}
export type SalesDraftEditInput = SalesDraftInput & SalesDocumentMutationInput;
export type SalesTransitionInput = SalesDocumentMutationInput & {
  action: SalesLifecycleAction;
  stockRouting?: readonly BelowCostLineRouting[];
  acknowledgeBelowCostWarning?: boolean;
  belowCostApprovalReason?: string | null;
};


function sessionExecutor(session: DatabaseSession): DatabaseExecutor {
  return {
    execute: (sql, parameters) => session.execute(sql, parameters),
    query: <T>(sql: string, parameters?: readonly import("@argin/database").DatabaseValue[]) => session.query<T>(sql, parameters),
    queryOne: <T>(sql: string, parameters?: readonly import("@argin/database").DatabaseValue[]) => session.queryOne<T>(sql, parameters),
    transaction: <T>(operation: (transaction: DatabaseSession) => Promise<T>) => operation(session),
    close: async () => {},
  };
}

async function stageFinalizedSalesIssue(
  session: DatabaseSession,
  actor: SalesDesktopActor,
  before: SalesPersistedDocument,
  after: SalesPersistedDocument,
  input: SalesTransitionInput,
): Promise<void> {
  const document = after.document;
  const stockLines = document.lines.filter(line => line.lineKind === "stock-product");
  if (document.documentType !== "sales-invoice" || stockLines.length === 0) return;
  if (!actor.permissions.includes("system.full-access") && !actor.permissions.includes(salesPermissions.stageIssue)) {
    throw new Error("مجوز ایجاد حواله خروج مرتبط با فروش را ندارید.");
  }

  const routeMap = new Map((input.stockRouting ?? []).map(route => [route.salesLineId, route.warehouseId] as const));
  if (routeMap.size !== stockLines.length) throw new Error("برای همه کالاهای انبارشونده باید انبار خروج تعیین شود.");

  const products = new SqliteProductReader(session);
  const warehouses = new SqliteWarehouseReader(session);
  const lineRouting = [];
  for (const line of stockLines) {
    const warehouseId = routeMap.get(line.lineId);
    if (!warehouseId) throw new Error("انبار خروج یکی از ردیف‌های فروش مشخص نشده است.");
    const product = await products.getById({ companyId: document.scope.companyId, productId: line.item.productId });
    const warehouse = await warehouses.getById({ companyId: document.scope.companyId, warehouseId });
    if (!product?.units?.baseUnitId || !warehouse || warehouse.status !== "active") {
      throw new Error("کالا، واحد پایه یا انبار خروج برای ایجاد حواله معتبر نیست.");
    }
    lineRouting.push({
      salesLineId: line.lineId,
      unitId: product.units.baseUnitId,
      warehouse: { warehouseId, zoneId: null, locationId: null },
    });
  }

  const period = await session.queryOne<{ id: string }>(
    "SELECT id FROM fiscal_periods WHERE fiscal_year_id=? AND status='open' AND start_date<=? AND end_date>=? ORDER BY sequence LIMIT 1",
    [document.scope.fiscalYearId, document.businessDate, document.businessDate],
  );
  if (!period) throw new Error("برای تاریخ فاکتور فروش دوره مالی باز و معتبر یافت نشد.");

  const executor = sessionExecutor(session);
  const drafts = new InventoryDraftService(new SqliteInventoryUnitOfWork(executor));
  const inventoryPort: InventorySourceDocumentPort = {
    async stageDraft(request) {
      const lines = [];
      for (let index = 0; index < request.lines.length; index += 1) {
        const sourceLine = request.lines[index]!;
        const product = await products.getById({ companyId: request.companyId, productId: sourceLine.productId });
        const warehouse = await warehouses.getById({ companyId: request.companyId, warehouseId: sourceLine.warehouse.warehouseId });
        if (!product || !warehouse) throw new Error("وابستگی کالا یا انبار برای حواله خروج فروش معتبر نیست.");
        const operation = createInventoryLineOperation({
          companyId: request.companyId,
          productId: sourceLine.productId,
          product,
          enteredQuantity: sourceLine.enteredQuantity,
          unitId: sourceLine.unitId,
          warehouse: sourceLine.warehouse,
          resolvedWarehouse: { warehouse, zone: null, location: null },
          destination: null,
          resolvedDestination: null,
        });
        lines.push(createInventoryDocumentLine({
          lineId: crypto.randomUUID(),
          position: index + 1,
          productId: sourceLine.productId,
          operation,
          description: sourceLine.description,
          sourceReference: {
            companyId: request.companyId,
            sourceSystem: "sales",
            documentType: request.sourceDocumentType,
            documentId: request.sourceDocumentId,
            lineId: sourceLine.sourceLineId,
          },
        }));
      }
      const result = await drafts.create({
        companyId: request.companyId,
        requestKey: request.requestKey,
        payloadFingerprint: request.payloadFingerprint,
        document: {
          documentId: request.inventoryDocumentId,
          companyId: request.companyId,
          documentType: "issue",
          businessDate: request.businessDate,
          description: request.description,
          createdAt: after.updatedAt,
          scope: {
            branchId: document.scope.branchId,
            destinationBranchId: null,
            fiscalYearId: document.scope.fiscalYearId,
            fiscalPeriodId: period.id,
          },
          sourceReference: {
            companyId: request.companyId,
            sourceSystem: "sales",
            documentType: request.sourceDocumentType,
            documentId: request.sourceDocumentId,
            lineId: null,
          },
          lines,
        },
      });
      return { inventoryDocumentId: result.document.documentId, status: result.document.status, version: result.document.version };
    },
  };

  const commercialSnapshots = document.lines.map(line => createSalesCommercialSnapshot({
    snapshotId: document.documentId + ":" + line.lineId + ":commercial",
    line,
    capturedAt: after.updatedAt,
  }));
  const invoice: SalesInvoice = Object.freeze({
    document: document as SalesInvoice["document"],
    commercialSnapshots: Object.freeze(commercialSnapshots),
    totals: calculateSalesDocumentTotals(commercialSnapshots.map(snapshot => snapshot.totals)),
  });
  await new InventorySalesIssueGateway(inventoryPort).stage({
    invoice,
    lifecycle: after.lifecycle,
    inventoryDocumentId: crypto.randomUUID(),
    lineRouting,
    requestKey: "sales-issue:" + document.documentId,
    payloadFingerprint: JSON.stringify({
      sourceDocumentId: document.documentId,
      sourceVersion: before.version,
      routing: lineRouting.map(route => ({ lineId: route.salesLineId, warehouseId: route.warehouse.warehouseId, unitId: route.unitId })),
    }),
  });
}


async function stageFinalizedSalesReturnReceipt(
  session: DatabaseSession,
  actor: SalesDesktopActor,
  before: SalesPersistedDocument,
  after: SalesPersistedDocument,
  input: SalesTransitionInput,
): Promise<void> {
  const document = after.document;
  const stockLines = document.lines.filter(line => line.lineKind === "stock-product");
  if (document.documentType !== "sales-return" || stockLines.length === 0) return;
  if (!actor.permissions.includes("system.full-access") && !actor.permissions.includes(salesPermissions.stageReturnReceipt)) {
    throw new Error("مجوز ایجاد رسید انبار مرتبط با برگشت فروش را ندارید.");
  }

  const routeMap = new Map((input.stockRouting ?? []).map(route => [route.salesLineId, route.warehouseId] as const));
  if (routeMap.size !== stockLines.length) throw new Error("برای همه کالاهای برگشتی باید انبار دریافت تعیین شود.");

  const products = new SqliteProductReader(session);
  const warehouses = new SqliteWarehouseReader(session);
  const lineRouting = [];
  for (const line of stockLines) {
    const warehouseId = routeMap.get(line.lineId);
    if (!warehouseId) throw new Error("انبار دریافت یکی از ردیف‌های برگشت فروش مشخص نشده است.");
    const product = await products.getById({ companyId: document.scope.companyId, productId: line.item.productId });
    const warehouse = await warehouses.getById({ companyId: document.scope.companyId, warehouseId });
    if (!product?.units?.baseUnitId || !warehouse || warehouse.status !== "active") {
      throw new Error("کالا، واحد پایه یا انبار دریافت برای ایجاد رسید معتبر نیست.");
    }
    lineRouting.push({
      salesReturnLineId: line.lineId,
      unitId: product.units.baseUnitId,
      warehouse: { warehouseId, zoneId: null, locationId: null },
    });
  }

  const period = await session.queryOne<{ id: string }>(
    "SELECT id FROM fiscal_periods WHERE fiscal_year_id=? AND status='open' AND start_date<=? AND end_date>=? ORDER BY sequence LIMIT 1",
    [document.scope.fiscalYearId, document.businessDate, document.businessDate],
  );
  if (!period) throw new Error("برای تاریخ برگشت فروش دوره مالی باز و معتبر یافت نشد.");

  const executor = sessionExecutor(session);
  const drafts = new InventoryDraftService(new SqliteInventoryUnitOfWork(executor));
  const inventoryPort: InventorySourceDocumentPort = {
    async stageDraft(request) {
      const lines = [];
      for (let index = 0; index < request.lines.length; index += 1) {
        const sourceLine = request.lines[index]!;
        const product = await products.getById({ companyId: request.companyId, productId: sourceLine.productId });
        const warehouse = await warehouses.getById({ companyId: request.companyId, warehouseId: sourceLine.warehouse.warehouseId });
        if (!product || !warehouse) throw new Error("وابستگی کالا یا انبار برای رسید برگشت فروش معتبر نیست.");
        const operation = createInventoryLineOperation({
          companyId: request.companyId,
          productId: sourceLine.productId,
          product,
          enteredQuantity: sourceLine.enteredQuantity,
          unitId: sourceLine.unitId,
          warehouse: sourceLine.warehouse,
          resolvedWarehouse: { warehouse, zone: null, location: null },
          destination: null,
          resolvedDestination: null,
        });
        lines.push(createInventoryDocumentLine({
          lineId: crypto.randomUUID(),
          position: index + 1,
          productId: sourceLine.productId,
          operation,
          description: sourceLine.description,
          sourceReference: {
            companyId: request.companyId,
            sourceSystem: "sales",
            documentType: request.sourceDocumentType,
            documentId: request.sourceDocumentId,
            lineId: sourceLine.sourceLineId,
          },
        }));
      }
      const result = await drafts.create({
        companyId: request.companyId,
        requestKey: request.requestKey,
        payloadFingerprint: request.payloadFingerprint,
        document: {
          documentId: request.inventoryDocumentId,
          companyId: request.companyId,
          documentType: "receipt",
          businessDate: request.businessDate,
          description: request.description,
          createdAt: after.updatedAt,
          scope: {
            branchId: document.scope.branchId,
            destinationBranchId: null,
            fiscalYearId: document.scope.fiscalYearId,
            fiscalPeriodId: period.id,
          },
          sourceReference: {
            companyId: request.companyId,
            sourceSystem: "sales",
            documentType: request.sourceDocumentType,
            documentId: request.sourceDocumentId,
            lineId: null,
          },
          lines,
        },
      });
      return { inventoryDocumentId: result.document.documentId, status: result.document.status, version: result.document.version };
    },
  };

  const commercialSnapshots = document.lines.map(line => createSalesCommercialSnapshot({
    snapshotId: document.documentId + ":" + line.lineId + ":commercial",
    line,
    capturedAt: after.updatedAt,
  }));
  const salesReturn: SalesReturn = Object.freeze({
    document: document as SalesReturn["document"],
    commercialSnapshots: Object.freeze(commercialSnapshots),
    totals: calculateSalesDocumentTotals(commercialSnapshots.map(snapshot => snapshot.totals)),
  });

  await new InventorySalesReturnReceiptGateway(inventoryPort).stage({
    salesReturn,
    lifecycle: after.lifecycle,
    inventoryDocumentId: crypto.randomUUID(),
    lineRouting,
    requestKey: "sales-return-receipt:" + document.documentId,
    payloadFingerprint: JSON.stringify({
      sourceDocumentId: document.documentId,
      sourceVersion: before.version,
      routing: lineRouting.map(route => ({ lineId: route.salesReturnLineId, warehouseId: route.warehouse.warehouseId, unitId: route.unitId })),
    }),
  });
}

async function mutateSalesDocument(
  database: DatabaseExecutor,
  actor: SalesDesktopActor,
  input: SalesDocumentMutationInput,
  action: SalesLifecycleAction | "edit",
  ports: SalesDraftPorts,
  edit?: SalesDraftEditInput,
  transition?: SalesTransitionInput,
): Promise<SalesPersistedDocument> {
  const permission: SalesPermission = salesPermissions[action];
  const authorization = {
    async require() {
      if (!permission || !actor.id || (!actor.permissions.includes("system.full-access") &&
          (!actor.permissions.includes(permission) || !actor.branchIds.includes(input.branchId)))) {
        throw new Error("مجوز انجام این عملیات فروش در شعبهٔ انتخاب‌شده را ندارید.");
      }
    },
  };
  await authorization.require();
  const occurredAt = new Date().toISOString();
  const mutation = createSalesMutationContext({
    companyId: input.companyId, branchId: input.branchId,
    requestId: input.submissionId, operationId: input.submissionId,
    operation: `sales.document.${action}`,
    payloadFingerprint: JSON.stringify({ actorId: actor.id, action, input, edit }),
    actorUserId: actor.id, occurredAt,
  });

  return database.transaction(async session => {
    const documents = new SqliteSalesDocumentRepository(session);
    const idempotency = new SqliteSalesIdempotencyRepository(session);
    const replay = await decideSalesReplay(idempotency, mutation);
    if (replay.kind === "replay") return replaySalesResult<SalesPersistedDocument>(replay.record);

    const before = await documents.findById(input.companyId, input.documentId);
    if (!before || before.document.scope.branchId !== input.branchId || before.document.scope.fiscalYearId !== input.fiscalYearId) {
      throw new Error("سند فروش در شرکت، شعبه یا سال مالی انتخاب‌شده یافت نشد.");
    }
    assertSalesExpectedVersion(before.version, input.expectedVersion);
    await ports.validateScope(session, { ...before.document.scope, businessDate: before.document.businessDate });

    let document = before.document;
    let lifecycle = before.lifecycle;
    if (edit) {
      if (before.lifecycle.status !== "draft") throw new Error("فقط سند پیش‌نویس قابل ویرایش است.");
      if (edit.documentType !== document.documentType) throw new Error("نوع سند در ویرایش قابل تغییر نیست.");
      // Validate the persisted date as well as the new date: moving a locked document is not allowed.
      document = await prepareSalesDraft(session, edit, ports, document, occurredAt);
    } else {
      if (action === "submit" || action === "finalize") {
        if (!document.lines.length || document.lines.some(line => !line.commercialTerms)) {
          throw new Error("سند باید حداقل یک ردیف با اطلاعات تجاری کامل داشته باشد.");
        }
        calculateSalesDocumentTotals(document.lines.map(line => calculateSalesLineTotals(line.commercialTerms!)));
      }
      if (action === "edit") throw new SalesDomainError("sales.input_invalid", "edit");

      if (action === "finalize" && document.documentType === "sales-invoice") {
        const guard = new BelowCostSalesGuardService(
          new SqliteBelowCostSalesPolicyRepository(session),
          new SqliteSalesInventoryCostQuotePort(session),
          new SqliteBelowCostSalesDecisionRepository(session),
        );
        const snapshots = document.lines
          .filter(line => line.commercialTerms)
          .map(line => createSalesCommercialSnapshot({
            snapshotId: "finalize:" + document.documentId + ":" + line.lineId + ":" + before.version,
            line,
            capturedAt: occurredAt,
          }));
        const evaluated = await guard.evaluate({
          companyId: document.scope.companyId,
          documentId: document.documentId,
          businessDate: document.businessDate,
          snapshots,
          routing: transition?.stockRouting ?? [],
        });
        const outcomes = evaluated.results.map(item => item.evaluation.outcome);
        if (outcomes.includes("cost-unavailable")) {
          throw new Error("برای یکی از کالاهای انباری، بهای معتبر از ارزش‌گذاری موجودی در دسترس نیست؛ فاکتور تا رفع وضعیت ارزش‌گذاری قطعی نمی‌شود.");
        }
        if (outcomes.includes("blocked")) {
          throw new Error("فروش زیر حداقل حاشیه مجاز شرکت است و طبق سیاست جاری امکان قطعی‌کردن فاکتور وجود ندارد.");
        }
        if (outcomes.includes("warning") && !transition?.acknowledgeBelowCostWarning) {
          throw new Error("فروش زیر حداقل حاشیه مجاز است؛ هشدار باید پیش از قطعی‌کردن صریحاً تأیید شود.");
        }
        const approvalRequired = outcomes.includes("approval-required");
        if (approvalRequired) {
          const canApprove = actor.permissions.includes("system.full-access") || actor.permissions.includes(salesPermissions.approveBelowCost);
          if (!canApprove) throw new Error("این فاکتور زیر حد مجاز است و به مجوز تأیید فروش زیر بهای تمام‌شده نیاز دارد.");
          if (!transition?.belowCostApprovalReason?.trim()) throw new Error("برای تأیید فروش زیر حد مجاز، ثبت دلیل الزامی است.");
        }
        await guard.record({
          companyId: document.scope.companyId,
          documentId: document.documentId,
          decisionKey: input.submissionId,
          actorId: actor.id,
          approved: approvalRequired,
          approvalReason: transition?.belowCostApprovalReason ?? null,
          evaluated,
          decidedAt: occurredAt,
        });
      }

      lifecycle = transitionSalesLifecycle(before.lifecycle, {
        transitionId: input.submissionId, action, actorId: actor.id, occurredAt, reason: input.reason,
      });
      if (action === "finalize") {
        if (document.documentNumber) throw new Error("سند فروش پیش از قطعی‌شدن دارای شماره رسمی است و وضعیت آن باید بررسی شود.");
        await ensureSalesNumberSeries(session, {
          companyId: document.scope.companyId,
          branchId: document.scope.branchId,
          fiscalYearId: document.scope.fiscalYearId,
          documentType: document.documentType,
        });
        const fiscalUow = SqliteFiscalUnitOfWork.fromSession(session);
        const documentNumber = await generateDocumentNumber(fiscalUow, {
          companyId: document.scope.companyId,
          branchId: document.scope.branchId,
          fiscalYearId: document.scope.fiscalYearId,
          entityType: SALES_NUMBER_SERIES_TYPES[document.documentType],
        });
        document = Object.freeze({ ...document, documentNumber });
      }
    }

    const after: SalesPersistedDocument = { ...before, document, lifecycle, version: before.version + 1, updatedAt: occurredAt };
    const secured = new SecuredSalesMutationService({
      authorization,
      audit: { record: event => ports.recordAudit(session, event, actor, input.fiscalYearId) },
    });
    return secured.execute({
      security: { actorId: actor.id, actorDisplayName: actor.displayName }, mutation,
      permission, action: `sales.document.${action}`, documentId: input.documentId,
      reason: input.reason, before,
      execute: async () => {
        await documents.update(after, input.expectedVersion);
        if (action === "finalize" && transition) {
          await stageFinalizedSalesIssue(session, actor, before, after, transition);
          await stageFinalizedSalesReturnReceipt(session, actor, before, after, transition);
        }
        await idempotency.add(createSalesIdempotencyRecord({
          context: mutation, outcomeKind: action === "edit" ? "sales-document" : "lifecycle",
          outcomeId: input.documentId, outcomeVersion: after.version, outcomeStatus: after.lifecycle.status,
          resultJson: JSON.stringify(after), recordedAt: occurredAt,
        }));
        return after;
      },
    });
  });
}

export const editSalesDraft = (database: DatabaseExecutor, actor: SalesDesktopActor, input: SalesDraftEditInput, ports: SalesDraftPorts) =>
  mutateSalesDocument(database, actor, input, "edit", ports, input);

export const transitionSalesDocument = (database: DatabaseExecutor, actor: SalesDesktopActor, input: SalesTransitionInput, ports: SalesDraftPorts) =>
  mutateSalesDocument(database, actor, input, input.action, ports, undefined, input);
