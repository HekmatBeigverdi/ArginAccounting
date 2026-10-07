import type {
  SalesPostingAuditEvent,
} from "./contracts/sales-posting-security.ts";

export const salesPostingAuditIdentity = (
  event: SalesPostingAuditEvent,
): string => [
  "sales-posting",
  event.action,
  event.operationId,
  event.postingId,
].join(":");
