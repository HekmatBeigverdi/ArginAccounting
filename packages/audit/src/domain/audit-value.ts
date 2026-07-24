export type AuditPrimitive =
  | string
  | number
  | boolean
  | null;

export type AuditValue =
  | AuditPrimitive
  | AuditValue[]
  | {
      [key: string]: AuditValue;
    };

export type AuditSnapshot =
  Record<string, AuditValue>;
