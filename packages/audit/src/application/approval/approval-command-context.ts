import type {
  ApprovalRepository,
  AuditClock,
  AuditIdGenerator,
  AuditRepository,
  AuditSource,
  AuditUnitOfWork
} from "../../index";

export interface ApprovalCommandContext {
  idGenerator: AuditIdGenerator;
  clock: AuditClock;
  auditSource: AuditSource;
  unitOfWork: AuditUnitOfWork;
  approvalRepository: ApprovalRepository;
  auditRepository: AuditRepository;
}
