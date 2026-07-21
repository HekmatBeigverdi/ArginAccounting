export const auditOutcomes = [
  "success",
  "failure",
  "denied"
] as const;

export type AuditOutcome =
  (typeof auditOutcomes)[number];

export function isAuditOutcome(
  value: string
): value is AuditOutcome {
  return auditOutcomes.includes(
    value as AuditOutcome
  );
}
