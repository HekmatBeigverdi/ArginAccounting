import type {
  PermissionRepository
} from "./permission-repository";

import type {
  RoleRepository
} from "./role-repository";

import type {
  SecurityAssignmentRepository
} from "./security-assignment-repository";

import type {
  UserRepository
} from "./user-repository";

export interface SecurityUnitOfWorkRepositories {
  users: UserRepository;
  roles: RoleRepository;
  permissions: PermissionRepository;
  assignments: SecurityAssignmentRepository;
}

export interface SecurityUnitOfWork {
  transaction<T>(
    operation: (
      repositories: SecurityUnitOfWorkRepositories
    ) => Promise<T>
  ): Promise<T>;
}
