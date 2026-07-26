export type MetadataValueType =
  | "string"
  | "integer"
  | "decimal"
  | "boolean"
  | "date"
  | "date-time"
  | "money"
  | "identifier"
  | "enum"
  | "reference"
  | "json";

export interface MetadataOption {
  readonly value: string;
  readonly label: string;
  readonly description?: string;
}

export interface FieldMetadata {
  readonly fieldName: string;
  readonly label: string;
  readonly description?: string;
  readonly valueType: MetadataValueType;
  readonly required?: boolean;
  readonly readOnly?: boolean;
  readonly searchable?: boolean;
  readonly sortable?: boolean;
  readonly filterable?: boolean;
  readonly hidden?: boolean;
  readonly custom?: boolean;
  readonly order?: number;
  readonly referenceType?: string;
  readonly options?: readonly MetadataOption[];
  readonly tags?: readonly string[];
  readonly extensions?: Readonly<Record<string, unknown>>;
}

export interface EntityMetadata {
  readonly entityType: string;
  readonly label: string;
  readonly pluralLabel?: string;
  readonly description?: string;
  readonly moduleName: string;
  readonly fields: readonly FieldMetadata[];
  readonly tags?: readonly string[];
  readonly extensions?: Readonly<Record<string, unknown>>;
}
