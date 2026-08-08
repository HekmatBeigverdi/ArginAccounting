import {
  BUILT_IN_IRANIAN_CODING_CATALOGS,
  type CodingTemplateActivityType,
  type CodingTemplateCatalog,
  type CodingTemplateCatalogProvider,
} from "@argin/accounting";

export class BuiltInCodingTemplateCatalogProvider
  implements CodingTemplateCatalogProvider {
  async findByCode(
    code: string,
  ): Promise<Readonly<CodingTemplateCatalog> | null> {
    const normalized = code.trim().toLowerCase();
    return BUILT_IN_IRANIAN_CODING_CATALOGS.find(
      (catalog) => catalog.templateCode === normalized,
    ) ?? null;
  }

  async listPublished(): Promise<readonly Readonly<CodingTemplateCatalog>[]> {
    return BUILT_IN_IRANIAN_CODING_CATALOGS;
  }

  async recommendForActivityType(
    activityType: CodingTemplateActivityType,
  ): Promise<readonly Readonly<CodingTemplateCatalog>[]> {
    if (activityType === "custom") return Object.freeze([]);
    return Object.freeze(
      BUILT_IN_IRANIAN_CODING_CATALOGS.filter(
        (catalog) => catalog.activityType === activityType,
      ),
    );
  }
}
