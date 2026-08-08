export const companyProfilePermissions = Object.freeze({
  view: "company.profile.view",
  manage: "company.profile.manage",
  updateActivityType: "company.profile.update-activity-type"
} as const);

export type CompanyProfilePermission =
  (typeof companyProfilePermissions)[keyof typeof companyProfilePermissions];
