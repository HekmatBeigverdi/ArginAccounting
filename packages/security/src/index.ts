export type {
  User,
  UserStatus,
  UserSummary,
  CreateUserRecordInput
} from "./domain/user";

export type {
  Role,
  CreateRoleInput
} from "./domain/role";

export type {
  Permission,
  PermissionDefinition,
  PermissionModule
} from "./domain/permission";

export type {
  UserRoleAssignment,
  RolePermissionAssignment,
  UserBranchAccess
} from "./domain/security-assignment";

export type {
  AuthenticatedUser,
  AuthSession
} from "./domain/auth-session";

export type {
  PasswordHasher
} from "./contracts/password-hasher";

export type {
  UserRepository
} from "./contracts/user-repository";

export type {
  RoleRepository
} from "./contracts/role-repository";

export type {
  PermissionRepository
} from "./contracts/permission-repository";

export type {
  SecurityAssignmentRepository
} from "./contracts/security-assignment-repository";

export type {
  SecurityUnitOfWork,
  SecurityUnitOfWorkRepositories
} from "./contracts/security-unit-of-work";

export {
  SecurityValidationError
} from "./validation/security-validation-error";

export type {
  SecurityValidationIssue
} from "./validation/security-validation-error";

export {
  normalizeUsername,
  normalizeRoleCode
} from "./validation/security-normalization";

export {
  validatePassword,
  defaultPasswordPolicy
} from "./validation/password-policy";

export type {
  PasswordPolicyOptions
} from "./validation/password-policy";

export {
  createUser
} from "./application/create-user";

export type {
  CreateUserCommand
} from "./application/create-user";

export {
  createRole
} from "./application/create-role";

export type {
  CreateRoleCommand
} from "./application/create-role";

export {
  authenticateUser
} from "./application/authenticate-user";

export type {
  AuthenticateUserCommand
} from "./application/authenticate-user";

export {
  defaultPermissions
} from "./application/default-permissions";

export {
  bootstrapSecurity
} from "./application/bootstrap-security";

export type {
  BootstrapSecurityResult
} from "./application/bootstrap-security";
