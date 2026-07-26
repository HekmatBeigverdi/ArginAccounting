import type {
  EntityMetadata,
  FieldMetadata,
} from "./metadata.ts";

export interface MetadataRegistry {
  register(metadata: EntityMetadata): void;

  get(entityType: string): EntityMetadata | undefined;

  require(entityType: string): EntityMetadata;

  has(entityType: string): boolean;

  list(): readonly EntityMetadata[];

  getField(
    entityType: string,
    fieldName: string,
  ): FieldMetadata | undefined;
}
