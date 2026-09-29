import type { PurchasePostingAuditEvent } from "./contracts/purchase-posting-security.ts";

export const purchasePostingAuditIdentity = (
  event: PurchasePostingAuditEvent,
): string => {
  const target = event.postingId ?? String(event.metadata.ruleId ?? event.operationId);
  return [
    "purchase-posting",
    event.action,
    event.operationId,
    target,
  ].join(":");
};
