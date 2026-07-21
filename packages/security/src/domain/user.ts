export type UserStatus =
  | "active"
  | "inactive"
  | "locked";

export interface User {
  id: string;
  username: string;
  normalizedUsername: string;
  displayName: string;
  passwordHash: string;
  status: UserStatus;
  mustChangePassword: boolean;
  failedLoginCount: number;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserSummary {
  id: string;
  username: string;
  displayName: string;
  status: UserStatus;
  mustChangePassword: boolean;
  failedLoginCount: number;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserRecordInput {
  username: string;
  normalizedUsername: string;
  displayName: string;
  passwordHash: string;
  status: UserStatus;
  mustChangePassword: boolean;
}
