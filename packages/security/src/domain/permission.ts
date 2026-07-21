export type PermissionModule =
  | "system"
  | "security"
  | "company"
  | "fiscal"
  | "accounting"
  | "master-data"
  | "inventory"
  | "purchases"
  | "sales"
  | "treasury"
  | "fixed-assets"
  | "payroll"
  | "human-resources"
  | "manufacturing"
  | "cost-accounting"
  | "budgeting"
  | "contracts"
  | "reporting"
  | "taxpayer"
  | "synchronization";

export interface Permission {
  id: string;
  code: string;
  module: PermissionModule;
  title: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PermissionDefinition {
  code: string;
  module: PermissionModule;
  title: string;
  description?: string | null;
}
