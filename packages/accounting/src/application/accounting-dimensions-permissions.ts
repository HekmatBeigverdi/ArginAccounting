export const accountingDimensionsPermissions = Object.freeze({
  view: "accounting.dimensions.view",
  manageTypes: "accounting.dimensions.manage-types",
  manageMembers: "accounting.dimensions.manage-members",
  managePolicies: "accounting.dimensions.manage-policies",
} as const);

export type AccountingDimensionsPermission =
  (typeof accountingDimensionsPermissions)[keyof typeof accountingDimensionsPermissions];
