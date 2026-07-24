import type {
  AuditSnapshot,
  AuditValue
} from "./audit-value.ts";

const sensitiveKeyFragments = [
  "password",
  "passwordhash",
  "secret",
  "token",
  "accesstoken",
  "refreshtoken",
  "privatekey",
  "apikey",
  "authorization"
];

function normalizeKey(
  key: string
): string {
  return key
    .replace(/[-_\s]/g, "")
    .toLowerCase();
}

function isSensitiveKey(
  key: string
): boolean {
  const normalized = normalizeKey(key);

  return sensitiveKeyFragments.some(
    (fragment) =>
      normalized.includes(fragment)
  );
}

function sanitizeValue(
  value: AuditValue
): AuditValue {
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (
    typeof value === "object" &&
    value !== null
  ) {
    return sanitizeAuditSnapshot(value);
  }

  return value;
}

export function sanitizeAuditSnapshot(
  snapshot: AuditSnapshot
): AuditSnapshot {
  const sanitized: AuditSnapshot = {};

  for (const [key, value] of Object.entries(
    snapshot
  )) {
    sanitized[key] = isSensitiveKey(key)
      ? "[REDACTED]"
      : sanitizeValue(value);
  }

  return sanitized;
}
