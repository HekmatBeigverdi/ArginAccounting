export type PartyApplicationErrorCode =
  | "party.notFound"
  | "party.code.conflict"
  | "party.identity.conflict"
  | "party.concurrentModification"
  | "party.permissionDenied"
  | "party.invalidQuery";

export class PartyApplicationError extends Error {
  constructor(
    readonly code: PartyApplicationErrorCode,
    message: string
  ) {
    super(message);
    this.name = "PartyApplicationError";
  }
}
