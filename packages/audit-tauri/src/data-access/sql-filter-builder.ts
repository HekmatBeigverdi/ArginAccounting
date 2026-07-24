export interface BuiltSqlFilter {
  whereSql: string;
  parameters: unknown[];
}

function escapeLikePattern(
  value: string
): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_");
}

function hasValue(
  value: unknown
): boolean {
  return (
    value !== undefined &&
    value !== null &&
    value !== ""
  );
}

export class SqlFilterBuilder {
  private readonly conditions: string[] = [];
  private readonly values: unknown[] = [];

  equals(
    column: string,
    value: unknown
  ): this {
    if (!hasValue(value)) {
      return this;
    }

    this.conditions.push(
      `${column} = ?`
    );

    this.values.push(value);

    return this;
  }

  notEquals(
    column: string,
    value: unknown
  ): this {
    if (!hasValue(value)) {
      return this;
    }

    this.conditions.push(
      `${column} <> ?`
    );

    this.values.push(value);

    return this;
  }

  isNull(
    column: string,
    enabled = true
  ): this {
    if (!enabled) {
      return this;
    }

    this.conditions.push(
      `${column} IS NULL`
    );

    return this;
  }

  isNotNull(
    column: string,
    enabled = true
  ): this {
    if (!enabled) {
      return this;
    }

    this.conditions.push(
      `${column} IS NOT NULL`
    );

    return this;
  }

  greaterThanOrEqual(
    column: string,
    value: unknown
  ): this {
    if (!hasValue(value)) {
      return this;
    }

    this.conditions.push(
      `${column} >= ?`
    );

    this.values.push(value);

    return this;
  }

  lessThanOrEqual(
    column: string,
    value: unknown
  ): this {
    if (!hasValue(value)) {
      return this;
    }

    this.conditions.push(
      `${column} <= ?`
    );

    this.values.push(value);

    return this;
  }

  like(
    column: string,
    value?: string
  ): this {
    const normalizedValue =
      value?.trim();

    if (!normalizedValue) {
      return this;
    }

    this.conditions.push(
      `${column} LIKE ? ESCAPE '\\'`
    );

    this.values.push(
      `%${escapeLikePattern(
        normalizedValue
      )}%`
    );

    return this;
  }

  anyLike(
    columns: readonly string[],
    value?: string
  ): this {
    const normalizedValue =
      value?.trim();

    if (
      !normalizedValue ||
      columns.length === 0
    ) {
      return this;
    }

    const condition = columns
      .map(
        (column) =>
          `${column} LIKE ? ESCAPE '\\'`
      )
      .join(" OR ");

    this.conditions.push(
      `(${condition})`
    );

    const parameter =
      `%${escapeLikePattern(
        normalizedValue
      )}%`;

    for (
      let index = 0;
      index < columns.length;
      index += 1
    ) {
      this.values.push(parameter);
    }

    return this;
  }

  inValues(
    column: string,
    values:
      | readonly unknown[]
      | undefined
  ): this {
    const filteredValues =
      values?.filter(hasValue) ?? [];

    if (filteredValues.length === 0) {
      return this;
    }

    const placeholders =
      filteredValues
        .map(() => "?")
        .join(", ");

    this.conditions.push(
      `${column} IN (${placeholders})`
    );

    this.values.push(
      ...filteredValues
    );

    return this;
  }

  raw(
    condition: string,
    parameters:
      readonly unknown[] = []
  ): this {
    const normalizedCondition =
      condition.trim();

    if (!normalizedCondition) {
      return this;
    }

    this.conditions.push(
      normalizedCondition
    );

    this.values.push(
      ...parameters
    );

    return this;
  }

  build(): BuiltSqlFilter {
    return {
      whereSql:
        this.conditions.length === 0
          ? ""
          : ` WHERE ${this.conditions.join(
              " AND "
            )}`,
      parameters: [...this.values]
    };
  }
}
