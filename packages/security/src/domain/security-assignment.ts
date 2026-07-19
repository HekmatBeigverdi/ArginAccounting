export interface UserRoleAssignment {
  userId: string;
  roleId: string;
  assignedAt: string;
  assignedBy: string | null;
}

export interface RolePermissionAssignment {
  roleId: string;
  permissionId: string;
  assignedAt: string;
  assignedBy: string | null;
}

export interface UserBranchAccess {
  userId: string;
  branchId: string;
  canAccess: boolean;
  assignedAt: string;
  assignedBy: string | null;
}
