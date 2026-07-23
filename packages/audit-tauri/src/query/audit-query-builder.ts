function escapeLikePattern(
  value: string
): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_");
}

export interface BuiltAuditQuery {
  whereSql: string;
  parameters: unknown[];
}

export class AuditQueryBuilder {
  private readonly conditions: string[] = [];
  private readonly values: unknown[] = [];

  whereEquals(
    column: string,
    value: unknown
  ): this {
    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      return this;
    }

    this.conditions.push(
      `${column} = ?`
    );

    this.values.push(value);

    return this;
  }

  whereFrom(
    column: string,
    value?: string
  ): this {
    if (!value?.trim()) {
      return this;
    }

    this.conditions.push(
      `${column} >= ?`
    );

    this.values.push(value);

    return this;
  }

  whereTo(
    column: string,
    value?: string
  ): this {
    if (!value?.trim()) {
      return this;
    }

    this.conditions.push(
      `${column} <= ?`
    );

    this.values.push(value);

    return this;
  }

  whereLike(
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
      `%${escapeLikePattern(normalizedValue)}%`
    );

    return this;
  }

  whereAnyLike(
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
      `%${escapeLikePattern(normalizedValue)}%`;

    for (let index = 0;
      index < columns.length;
      index += 1
    ) {
      this.values.push(parameter);
    }

    return this;
  }

  build(): BuiltAuditQuery {
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
