export const accountingDimensionsPermissions = Object.freeze({
  view: "accounting.dimensions.view",
  create: "accounting.dimensions.create",
  update: "accounting.dimensions.update",
  changeStatus: "accounting.dimensions.change-status",
  delete: "accounting.dimensions.delete",
  managePolicies: "accounting.dimensions.manage-policies",
} as const);

export type AccountingDimensionsPermission =
  (typeof accountingDimensionsPermissions)[keyof typeof accountingDimensionsPermissions];
