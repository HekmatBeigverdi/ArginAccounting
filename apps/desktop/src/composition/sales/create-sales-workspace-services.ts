import type { DatabaseExecutor, DatabaseValue } from "@argin/database";
import { SqliteAuditRepository } from "@argin/audit-tauri";
import { SqliteBranchRepository, SqliteCompanyRepository } from "@argin/company-tauri";
import { validateOperationDate } from "@argin/fiscal";
import { SqliteFiscalYearRepository, SqliteFiscalPeriodRepository, SqliteHistoricalLockRepository } from "@argin/fiscal-tauri";
import { SqlitePartyReader } from "@argin/party-tauri";
import { SqliteProductReader, SqliteProductSelectorReader } from "@argin/product-tauri";
import {
  SqliteSalesDocumentRepository,
  SqliteBelowCostSalesPolicyRepository,
  SqliteBelowCostSalesDecisionRepository,
  SqliteSalesInventoryCostQuotePort,
} from "@argin/sales-tauri";
import { SqliteWarehouseReader } from "@argin/warehouse-tauri";
import {
  BelowCostSalesGuardService, createBelowCostSalesPolicy, createSalesCommercialSnapshot, salesPermissions,
  type BelowCostLineRouting, type BelowCostSalesMode, type SalesPermission, type SalesDocumentSnapshot, type SalesPersistedDocument,
} from "@argin/sales";
import { editSalesDraft, transitionSalesDocument, type SalesDraftEditInput, type SalesTransitionInput } from "./mutate-sales-document";
import { createSalesDraft, type SalesDesktopActor, type SalesDraftInput, type SalesDraftPorts } from "./create-sales-draft";

export const salesDraftPorts: SalesDraftPorts = {
  async validateScope(session, input) {
    const company = await new SqliteCompanyRepository(session).findById(input.companyId);
    const branch = await new SqliteBranchRepository(session).findById(input.branchId);
    const year = await new SqliteFiscalYearRepository(session).findById(input.fiscalYearId);
    if (!company || company.status !== "active" || !branch || branch.companyId !== input.companyId || branch.status !== "active") {
      throw new Error("شرکت و شعبهٔ فعال و معتبر را انتخاب کنید.");
    }
    if (!year || year.companyId !== input.companyId || year.status !== "open") {
      throw new Error("سال مالی انتخاب‌شده باز نیست یا به شرکت جاری تعلق ندارد.");
    }
    if (input.businessDate < year.startDate || input.businessDate > year.endDate) {
      throw new Error("تاریخ سند باید در محدودهٔ سال مالی فعال باشد.");
    }
    await validateOperationDate(
      new SqliteFiscalPeriodRepository(session),
      new SqliteHistoricalLockRepository(session),
      { ...input, operationDate: input.businessDate, scope: "sales" },
    );
  },
  getCustomer: (session, companyId, partyId) => new SqlitePartyReader(session).getById({ companyId, partyId }),
  async getProduct(session, companyId, productId) {
    const product = await new SqliteProductReader(session).getById({ companyId, productId });
    return product ? {
      productId: product.productId, companyId: product.companyId, title: product.title,
      kind: product.kind, status: product.status,
      sellable: product.capabilities.sellable, stockTracking: product.masterData.operational.stockTracking,
    } : null;
  },
  async recordAudit(session, event, actor, fiscalYearId) {
    // This repository uses the sales transaction's pinned session; no nested transaction.
    const audit = new SqliteAuditRepository({
      execute: (sql, parameters) => session.execute(sql, parameters as DatabaseValue[] | undefined),
      select: async <T>(sql: string, parameters?: unknown[]) =>
        await session.query(sql, parameters as DatabaseValue[] | undefined) as T,
    });
    await audit.create({
      id: `sales:${event.action}:${event.companyId}:${event.operationId}`,
      occurredAt: event.occurredAt,
      action: event.action === "sales.document.create" ? "create"
        : event.action === "sales.document.edit" ? "update"
        : event.action === "sales.document.submit" ? "submit"
        : event.action === "sales.document.approve" ? "approve"
        : event.action === "sales.document.reject" ? "reject"
        : event.action === "sales.document.cancel" ? "cancel" : "status-change",
      outcome: "success", source: "desktop",
      actor: { type: "user", id: actor.id, displayName: actor.displayName },
      scope: { companyId: event.companyId, branchId: event.branchId, fiscalYearId },
      target: { entityType: "sales-document", entityId: event.documentId, entityDisplayName: null },
      message: event.action, reason: event.reason,
      before: event.beforeStatus ? { status: event.beforeStatus, version: event.beforeVersion } : null,
      after: { status: event.afterStatus, version: event.afterVersion },
      correlationId: event.correlationId,
      metadata: { requestId: event.requestId, operationId: event.operationId, salesAction: event.action },
    });
  },
};

