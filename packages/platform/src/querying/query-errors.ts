import { PlatformError } from "../common/index.ts";

export class InvalidQueryError extends PlatformError {
  constructor(
    code: string,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super({
      code,
      message,
      category: "validation",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "InvalidQueryError";
  }
}
