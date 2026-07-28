import type {
  AuditClock,
  AuditIdGenerator,
  AuditPermissionAuthorizer,
  AuditRepository,
  AuditUnitOfWork
} from "../../index.ts";

export interface AuditCommandContext {
  idGenerator: AuditIdGenerator;
  clock: AuditClock;
  authorizer: AuditPermissionAuthorizer;
  unitOfWork: AuditUnitOfWork;
  auditRepository: AuditRepository;
}
