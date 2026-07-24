import type {
  AuditRepository
} from "./audit-repository.ts";

import type {
  ApprovalRepository
} from "./approval-repository.ts";

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
