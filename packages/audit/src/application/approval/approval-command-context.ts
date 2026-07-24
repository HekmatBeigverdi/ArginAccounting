import type {
  ApprovalRepository,
  AuditClock,
  AuditIdGenerator,
  AuditPermissionAuthorizer,
  AuditRepository,
  AuditSource,
  AuditUnitOfWork
} from "../../index";

export interface ApprovalCommandContext {
  idGenerator: AuditIdGenerator;
  clock: AuditClock;
  auditSource: AuditSource;
  authorizer: AuditPermissionAuthorizer;
  unitOfWork: AuditUnitOfWork;
  approvalRepository: ApprovalRepository;
  auditRepository: AuditRepository;
}
