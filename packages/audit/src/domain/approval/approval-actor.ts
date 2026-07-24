export const approvalActorTypes = [
  "user",
  "system"
] as const;

export type ApprovalActorType =
  (typeof approvalActorTypes)[number];

export interface ApprovalActor {
  type: ApprovalActorType;
  id: string | null;
  displayName: string;
}

export function createSystemApprovalActor(
  displayName = "ArginAccounting"
): ApprovalActor {
  return {
    type: "system",
    id: null,
    displayName
  };
}
