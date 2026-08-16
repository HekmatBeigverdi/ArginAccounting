import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AccountingDimensionsService,
  ChartOfAccountsService,
  JournalBackedAccountingDimensionUsageReader,
  JournalBackedAccountUsageReader,
  type AccountingDimensionSelectorService,
  type ChartOfAccountsAuthorizer,
} from "@argin/accounting";
import {
  SqliteAccountingDimensionSelectorService,
  SqliteAccountingDimensionUsageReader,
  SqliteAccountingUnitOfWork,
  SqliteJournalVoucherUsageReader,
} from "@argin/accounting-tauri";
import { getDesktopDatabase } from "@argin/database-tauri";

import { useAuthSession } from "../../app/providers/auth-session-provider";
import { usePlatform } from "../../platform";
import { createCodingTemplateServices, type CodingTemplateServices } from "./create-coding-template-services";
import {
  createJournalVoucherServices,
  type JournalVoucherDesktopServices,
} from "./create-journal-voucher-services";

interface AccountingServices {
  readonly chartOfAccounts: ChartOfAccountsService;
  readonly dimensions: AccountingDimensionsService;
  readonly dimensionSelector: AccountingDimensionSelectorService;
  readonly codingTemplates: CodingTemplateServices;
  readonly journals: JournalVoucherDesktopServices;
}

const AccountingContext = createContext<AccountingServices | undefined>(
  undefined,
);

export function AccountingProvider({ children }: PropsWithChildren) {
  const platform = usePlatform();
  const { session } = useAuthSession();
  const [database, setDatabase] = useState<Awaited<
    ReturnType<typeof getDesktopDatabase>
  > | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;

    void getDesktopDatabase()
      .then((value) => {
        if (mounted) setDatabase(value);
      })
      .catch((error: unknown) => {
        console.error("Accounting composition failed:", error);
        if (mounted) setFailed(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const services = useMemo<AccountingServices | null>(() => {
    if (database === null) return null;

    const permissions = new Set(session?.user.permissions ?? []);
    const authorizer: ChartOfAccountsAuthorizer = {
      async hasPermission(permission: string): Promise<boolean> {
        return permissions.has("system.full-access") || permissions.has(permission);
      },
    };

    const unitOfWork = new SqliteAccountingUnitOfWork(database);
    const journalUsage = new SqliteJournalVoucherUsageReader(database);
    const accountUsage = new JournalBackedAccountUsageReader(journalUsage);
    const dimensionUsage = new JournalBackedAccountingDimensionUsageReader(
      journalUsage,
      new SqliteAccountingDimensionUsageReader(database),
    );
    const context = {
      actor:
        session === null
          ? {
              type: "system" as const,
              id: null,
              displayName: "کاربر محلی",
            }
          : {
              type: "user" as const,
              id: session.user.id,
              displayName: session.user.displayName,
            },
      source: "desktop" as const,
    };

    return {
      chartOfAccounts: new ChartOfAccountsService(
        unitOfWork,
        platform.clock,
        platform.idGenerator,
        accountUsage,
        authorizer,
        platform.eventBus,
        context,
      ),
      dimensions: new AccountingDimensionsService(
        unitOfWork,
        platform.clock,
        platform.idGenerator,
        dimensionUsage,
        authorizer,
        platform.eventBus,
        context,
      ),
      dimensionSelector: new SqliteAccountingDimensionSelectorService(
        database,
      ),
      codingTemplates: createCodingTemplateServices({
        database,
        clock: platform.clock,
        idGenerator: platform.idGenerator,
        eventBus: platform.eventBus,
        authorizer,
        actorId: session?.user.id ?? "desktop-local-user",
      }),
      journals: createJournalVoucherServices({
        database,
        clock: platform.clock,
        idGenerator: platform.idGenerator,
        eventBus: platform.eventBus,
        authorizer,
      }),
    };
  }, [
    database,
    platform.clock,
    platform.eventBus,
    platform.idGenerator,
    session,
  ]);

  if (failed) {
    return (
      <main className="application-bootstrap" dir="rtl">
        <section className="application-bootstrap__card" role="alert">
          <h1>خطای راه‌اندازی حسابداری</h1>
          <p>اتصال سرویس‌های حسابداری به پایگاه داده محلی برقرار نشد.</p>
          <button type="button" onClick={() => window.location.reload()}>
            تلاش مجدد
          </button>
        </section>
      </main>
    );
  }

  if (services === null) {
    return (
      <main className="application-bootstrap" dir="rtl">
        <section className="application-bootstrap__card">
          <h1>نرم‌افزار حسابداری شرکتی آرگین</h1>
          <p>در حال آماده‌سازی سرویس‌های حسابداری…</p>
        </section>
      </main>
    );
  }

  return (
    <AccountingContext.Provider value={services}>
      {children}
    </AccountingContext.Provider>
  );
}

export function useAccountingServices(): AccountingServices {
  const services = useContext(AccountingContext);
  if (services === undefined) {
    throw new Error(
      "useAccountingServices must be used inside AccountingProvider.",
    );
  }
  return services;
}
