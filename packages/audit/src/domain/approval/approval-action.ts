export const approvalActions = [
  "create",
  "submit",
  "approve",
  "reject",
  "cancel",
  "return-to-draft",
  "comment"
] as const;

export type ApprovalAction =
  (typeof approvalActions)[number];

export function isApprovalAction(
  value: string
): value is ApprovalAction {
  return approvalActions.includes(
    value as ApprovalAction
  );
}
