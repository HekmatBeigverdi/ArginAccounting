import type {
  ApprovalHistoryEntry,
  ApprovalQuery,
  ApprovalQueryResult,
  ApprovalRequest,
  ApprovalRequestSummary
} from "../index.ts";

export interface ApprovalRepository {

  create(
    request: ApprovalRequest
  ): Promise<void>;

  update(
    request: ApprovalRequest
  ): Promise<ApprovalRequest>;

  findById(
    id: string
  ): Promise<ApprovalRequest | null>;

  search(
    query: ApprovalQuery
  ): Promise<
    ApprovalQueryResult<
      ApprovalRequestSummary
    >
  >;

  addHistory(
    history: ApprovalHistoryEntry
  ): Promise<void>;

}
