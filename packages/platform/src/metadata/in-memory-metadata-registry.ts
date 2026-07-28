import {
  DuplicateMetadataError,
  MetadataNotFoundError,
} from "./metadata-errors.ts";
import type {
  MetadataRegistry,
} from "./metadata-registry.ts";
import type {
  EntityMetadata,
  FieldMetadata,
} from "./metadata.ts";
import {
  normalizeEntityMetadata,
  normalizeEntityType,
  normalizeFieldName,
} from "./metadata-validation.ts";

export class InMemoryMetadataRegistry
  implements MetadataRegistry {
  readonly #entities =
    new Map<string, EntityMetadata>();

  constructor(
    metadataEntries:
      readonly EntityMetadata[] = [],
  ) {
    for (const metadata of metadataEntries) {
      this.register(metadata);
    }
  }

  register(metadata: EntityMetadata): void {
    const normalized =
      normalizeEntityMetadata(metadata);

    if (
      this.#entities.has(normalized.entityType)
    ) {
      throw new DuplicateMetadataError(
        normalized.entityType,
      );
    }

    this.#entities.set(
      normalized.entityType,
      normalized,
    );
  }

  get(
    entityType: string,
  ): EntityMetadata | undefined {
    return this.#entities.get(
      normalizeEntityType(entityType),
    );
  }

  require(entityType: string): EntityMetadata {
    const normalized =
      normalizeEntityType(entityType);

    const metadata =
      this.#entities.get(normalized);

    if (metadata === undefined) {
      throw new MetadataNotFoundError(normalized);
    }

    return metadata;
  }

  has(entityType: string): boolean {
    return this.#entities.has(
      normalizeEntityType(entityType),
    );
  }

  list(): readonly EntityMetadata[] {
    return [...this.#entities.values()].sort(
      (left, right) =>
        left.entityType.localeCompare(
          right.entityType,
        ),
    );
  }

  getField(
    entityType: string,
    fieldName: string,
  ): FieldMetadata | undefined {
    const metadata = this.get(entityType);

    if (metadata === undefined) {
      return undefined;
    }

    const normalizedFieldName =
      normalizeFieldName(fieldName);

    return metadata.fields.find(
      (field) =>
        field.fieldName === normalizedFieldName,
    );
  }

  get entityCount(): number {
    return this.#entities.size;
  }

  clear(): void {
    this.#entities.clear();
  }
}
