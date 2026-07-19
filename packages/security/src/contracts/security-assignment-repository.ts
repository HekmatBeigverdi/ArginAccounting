export interface SecurityAssignmentRepository {
  assignRoleToUser(
    userId: string,
    roleId: string,
    assignedBy: string | null
  ): Promise<void>;

  removeRoleFromUser(
    userId: string,
    roleId: string
  ): Promise<void>;

  replaceRolePermissions(
    roleId: string,
    permissionIds: string[],
    assignedBy: string | null
  ): Promise<void>;

  replaceUserBranchAccess(
    userId: string,
    branchIds: string[],
    assignedBy: string | null
  ): Promise<void>;

  findBranchIdsByUserId(
    userId: string
  ): Promise<string[]>;
}
