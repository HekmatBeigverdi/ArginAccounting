import type { DomainEvent } from "@argin/platform";
import type { CodingTemplateCatalog } from "../catalogs/coding-template-catalog.ts";
import type { CodingTemplateActivityType } from "../domain/coding-template.ts";

export interface CodingTemplateCatalogProvider {
  findByCode(code: string): Promise<Readonly<CodingTemplateCatalog> | null>;
  listPublished(): Promise<readonly Readonly<CodingTemplateCatalog>[]>;
  recommendForActivityType(
    activityType: CodingTemplateActivityType,
  ): Promise<readonly Readonly<CodingTemplateCatalog>[]>;
}

export interface CodingTemplateClock {
  now(): Date;
}

export interface CodingTemplateIdentifierGenerator {
  generate(): string;
}

export interface CodingTemplateAuthorizer {
  hasPermission(permission: string): Promise<boolean>;
}

export interface CodingTemplateEventPublisher {
  publish(event: DomainEvent): Promise<void>;
  publishMany(events: readonly DomainEvent[]): Promise<void>;
}
