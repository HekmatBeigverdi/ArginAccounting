export const auditActorTypes = [
  "user",
  "system",
  "integration"
] as const;

export type AuditActorType =
  (typeof auditActorTypes)[number];

export interface AuditActor {
  type: AuditActorType;
  id: string | null;
  displayName: string;
}

export function createSystemAuditActor(
  displayName = "ArginAccounting"
): AuditActor {
  return {
    type: "system",
    id: null,
    displayName
  };
}
