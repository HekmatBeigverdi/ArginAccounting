export interface Clock {
  now(): Date;
  nowIso(): string;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }

  nowIso(): string {
    return this.now().toISOString();
  }
}

export class FixedClock implements Clock {
  readonly #fixedDate: Date;

  constructor(fixedDate: Date | string) {
    const parsedDate =
      fixedDate instanceof Date
        ? new Date(fixedDate.getTime())
        : new Date(fixedDate);

    if (Number.isNaN(parsedDate.getTime())) {
      throw new TypeError("FixedClock requires a valid date.");
    }

    this.#fixedDate = parsedDate;
  }

  now(): Date {
    return new Date(this.#fixedDate.getTime());
  }

  nowIso(): string {
    return this.#fixedDate.toISOString();
  }
}
