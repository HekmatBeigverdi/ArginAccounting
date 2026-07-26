/**
 * Domain-neutral platform contracts and implementations.
 *
 * Business modules may depend on this package, but this package must not
 * depend on accounting, company, fiscal, security, audit, or UI modules.
 */

export * from "./common/index.ts";
export * from "./events/index.ts";
export * from "./messaging/index.ts";
export * from "./metadata/index.ts";
export * from "./money/index.ts";
export * from "./number-series/index.ts";
