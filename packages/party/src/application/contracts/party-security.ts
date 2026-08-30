export const partyPermissions = {
  view: "master-data.parties.view",
  create: "master-data.parties.create",
  update: "master-data.parties.update",
  changeStatus: "master-data.parties.change-status",
  manageRoles: "master-data.parties.manage-roles",
  import: "master-data.parties.import",
  export: "master-data.parties.export"
} as const;

export type PartyPermission =
  (typeof partyPermissions)[keyof typeof partyPermissions];

export interface PartyAuthorizationContext {
  readonly actorId: string;
  readonly companyId: string;
  readonly correlationId: string;
  readonly requestId: string | null;
}

export interface PartyAuthorizationPolicy {
  require(
    context: PartyAuthorizationContext,
    permission: PartyPermission
  ): Promise<void>;
}

export type PartyAuditAction =
  | "party.create"
  | "party.update"
  | "party.change-status"
  | "party.add-role"
  | "party.remove-role"
  | "party.import"
  | "party.export";

export interface PartyAuditEvent {
  readonly action: PartyAuditAction;
  readonly actorId: string;
  readonly companyId: string;
  readonly partyId: string | null;
  readonly correlationId: string;
  readonly requestId: string | null;
  readonly occurredAt: string;
  readonly metadata: Readonly<Record<string, string | number | boolean | null>>;
}

export interface PartyAuditSink {
  record(event: PartyAuditEvent): Promise<void>;
}
