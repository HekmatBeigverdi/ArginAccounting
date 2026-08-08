export const codingTemplatePermissions = Object.freeze({
  view: "accounting.coding-template.view",
  create: "accounting.coding-template.create",
  updateDraft: "accounting.coding-template.update-draft",
  publish: "accounting.coding-template.publish",
  retire: "accounting.coding-template.retire",
  preview: "accounting.coding-template.preview",
  apply: "accounting.coding-template.apply",
  upgrade: "accounting.coding-template.upgrade",
  import: "accounting.coding-template.import",
  history: "accounting.coding-template.history",
  manageBuiltIn: "system.accounting.coding-template.manage-built-in",
} as const);

export type CodingTemplatePermission =
  (typeof codingTemplatePermissions)[keyof typeof codingTemplatePermissions];
