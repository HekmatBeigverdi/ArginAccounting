import type {
  ApprovalCommandContext,
  ApprovalRequest,
  AuditRepositories,
  AuditUnitOfWork,
} from "@argin/audit";
import {
  approveApprovalRequest,
  cancelApprovalRequest,
  createApprovalRequestService,
  rejectApprovalRequest,
  returnApprovalRequestToDraft,
  submitApprovalRequest,
} from "@argin/audit";
import type {
  JournalVoucherApprovalDecision,
  JournalVoucherApprovalGateway,
} from "@argin/accounting/journal";
import {
  SqliteApprovalRepository,
  SqliteAuditRepository,
  type SqliteDatabase,
} from "@argin/audit-tauri";
import type {
  DatabaseSession,
  DatabaseValue,
} from "@argin/database";
import type { Clock, IdGenerator } from "@argin/platform";

interface CreateJournalApprovalGatewayInput {
  readonly clock: Clock;
  readonly idGenerator: IdGenerator;
}

export function createDesktopJournalApprovalGateway(
  session: DatabaseSession,
  input: CreateJournalApprovalGatewayInput,
): JournalVoucherApprovalGateway {
  const database = asAuditDatabase(session);
  const approvalRepository = new SqliteApprovalRepository(database);
  const auditRepository = new SqliteAuditRepository(database);
  const unitOfWork: AuditUnitOfWork = {
    run<T>(work: (repositories: AuditRepositories) => Promise<T>): Promise<T> {
      return work({ approval: approvalRepository, audit: auditRepository });
    },
  };

  const context: ApprovalCommandContext = {
    idGenerator: { generate: () => input.idGenerator.generate() },
    clock: { now: () => input.clock.now().toISOString() },
    auditSource: "desktop",
    authorizer: { async hasPermission() { return true; } },
    unitOfWork,
    approvalRepository,
    auditRepository,
  };

  return Object.freeze({
    async createAndSubmit(request): Promise<ApprovalRequest> {
      const created = await createApprovalRequestService(context, {
        requestType: request.requestType,
        title: request.title,
        description: request.description,
        target: request.target,
        scope: request.scope,
        createdBy: request.actor,
        correlationId: request.correlationId,
      });

      return submitApprovalRequest(context, {
        approvalRequestId: created.id,
        actor: request.actor,
        correlationId: request.correlationId,
      });
    },

    async applyDecision(request): Promise<ApprovalRequest> {
      const current = await approvalRepository.findById(request.approvalRequestId);
      if (!current) {
        throw new Error(`Approval request ${request.approvalRequestId} was not found.`);
      }
      if (current.version !== request.expectedVersion) {
        throw new Error(
          `Approval request ${request.approvalRequestId} version conflict: expected ${request.expectedVersion}, actual ${current.version}.`,
        );
      }

      const command = {
        approvalRequestId: request.approvalRequestId,
        actor: request.actor,
        comment: request.comment,
        correlationId: request.correlationId,
      };

      return applyDecision(request.decision, context, command);
    },
  });
}

function applyDecision(
  decision: JournalVoucherApprovalDecision,
  context: ApprovalCommandContext,
  command: {
    readonly approvalRequestId: string;
    readonly actor: Parameters<typeof approveApprovalRequest>[1]["actor"];
    readonly comment: string | null;
    readonly correlationId: string | null;
  },
): Promise<ApprovalRequest> {
  switch (decision) {
    case "approve":
      return approveApprovalRequest(context, command);
    case "reject":
      return rejectApprovalRequest(context, command);
    case "return-to-draft":
      return returnApprovalRequestToDraft(context, command);
    case "cancel":
      return cancelApprovalRequest(context, command);
  }
}

function asAuditDatabase(session: DatabaseSession): SqliteDatabase {
  return {
    execute: (sql, parameters = []) =>
      session.execute(sql, parameters as readonly DatabaseValue[]),
    async select<T>(sql: string, parameters: unknown[] = []): Promise<T> {
      const rows = await session.query<unknown>(
        sql,
        parameters as readonly DatabaseValue[],
      );
      return rows as unknown as T;
    },
  };
}
