import type {
  AuditClock,
  AuditIdGenerator,
  AuditPermissionAuthorizer,
  AuditRepository
} from "../../index.ts";

export interface AuditCommandContext {
  idGenerator: AuditIdGenerator;
  clock: AuditClock;
  authorizer: AuditPermissionAuthorizer;
  auditRepository: AuditRepository;
}
