import type {
  AuditRepository
} from "./audit-repository";

import type {
  ApprovalRepository
} from "./approval-repository";

export interface AuditRepositories {

  readonly audit: AuditRepository;

  readonly approval: ApprovalRepository;

}

export interface AuditUnitOfWork {

  transaction<T>(
    action: (
      repositories: AuditRepositories
    ) => Promise<T>
  ): Promise<T>;

}
