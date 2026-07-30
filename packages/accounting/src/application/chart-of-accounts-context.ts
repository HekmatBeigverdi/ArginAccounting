import type { CorrelationContext } from "@argin/platform";

export interface ChartOfAccountsActor {
  readonly type: "user" | "system" | "integration";
  readonly id: string | null;
  readonly displayName: string;
}

export interface ChartOfAccountsContext {
  readonly actor: ChartOfAccountsActor;
  readonly correlation?: CorrelationContext;
  readonly source?: "desktop" | "web" | "api" | "system" | "integration";
}

