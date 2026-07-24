export const auditSources = [
  "desktop",
  "web",
  "api",
  "system",
  "synchronization",
  "integration"
] as const;

export type AuditSource =
  (typeof auditSources)[number];

export function isAuditSource(
  value: string
): value is AuditSource {
  return auditSources.includes(
    value as AuditSource
  );
}
