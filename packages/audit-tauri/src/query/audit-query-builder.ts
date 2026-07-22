export class AuditQueryBuilder {

  private readonly where: string[] = [];

  private readonly params: unknown[] = [];

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

    this.where.push(
      `${column} = ?`
    );

    this.params.push(value);

    return this;
  }

  whereLike(
    column: string,
    value?: string
  ): this {

    if (!value?.trim()) {
      return this;
    }

    this.where.push(
      `${column} LIKE ?`
    );

    this.params.push(
      `%${value}%`
    );

    return this;
  }

  whereFrom(
    column: string,
    value?: string
  ): this {

    if (!value) {
      return this;
    }

    this.where.push(
      `${column} >= ?`
    );

    this.params.push(value);

    return this;
  }

  whereTo(
    column: string,
    value?: string
  ): this {

    if (!value) {
      return this;
    }

    this.where.push(
      `${column} <= ?`
    );

    this.params.push(value);

    return this;
  }

  buildWhere(): string {

    if (
      this.where.length === 0
    ) {
      return "";
    }

    return (
      " WHERE " +
      this.where.join(" AND ")
    );

  }

  parameters(): unknown[] {

    return [...this.params];

  }

}
