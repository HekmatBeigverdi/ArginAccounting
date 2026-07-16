import {
  useEffect,
  useState
} from "react";

import type {
  DatabaseHealth
} from "@argin/database";

import {
  checkDatabaseHealth,
  getDesktopDatabase
} from "@argin/database-tauri";

export type DatabaseStatus =
  | {
      state: "loading";
    }
  | {
      state: "ready";
      health: DatabaseHealth;
    }
  | {
      state: "error";
      message: string;
    };

export function useDatabaseStatus(): DatabaseStatus {
  const [status, setStatus] = useState<DatabaseStatus>({
    state: "loading"
  });

  useEffect(() => {
    let isActive = true;

    async function initializeDatabase(): Promise<void> {
      try {
        const database = await getDesktopDatabase();
        const health = await checkDatabaseHealth(database);

        if (!isActive) {
          return;
        }

        setStatus({
          state: "ready",
          health
        });
      } catch (error) {
        console.error("Database initialization failed.", error);

        if (!isActive) {
          return;
        }

        setStatus({
          state: "error",
          message:
            "اتصال به پایگاه داده محلی امکان‌پذیر نیست."
        });
      }
    }

    void initializeDatabase();

    return () => {
      isActive = false;
    };
  }, []);

  return status;
}
