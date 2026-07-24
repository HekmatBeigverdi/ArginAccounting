export class AsyncMutex {
  private tail:
    Promise<void> = Promise.resolve();

  async runExclusive<T>(
    action: () => Promise<T>
  ): Promise<T> {
    let release:
      (() => void) | undefined;

    const previous =
      this.tail;

    this.tail =
      new Promise<void>(
        (resolve) => {
          release = resolve;
        }
      );

    await previous;

    try {
      return await action();
    } finally {
      release?.();
    }
  }
}
