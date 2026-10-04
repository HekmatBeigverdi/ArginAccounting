import type { DatabaseExecutor } from "@argin/database";
import {
  SalesDomainError, SecuredSalesMutationService, assertSalesExpectedVersion,
  createSalesIdempotencyRecord, createSalesMutationContext, decideSalesReplay,
  replaySalesResult, salesPermissions, transitionSalesLifecycle,
  calculateSalesDocumentTotals, calculateSalesLineTotals,
  type SalesLifecycleAction, type SalesPermission, type SalesPersistedDocument,
} from "@argin/sales";
import { SqliteSalesDocumentRepository, SqliteSalesIdempotencyRepository } from "@argin/sales-tauri";
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
export type SalesTransitionInput = SalesDocumentMutationInput & { action: SalesLifecycleAction };

async function mutateSalesDocument(
  database: DatabaseExecutor,
  actor: SalesDesktopActor,
  input: SalesDocumentMutationInput,
  action: SalesLifecycleAction | "edit",
  ports: SalesDraftPorts,
  edit?: SalesDraftEditInput,
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
      lifecycle = transitionSalesLifecycle(before.lifecycle, {
        transitionId: input.submissionId, action, actorId: actor.id, occurredAt, reason: input.reason,
      });
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
  mutateSalesDocument(database, actor, input, input.action, ports);
