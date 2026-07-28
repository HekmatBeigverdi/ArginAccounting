import {
  DuplicateFieldMetadataError,
} from "./metadata-errors.ts";
import type {
  EntityMetadata,
  FieldMetadata,
  MetadataOption,
} from "./metadata.ts";

const supportedValueTypes = new Set([
  "string",
  "integer",
  "decimal",
  "boolean",
  "date",
  "date-time",
  "money",
  "identifier",
  "enum",
  "reference",
  "json",
]);

export function normalizeEntityMetadata(
  metadata: EntityMetadata,
): EntityMetadata {
  const entityType = normalizeQualifiedName(
    metadata.entityType,
    "entityType",
  );

  const moduleName = normalizeModuleName(
    metadata.moduleName,
  );

  const label = normalizeRequiredText(
    metadata.label,
    "label",
  );

  if (!entityType.startsWith(`${moduleName}.`)) {
    throw new TypeError(
      `Metadata entityType "${entityType}" must use ` +
      `the module prefix "${moduleName}".`,
    );
  }

  const fieldNames = new Set<string>();

  const fields = metadata.fields.map((field) => {
    const normalized = normalizeFieldMetadata(field);

    if (fieldNames.has(normalized.fieldName)) {
      throw new DuplicateFieldMetadataError(
        entityType,
        normalized.fieldName,
      );
    }

    fieldNames.add(normalized.fieldName);
    return normalized;
  });

  const pluralLabel = normalizeOptionalText(
    metadata.pluralLabel,
  );
  const description = normalizeOptionalText(
    metadata.description,
  );
  const tags = normalizeStringList(metadata.tags);
  const extensions = freezeRecord(
    metadata.extensions,
  );

  return Object.freeze({
    entityType,
    moduleName,
    label,
    fields: Object.freeze(fields),
    ...(pluralLabel === undefined
      ? {}
      : { pluralLabel }),
    ...(description === undefined
      ? {}
      : { description }),
    ...(tags === undefined ? {} : { tags }),
    ...(extensions === undefined
      ? {}
      : { extensions }),
  });
}

export function normalizeEntityType(
  entityType: string,
): string {
  return normalizeQualifiedName(
    entityType,
    "entityType",
  );
}

export function normalizeFieldName(
  fieldName: string,
): string {
  const normalized = fieldName.trim();

  if (
    !/^[a-z][a-zA-Z0-9]*$/.test(normalized)
  ) {
    throw new TypeError(
      "Metadata fieldName must use lower camelCase notation.",
    );
  }

  return normalized;
}

function normalizeFieldMetadata(
  field: FieldMetadata,
): FieldMetadata {
  const fieldName = normalizeFieldName(
    field.fieldName,
  );

  const label = normalizeRequiredText(
    field.label,
    `fields.${fieldName}.label`,
  );

  if (!supportedValueTypes.has(field.valueType)) {
    throw new TypeError(
      `Unsupported metadata valueType ` +
      `"${String(field.valueType)}".`,
    );
  }

  if (
    field.valueType === "reference" &&
    field.referenceType === undefined
  ) {
    throw new TypeError(
      `Reference field "${fieldName}" must define ` +
      "referenceType.",
    );
  }

  if (
    field.referenceType !== undefined &&
    field.valueType !== "reference"
  ) {
    throw new TypeError(
      `Only reference fields may define referenceType.`,
    );
  }

  if (
    field.options !== undefined &&
    field.valueType !== "enum"
  ) {
    throw new TypeError(
      `Only enum fields may define options.`,
    );
  }

  if (
    field.valueType === "enum" &&
    (
      field.options === undefined ||
      field.options.length === 0
    )
  ) {
    throw new TypeError(
      `Enum field "${fieldName}" must define options.`,
    );
  }

  if (
    field.order !== undefined &&
    (
      !Number.isSafeInteger(field.order) ||
      field.order < 0
    )
  ) {
    throw new RangeError(
      `Metadata field order must be a non-negative ` +
      `safe integer.`,
    );
  }

  const description = normalizeOptionalText(
    field.description,
  );
  const referenceType =
    field.referenceType === undefined
      ? undefined
      : normalizeQualifiedName(
          field.referenceType,
          "referenceType",
        );
  const options = normalizeOptions(field.options);
  const tags = normalizeStringList(field.tags);
  const extensions = freezeRecord(field.extensions);

  return Object.freeze({
    fieldName,
    label,
    valueType: field.valueType,
    required: field.required ?? false,
    readOnly: field.readOnly ?? false,
    searchable: field.searchable ?? false,
    sortable: field.sortable ?? false,
    filterable: field.filterable ?? false,
    hidden: field.hidden ?? false,
    custom: field.custom ?? false,
    order: field.order ?? 0,
    ...(description === undefined
      ? {}
      : { description }),
    ...(referenceType === undefined
      ? {}
      : { referenceType }),
    ...(options === undefined ? {} : { options }),
    ...(tags === undefined ? {} : { tags }),
    ...(extensions === undefined
      ? {}
      : { extensions }),
  });
}

function normalizeOptions(
  options: readonly MetadataOption[] | undefined,
): readonly MetadataOption[] | undefined {
  if (options === undefined) {
    return undefined;
  }

  const values = new Set<string>();

  const normalized = options.map((option) => {
    const value = normalizeRequiredText(
      option.value,
      "option.value",
    );

    if (values.has(value)) {
      throw new TypeError(
        `Metadata option value "${value}" is duplicated.`,
      );
    }

    values.add(value);

    const description = normalizeOptionalText(
      option.description,
    );

    return Object.freeze({
      value,
      label: normalizeRequiredText(
        option.label,
        "option.label",
      ),
      ...(description === undefined
        ? {}
        : { description }),
    });
  });

  return Object.freeze(normalized);
}

function normalizeQualifiedName(
  value: string,
  fieldName: string,
): string {
  const normalized = value.trim();

  if (
    !/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/.test(
      normalized,
    )
  ) {
    throw new TypeError(
      `Metadata ${fieldName} must use lowercase ` +
      "module-prefixed dot-separated notation.",
    );
  }

  return normalized;
}

function normalizeModuleName(
  moduleName: string,
): string {
  const normalized = moduleName.trim();

  if (!/^[a-z][a-z0-9-]*$/.test(normalized)) {
    throw new TypeError(
      "Metadata moduleName must use lowercase notation.",
    );
  }

  return normalized;
}

function normalizeRequiredText(
  value: string,
  fieldName: string,
): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new TypeError(
      `Metadata ${fieldName} must not be empty.`,
    );
  }

  return normalized;
}

function normalizeOptionalText(
  value: string | undefined,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length === 0
    ? undefined
    : normalized;
}

function normalizeStringList(
  values: readonly string[] | undefined,
): readonly string[] | undefined {
  if (values === undefined) {
    return undefined;
  }

  const normalized = [
    ...new Set(
      values
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  ];

  return Object.freeze(normalized);
}

function freezeRecord(
  value:
    | Readonly<Record<string, unknown>>
    | undefined,
): Readonly<Record<string, unknown>> | undefined {
  if (value === undefined) {
    return undefined;
  }

  return Object.freeze({
    ...value,
  });
}
