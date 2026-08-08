import {
  companyActivityTypes,
  type CompanyActivityType
} from "./company.ts";

export const companyActivityTypeLabels: Readonly<
  Record<CompanyActivityType, string>
> = Object.freeze({
  service: "خدماتی",
  trading: "بازرگانی",
  manufacturing: "تولیدی",
  custom: "سایر / کدینگ سفارشی"
});

export interface CodingTemplateRecommendation {
  readonly activityType: Exclude<CompanyActivityType, "custom">;
  readonly templateCode:
    | "iran-service-default"
    | "iran-trading-default"
    | "iran-manufacturing-default";
}

export function isCompanyActivityType(
  value: unknown
): value is CompanyActivityType {
  return typeof value === "string" &&
    companyActivityTypes.includes(value as CompanyActivityType);
}

export function recommendCodingTemplate(
  activityType: CompanyActivityType
): CodingTemplateRecommendation | null {
  switch (activityType) {
    case "service":
      return {
        activityType,
        templateCode: "iran-service-default"
      };
    case "trading":
      return {
        activityType,
        templateCode: "iran-trading-default"
      };
    case "manufacturing":
      return {
        activityType,
        templateCode: "iran-manufacturing-default"
      };
    case "custom":
      return null;
  }
}
