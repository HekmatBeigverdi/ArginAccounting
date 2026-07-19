export interface Role {
  id: string;
  code: string;
  normalizedCode: string;
  title: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoleInput {
  code: string;
  normalizedCode: string;
  title: string;
  description?: string | null;
  isSystem?: boolean;
  isActive?: boolean;
}
