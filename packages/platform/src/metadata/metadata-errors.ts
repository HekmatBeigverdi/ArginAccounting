import { PlatformError } from "../common/index.ts";

export class MetadataNotFoundError
  extends PlatformError {
  readonly entityType: string;

  constructor(entityType: string) {
    super({
      code: "metadata.not-found",
      message:
        `No metadata is registered for entity ` +
        `"${entityType}".`,
      category: "not-found",
      details: {
        entityType,
      },
    });

    this.name = "MetadataNotFoundError";
    this.entityType = entityType;
  }
}

export class DuplicateMetadataError
  extends PlatformError {
  readonly entityType: string;

  constructor(entityType: string) {
    super({
      code: "metadata.duplicate-entity",
      message:
        `Metadata is already registered for entity ` +
        `"${entityType}".`,
      category: "conflict",
      details: {
        entityType,
      },
    });

    this.name = "DuplicateMetadataError";
    this.entityType = entityType;
  }
}

export class DuplicateFieldMetadataError
  extends PlatformError {
  readonly entityType: string;
  readonly fieldName: string;

  constructor(
    entityType: string,
    fieldName: string,
  ) {
    super({
      code: "metadata.duplicate-field",
      message:
        `Field metadata "${fieldName}" is duplicated ` +
        `for entity "${entityType}".`,
      category: "conflict",
      details: {
        entityType,
        fieldName,
      },
    });

    this.name = "DuplicateFieldMetadataError";
    this.entityType = entityType;
    this.fieldName = fieldName;
  }
}
