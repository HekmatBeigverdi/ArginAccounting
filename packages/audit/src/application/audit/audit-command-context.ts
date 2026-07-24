import type {
  AuditClock,
  AuditIdGenerator,
  AuditRepository
} from "../../index";

export interface AuditCommandContext {
  idGenerator: AuditIdGenerator;
  clock: AuditClock;
  auditRepository: AuditRepository;
}
