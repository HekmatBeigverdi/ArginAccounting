import type {
  CreateUserRecordInput,
  User,
  UserStatus,
  UserSummary
} from "../domain/user.ts";

export interface UserRepository {
  create(input: CreateUserRecordInput): Promise<User>;

  findById(id: string): Promise<User | null>;

  findByNormalizedUsername(
    normalizedUsername: string
  ): Promise<User | null>;

  findAll(): Promise<UserSummary[]>;

  updateStatus(
    userId: string,
    status: UserStatus,
    updatedAt: string
  ): Promise<void>;

  updatePassword(
    userId: string,
    passwordHash: string,
    mustChangePassword: boolean,
    updatedAt: string
  ): Promise<void>;

  recordSuccessfulLogin(
    userId: string,
    loginAt: string
  ): Promise<void>;

  recordFailedLogin(
    userId: string,
    failedLoginCount: number,
    lockedUntil: string | null,
    updatedAt: string
  ): Promise<void>;
}
