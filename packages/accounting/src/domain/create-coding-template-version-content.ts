import type { CodingTemplateVersionContent } from "./coding-template-items.ts";
import { CodingTemplateGraphValidationError } from "../validation/coding-template-graph-validation-error.ts";
import { validateCodingTemplateGraph } from "../validation/validate-coding-template-graph.ts";

export function createCodingTemplateVersionContent(
  input: CodingTemplateVersionContent,
): Readonly<CodingTemplateVersionContent> {
  const issues = validateCodingTemplateGraph(input);
  if (issues.length > 0) {
    throw new CodingTemplateGraphValidationError(issues);
  }

  return Object.freeze({
    accounts: freezeItems(input.accounts, true),
    dimensionTypes: freezeItems(input.dimensionTypes),
    dimensionMembers: freezeItems(input.dimensionMembers),
    accountDimensionPolicies: freezeItems(input.accountDimensionPolicies),
  });
}

function freezeItems<T extends object>(items: readonly T[], freezeNested = false): readonly Readonly<T>[] {
  return Object.freeze(items.map((item) => Object.freeze({
    ...item,
    ...(freezeNested && "reportClassification" in item
      ? {
          reportClassification: Object.freeze({
            ...(item as T & { reportClassification: object }).reportClassification,
            managementTags: Object.freeze([
              ...((item as T & { reportClassification: { managementTags: readonly string[] } }).reportClassification.managementTags),
            ]),
          }),
        }
      : {}),
  })));
}
