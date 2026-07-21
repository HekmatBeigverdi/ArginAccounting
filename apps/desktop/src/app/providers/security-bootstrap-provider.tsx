import {
  type PropsWithChildren,
  useEffect,
  useState
} from "react";

import {
  bootstrapSecurity
} from "@argin/security";

import {
  SqliteSecurityUnitOfWork
} from "@argin/security-tauri";

import {
  getDesktopDatabase
} from "@argin/database-tauri";

type BootstrapStatus =
  | "loading"
  | "ready"
  | "error";

export function SecurityBootstrapProvider({
  children
}: PropsWithChildren) {
  const [status, setStatus] =
    useState<BootstrapStatus>("loading");

  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    let isMounted = true;

    async function initialize(): Promise<void> {
      try {
        const database =
          await getDesktopDatabase();

        const unitOfWork =
          new SqliteSecurityUnitOfWork(
            database
          );

        await bootstrapSecurity(unitOfWork);

        if (isMounted) {
          setStatus("ready");
        }
      } catch (error) {
        console.error(
          "Security bootstrap failed:",
          error
        );

        if (isMounted) {
          setErrorMessage(
            "راه‌اندازی زیرساخت امنیتی با خطا مواجه شد."
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

  if (status === "loading") {
    return (
      <main className="application-bootstrap">
        <section className="application-bootstrap__card">
          <h1>ArginAccounting</h1>

          <p>
            در حال آماده‌سازی زیرساخت امنیتی...
          </p>
        </section>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="application-bootstrap">
        <section className="application-bootstrap__card">
          <h1>خطای راه‌اندازی</h1>

          <p>{errorMessage}</p>

          <button
            type="button"
            onClick={() => {
              window.location.reload();
            }}
          >
            تلاش مجدد
          </button>
        </section>
      </main>
    );
  }

  return children;
}
