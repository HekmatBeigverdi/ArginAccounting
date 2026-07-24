import {
  SqlFilterBuilder
} from "../data-access/index.ts";

import type {
  BuiltSqlFilter
} from "../data-access/index.ts";

export type BuiltApprovalQuery =
  BuiltSqlFilter;

export class ApprovalQueryBuilder {
  private readonly builder =
    new SqlFilterBuilder();

  whereEquals(
    column: string,
    value: unknown
  ): this {
    this.builder.equals(
      column,
      value
    );

    return this;
  }

  whereFrom(
    column: string,
    value?: string
  ): this {
    this.builder.greaterThanOrEqual(
      column,
      value
    );

    return this;
  }

  whereTo(
    column: string,
    value?: string
  ): this {
    this.builder.lessThanOrEqual(
      column,
      value
    );

    return this;
  }

  whereAnyLike(
    columns: readonly string[],
    value?: string
  ): this {
    this.builder.anyLike(
      columns,
      value
    );

    return this;
  }

  build(): BuiltApprovalQuery {
    return this.builder.build();
  }
}
