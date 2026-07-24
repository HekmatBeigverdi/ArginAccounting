import type {
  AuditClock,
  AuditIdGenerator,
  AuditPermissionAuthorizer,
  AuditRepository
} from "../../index";

export interface AuditCommandContext {
  idGenerator: AuditIdGenerator;
  clock: AuditClock;
  authorizer: AuditPermissionAuthorizer;
  auditRepository: AuditRepository;
}
