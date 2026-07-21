import type {
  CreateRoleInput,
  Role
} from "../domain/role";

export interface RoleRepository {
  create(input: CreateRoleInput): Promise<Role>;

  findById(id: string): Promise<Role | null>;

  findByNormalizedCode(
    normalizedCode: string
  ): Promise<Role | null>;

  findAll(): Promise<Role[]>;

  findByUserId(userId: string): Promise<Role[]>;
}
