import type {
  PermissionRepository
} from "./permission-repository.ts";

import type {
  RoleRepository
} from "./role-repository.ts";

import type {
  SecurityAssignmentRepository
} from "./security-assignment-repository.ts";

import type {
  UserRepository
} from "./user-repository.ts";

export interface SecurityUnitOfWorkRepositories {
  users: UserRepository;
  roles: RoleRepository;
  permissions: PermissionRepository;
  assignments: SecurityAssignmentRepository;
}

export interface SecurityUnitOfWork {
  run<T>(
    operation: (
      repositories: SecurityUnitOfWorkRepositories
    ) => Promise<T>
  ): Promise<T>;
}
