import type {
  ApprovalRepository,
  AuditClock,
  AuditIdGenerator,
  AuditRepository
} from "../../index";

export interface ApprovalCommandContext {
  idGenerator: AuditIdGenerator;
  clock: AuditClock;
  approvalRepository: ApprovalRepository;
  auditRepository: AuditRepository;
}
