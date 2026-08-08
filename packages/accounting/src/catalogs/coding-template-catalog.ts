import type { CodingTemplateActivityType } from "../domain/coding-template.ts";
import type { CodingTemplateVersionContent } from "../domain/coding-template-items.ts";

export interface CodingTemplateCatalog {
  readonly templateCode:
    | "iran-service-default"
    | "iran-trading-default"
    | "iran-manufacturing-default";
  readonly activityType: Exclude<CodingTemplateActivityType, "custom">;
  readonly version: 1;
  readonly contractVersion: "1.0";
  readonly persianName: string;
  readonly englishName: string;
  readonly content: Readonly<CodingTemplateVersionContent>;
}