export function createSalesWorkspaceServices(database: DatabaseExecutor, actor: SalesDesktopActor) {
  async function requireAccess(companyId: string, branchId: string, permission: SalesPermission) {
    if (!actor.permissions.includes("system.full-access") &&
        (!actor.permissions.includes(permission) || !actor.branchIds.includes(branchId))) {
      throw new Error("مجوز انجام این عملیات فروش در این شعبه را ندارید.");
    }
    const branch = await new SqliteBranchRepository(database).findById(branchId);
    const company = await new SqliteCompanyRepository(database).findById(companyId);
    if (!branch || branch.companyId !== companyId || branch.status !== "active" || !company || company.status !== "active") {
      throw new Error("شرکت و شعبهٔ انتخاب‌شده معتبر نیستند.");
    }
  }

  const requireFormAccess = (companyId: string, branchId: string, editing: boolean) =>
    requireAccess(companyId, branchId, editing ? salesPermissions.edit : salesPermissions.create);

  return {
    async list(companyId: string, branchId: string, fiscalYearId: string): Promise<SalesWorkspaceDocument[]> {
      await requireAccess(companyId, branchId, salesPermissions.view);
      const rows = await database.query<{ id: string }>(
        "SELECT id FROM sales_documents WHERE company_id=? AND branch_id=? AND fiscal_year_id=? ORDER BY business_date DESC,updated_at DESC",
        [companyId, branchId, fiscalYearId],
      );
      const repository = new SqliteSalesDocumentRepository(database);
      const states = await Promise.all(rows.map(row => repository.findById(companyId, row.id)));
      return states.flatMap(state => state ? [{ ...state.document, status: state.lifecycle.status, version: state.version, lifecycle: state.lifecycle }] : []);
    },
    async selectCustomers(companyId: string, branchId: string, search: string, editing = false) {
      await requireFormAccess(companyId, branchId, editing);
      return new SqlitePartyReader(database).select({ companyId, search, roles: ["customer"], statuses: ["active"], limit: 100 });
    },
    async selectItems(companyId: string, branchId: string, search: string, editing = false) {
      await requireFormAccess(companyId, branchId, editing);
      return new SqliteProductSelectorReader(database).select({ companyId, search, kinds: ["product", "service"], statuses: ["active"], sellable: true, limit: 100 });
    },
    async selectOriginals(companyId: string, branchId: string, customerId: string, editing = false) {
      await requireFormAccess(companyId, branchId, editing);
      return database.query<{ id: string; document_number: string | null; business_date: string }>(
        "SELECT id, document_number, business_date FROM sales_documents WHERE company_id=? AND branch_id=? AND customer_id=? AND document_type='sales-invoice' AND status='finalized' ORDER BY business_date DESC",
        [companyId, branchId, customerId],
      );
    },
    async getOriginal(companyId: string, branchId: string, documentId: string, editing = false) {
      await requireFormAccess(companyId, branchId, editing);
      const state = await new SqliteSalesDocumentRepository(database).findById(companyId, documentId);
      if (!state || state.document.scope.branchId !== branchId || state.document.documentType !== "sales-invoice" || state.lifecycle.status !== "finalized") {
        throw new Error("فاکتور اصلی معتبر نیست.");
      }
      return state.document;
    },
    async selectWarehouses(companyId: string, branchId: string) {
      await requireAccess(companyId, branchId, salesPermissions.view);
      return new SqliteWarehouseReader(database).select({
        companyId, branchId, includeCompanyWide: true, statuses: ["active"], limit: 100,
      });
    },
    async getBelowCostPolicy(companyId: string, branchId: string, businessDate: string) {
      await requireAccess(companyId, branchId, salesPermissions.view);
      return new SqliteBelowCostSalesPolicyRepository(database).findEffective(companyId, businessDate);
    },
    async saveBelowCostPolicy(input: {
      companyId: string; branchId: string; mode: BelowCostSalesMode;
      minimumMarginBasisPoints: number; effectiveFrom: string;
    }) {
      await requireAccess(input.companyId, input.branchId, salesPermissions.manageBelowCostPolicy);
      const repository = new SqliteBelowCostSalesPolicyRepository(database);
      const history = await repository.list(input.companyId);
      const revision = (history.at(-1)?.revision ?? 0) + 1;
      const policy = createBelowCostSalesPolicy({
        policyId: crypto.randomUUID(), companyId: input.companyId, revision,
        effectiveFrom: input.effectiveFrom, mode: input.mode,
        minimumMarginBasisPoints: input.minimumMarginBasisPoints,
      });
      await repository.save(policy, actor.id, new Date().toISOString());
      return policy;
    },
    async previewBelowCost(document: SalesWorkspaceDocument, routing: readonly BelowCostLineRouting[]) {
      await requireAccess(document.scope.companyId, document.scope.branchId, salesPermissions.finalize);
      const guard = new BelowCostSalesGuardService(
        new SqliteBelowCostSalesPolicyRepository(database),
        new SqliteSalesInventoryCostQuotePort(database),
        new SqliteBelowCostSalesDecisionRepository(database),
      );
      const capturedAt = new Date().toISOString();
      const snapshots = document.lines.filter(line => line.commercialTerms).map(line => createSalesCommercialSnapshot({
        snapshotId: "preview:" + document.documentId + ":" + line.lineId + ":" + document.version,
        line, capturedAt,
      }));
      return guard.evaluate({
        companyId: document.scope.companyId, documentId: document.documentId,
        businessDate: document.businessDate, snapshots, routing,
      });
    },
    async listBelowCostDecisions(companyId: string, branchId: string, documentId: string) {
      await requireAccess(companyId, branchId, salesPermissions.view);
      return new SqliteBelowCostSalesDecisionRepository(database).listByDocument(companyId, documentId);
    },
    edit: (input: SalesDraftEditInput) => editSalesDraft(database, actor, input, salesDraftPorts),
    transition: (input: SalesTransitionInput) => transitionSalesDocument(database, actor, input, salesDraftPorts),
    create: (input: SalesDraftInput) => createSalesDraft(database, actor, input, salesDraftPorts),
  };
}

export type SalesWorkspaceServices = ReturnType<typeof createSalesWorkspaceServices>;

export type SalesWorkspaceDocument = SalesDocumentSnapshot & {
  status: SalesPersistedDocument["lifecycle"]["status"];
  version: number;
  lifecycle: SalesPersistedDocument["lifecycle"];
};
