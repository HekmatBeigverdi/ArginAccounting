import {
  createContext,
  type PropsWithChildren,
  useCallback,
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
  createJournalLifecycleServices,
  type JournalLifecycleDesktopServices,
} from "./create-journal-lifecycle-services";
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
  readonly journalLifecycle: JournalLifecycleDesktopServices;
}

const AccountingContext = createContext<AccountingServices | undefined>(undefined);

export function AccountingProvider({ children }: PropsWithChildren) {
  const platform = usePlatform();
  const { session } = useAuthSession();
  const [database, setDatabase] = useState<Awaited<ReturnType<typeof getDesktopDatabase>> | null>(null);
  const [failed, setFailed] = useState(false);
  const [dataRevision, setDataRevision] = useState(0);
  const invalidateAccountingData = useCallback(() => {
    setDataRevision((current) => current + 1);
  }, []);

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

    const journalServices = createJournalVoucherServices({
      database,
      clock: platform.clock,
      idGenerator: platform.idGenerator,
      eventBus: platform.eventBus,
      authorizer,
    });
    const lifecycleServices = createJournalLifecycleServices({
      database,
      clock: platform.clock,
      idGenerator: platform.idGenerator,
      eventBus: platform.eventBus,
      notificationService: platform.notificationService,
      authorizer,
    });

    const journals: JournalVoucherDesktopServices = Object.freeze({
      ...journalServices,
      create: (command) => runAccountingMutation(
        () => journalServices.create(command),
        invalidateAccountingData,
      ),
      update: (command) => runAccountingMutation(
        () => journalServices.update(command),
        invalidateAccountingData,
      ),
      delete: (command) => runAccountingMutation(
        () => journalServices.delete(command),
        invalidateAccountingData,
      ),
    });

    const journalLifecycle: JournalLifecycleDesktopServices = Object.freeze({
      ...lifecycleServices,
      submit: (command) => runAccountingMutation(
        () => lifecycleServices.submit(command),
        invalidateAccountingData,
      ),
      decide: (command) => runAccountingMutation(
        () => lifecycleServices.decide(command),
        invalidateAccountingData,
      ),
      post: (command) => runAccountingMutation(
        () => lifecycleServices.post(command),
        invalidateAccountingData,
      ),
      reverse: (command) => runAccountingMutation(
        () => lifecycleServices.reverse(command),
        invalidateAccountingData,
      ),
    });

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
      dimensionSelector: new SqliteAccountingDimensionSelectorService(database),
      codingTemplates: createCodingTemplateServices({
        database,
        clock: platform.clock,
        idGenerator: platform.idGenerator,
        eventBus: platform.eventBus,
        authorizer,
        actorId: session?.user.id ?? "desktop-local-user",
      }),
      journals,
      journalLifecycle,
    };
  }, [
    dataRevision,
    database,
    invalidateAccountingData,
    platform.clock,
    platform.eventBus,
    platform.idGenerator,
    platform.notificationService,
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
    throw new Error("useAccountingServices must be used inside AccountingProvider.");
  }
  return services;
}

async function runAccountingMutation<T>(
  mutation: () => Promise<T>,
  invalidate: () => void,
): Promise<T> {
  try {
    const result = await mutation();
    invalidate();
    return result;
  } catch (error) {
    if (isCommittedLifecycleFailure(error)) invalidate();
    throw error;
  }
}

function isCommittedLifecycleFailure(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as {
    code?: unknown;
    details?: { committed?: unknown };
  };
  return (
    candidate.code === "journal.post-commit-effects-failed" &&
    candidate.details?.committed === true
  );
}
