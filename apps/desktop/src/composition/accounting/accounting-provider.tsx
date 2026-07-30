import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

import {
  ChartOfAccountsService,
  type AccountUsageReader,
  type ChartOfAccountsAuthorizer
} from "@argin/accounting";
import { SqliteAccountingUnitOfWork } from "@argin/accounting-tauri";
import { getDesktopDatabase } from "@argin/database-tauri";

import { useAuthSession } from "../../app/providers/auth-session-provider";
import { usePlatform } from "../../platform";

interface AccountingServices {
  readonly chartOfAccounts: ChartOfAccountsService;
}

const AccountingContext = createContext<AccountingServices | undefined>(
  undefined
);

const pendingJournalUsageReader: AccountUsageReader = {
  async hasFinancialActivity(): Promise<boolean> {
    return false;
  }
};

export function AccountingProvider({ children }: PropsWithChildren) {
  const platform = usePlatform();
  const { session } = useAuthSession();
  const [database, setDatabase] = useState<
    Awaited<ReturnType<typeof getDesktopDatabase>> | null
  >(null);
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
        return permissions.has(permission);
      }
    };

    return {
      chartOfAccounts: new ChartOfAccountsService(
        new SqliteAccountingUnitOfWork(database),
        platform.clock,
        platform.idGenerator,
        pendingJournalUsageReader,
        authorizer,
        platform.eventBus,
        {
          actor: session === null
            ? {
                type: "system",
                id: null,
                displayName: "کاربر محلی"
              }
            : {
                type: "user",
                id: session.user.id,
                displayName: session.user.displayName
              },
          source: "desktop"
        }
      )
    };
  }, [
    database,
    platform.clock,
    platform.eventBus,
    platform.idGenerator,
    session
  ]);

  if (failed) {
    return (
      <main className="application-bootstrap" dir="rtl">
        <section className="application-bootstrap__card" role="alert">
          <h1>خطای راه‌اندازی کدینگ حساب‌ها</h1>
          <p>اتصال رابط کدینگ به پایگاه داده محلی برقرار نشد.</p>
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
          <p>در حال آماده‌سازی کدینگ حساب‌ها…</p>
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
      "useAccountingServices must be used inside AccountingProvider."
    );
  }
  return services;
}
