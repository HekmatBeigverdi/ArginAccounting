export interface AuthenticatedUser {
  id: string;
  username: string;
  displayName: string;
  mustChangePassword: boolean;
  roleCodes: string[];
  permissions: string[];
  branchIds: string[];
}

export interface AuthSession {
  user: AuthenticatedUser;
  authenticatedAt: string;
}
