import {
  approveApprovalRequest,
  cancelApprovalRequest,
  commentOnApprovalRequest,
  createApprovalRequestService,
  createPermissionSetAuthorizer,
  getApprovalRequest,
  getAuditEntry,
  recordAuditEntry,
  rejectApprovalRequest,
  returnApprovalRequestToDraft,
  searchApprovalRequests,
  searchAuditEntries,
  submitApprovalRequest
} from "@argin/audit";

import type {
  ApprovalActionCommand,
  ApprovalCommandContext,
  ApprovalQuery,
  AuditCommandContext,
  AuditQuery,
  CreateApprovalRequestCommand,
  CreateAuditEntryInput
} from "@argin/audit";

import {
  SqliteApprovalRepository,
  SqliteAuditRepository,
  SqliteAuditUnitOfWork
} from "@argin/audit-tauri";

import type {
  SqliteDatabase
} from "@argin/audit-tauri";

import type {
  AuthSession
} from "@argin/security";

export interface AuditServices {
  recordAuditEntry(input: CreateAuditEntryInput): ReturnType<typeof recordAuditEntry>;
  getAuditEntry(id: string): ReturnType<typeof getAuditEntry>;
  searchAuditEntries(query: AuditQuery): ReturnType<typeof searchAuditEntries>;
  createApprovalRequest(input: CreateApprovalRequestCommand): ReturnType<typeof createApprovalRequestService>;
  getApprovalRequest(id: string): ReturnType<typeof getApprovalRequest>;
  searchApprovalRequests(query: ApprovalQuery): ReturnType<typeof searchApprovalRequests>;
  submitApprovalRequest(command: ApprovalActionCommand): ReturnType<typeof submitApprovalRequest>;
  approveApprovalRequest(command: ApprovalActionCommand): ReturnType<typeof approveApprovalRequest>;
  rejectApprovalRequest(command: ApprovalActionCommand): ReturnType<typeof rejectApprovalRequest>;
  returnApprovalRequestToDraft(command: ApprovalActionCommand): ReturnType<typeof returnApprovalRequestToDraft>;
  cancelApprovalRequest(command: ApprovalActionCommand): ReturnType<typeof cancelApprovalRequest>;
  commentOnApprovalRequest(command: ApprovalActionCommand): ReturnType<typeof commentOnApprovalRequest>;
}

function createClock() {
  return {
    now: () => new Date().toISOString()
  };
}

function createIdGenerator() {
  return {
    generate: () => crypto.randomUUID()
  };
}

export function createAuditServices(
  database: SqliteDatabase,
  session: AuthSession | null
): AuditServices {
  const auditRepository =
    new SqliteAuditRepository(database);
  const approvalRepository =
    new SqliteApprovalRepository(database);
  const unitOfWork =
    new SqliteAuditUnitOfWork(database);

  const authorizer = createPermissionSetAuthorizer(
    session?.user.permissions ?? []
  );

  const shared = {
    idGenerator: createIdGenerator(),
    clock: createClock(),
    authorizer
  };

  const auditContext: AuditCommandContext = {
    ...shared,
    unitOfWork,
    auditRepository
  };

  const approvalContext: ApprovalCommandContext = {
    ...shared,
    auditSource: "desktop",
    unitOfWork,
    approvalRepository,
    auditRepository
  };

  return {
    recordAuditEntry: (input) =>
      recordAuditEntry(auditContext, input),
    getAuditEntry: (id) =>
      getAuditEntry(auditContext, id),
    searchAuditEntries: (query) =>
      searchAuditEntries(auditContext, query),
    createApprovalRequest: (input) =>
      createApprovalRequestService(approvalContext, input),
    getApprovalRequest: (id) =>
      getApprovalRequest(approvalContext, id),
    searchApprovalRequests: (query) =>
      searchApprovalRequests(approvalContext, query),
    submitApprovalRequest: (command) =>
      submitApprovalRequest(approvalContext, command),
    approveApprovalRequest: (command) =>
      approveApprovalRequest(approvalContext, command),
    rejectApprovalRequest: (command) =>
      rejectApprovalRequest(approvalContext, command),
    returnApprovalRequestToDraft: (command) =>
      returnApprovalRequestToDraft(approvalContext, command),
    cancelApprovalRequest: (command) =>
      cancelApprovalRequest(approvalContext, command),
    commentOnApprovalRequest: (command) =>
      commentOnApprovalRequest(approvalContext, command)
  };
}
