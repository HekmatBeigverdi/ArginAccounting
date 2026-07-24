import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

import {
  getDesktopDatabase
} from "@argin/database-tauri";

import {
  DatabaseExecutorAdapter
} from "@argin/audit-tauri";

import {
  useAuthSession
} from "../../app/providers/auth-session-provider";

import {
  createAuditServices,
  type AuditServices
} from "./create-audit-services";

const AuditServicesContext = createContext<
  AuditServices | undefined
>(undefined);

type ProviderStatus = "loading" | "ready" | "error";

export function AuditProvider({
  children
}: PropsWithChildren) {
  const { session } = useAuthSession();
  const [database, setDatabase] = useState<
    Awaited<ReturnType<typeof getDesktopDatabase>> | null
  >(null);
  const [status, setStatus] =
    useState<ProviderStatus>("loading");
  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    let isMounted = true;

    async function initialize(): Promise<void> {
      try {
        const loadedDatabase =
          await getDesktopDatabase();

        if (isMounted) {
          setDatabase(loadedDatabase);
          setStatus("ready");
        }
      } catch (error) {
        console.error(
          "Audit composition initialization failed:",
          error
        );

        if (isMounted) {
          setErrorMessage(
            "راه‌اندازی زیرساخت گردش تأیید و ممیزی با خطا مواجه شد."
          );
          setStatus("error");
        }
      }
    }

    void initialize();

    return () => {
      isMounted = false;
    };
  }, []);

  const services = useMemo(() => {
    if (database === null) {
      return null;
    }

    const adapter =
      new DatabaseExecutorAdapter(database);

    return createAuditServices(adapter, session);
  }, [database, session]);

  if (status === "error") {
    return (
      <main className="application-bootstrap">
        <section className="application-bootstrap__card">
          <h1>خطای راه‌اندازی</h1>
          <p>{errorMessage}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
          >
            تلاش مجدد
          </button>
        </section>
      </main>
    );
  }

  if (status === "loading" || services === null) {
    return (
      <main className="application-bootstrap">
        <section className="application-bootstrap__card">
          <h1>نرم‌افزار حسابداری شرکتی آرگین</h1>
          <p>
            در حال آماده‌سازی گردش تأیید و زیرساخت ممیزی...
          </p>
        </section>
      </main>
    );
  }

  return (
    <AuditServicesContext.Provider value={services}>
      {children}
    </AuditServicesContext.Provider>
  );
}

export function useAuditServices(): AuditServices {
  const services = useContext(AuditServicesContext);

  if (services === undefined) {
    throw new Error(
      "useAuditServices must be used inside AuditProvider."
    );
  }

  return services;
}
