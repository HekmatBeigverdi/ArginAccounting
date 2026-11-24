import { type PropsWithChildren, useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { currentMonitor } from "@tauri-apps/api/window";

import {
  ActiveContextProvider
} from "./app/providers/active-context-provider";

import {
  AuthSessionProvider
} from "./app/providers/auth-session-provider";

import {
  DisplayDensityProvider
} from "./app/providers/display-density-provider";

import {
  SecurityBootstrapProvider
} from "./app/providers/security-bootstrap-provider";

import {
  AppRouter
} from "./app/router/app-router";

import { DesktopTitleBar } from "./components/desktop/desktop-title-bar";

import {
  AuditProvider
} from "./composition/audit";

import {
  AccountingProvider
} from "./composition/accounting/accounting-provider";

import {
  InventoryWarehouseIntegrationProvider
} from "./composition/warehouse/inventory-warehouse-integration-provider";

import {
  PlatformProvider
} from "./platform";

import "./styles/design-tokens.css";
import "./components/ui.css";
import "./App.css";
import "./styles/persian-date-isolation.css";
import "./styles/accessibility.css";
import "./pages/product/products-page-tokens.css";

function App() {
  return (
    <div className="desktop-root">
      <DesktopTitleBar />
      <div className="desktop-root__content">
        <DisplayResolutionGuard>
          <PlatformProvider>
            <SecurityBootstrapProvider>
              <AuthSessionProvider>
                <AuditProvider>
                  <AccountingProvider>
                    <InventoryWarehouseIntegrationProvider>
                      <ActiveContextProvider>
                        <DisplayDensityProvider>
                          <AppRouter />
                        </DisplayDensityProvider>
                      </ActiveContextProvider>
                    </InventoryWarehouseIntegrationProvider>
                  </AccountingProvider>
                </AuditProvider>
              </AuthSessionProvider>
            </SecurityBootstrapProvider>
          </PlatformProvider>
        </DisplayResolutionGuard>
      </div>
    </div>
  );
}

const MIN_DISPLAY_WIDTH = 1360;
const MIN_DISPLAY_HEIGHT = 768;

function DisplayResolutionGuard({ children }: PropsWithChildren) {
  const [isChecking, setIsChecking] = useState(true);
  const [displaySize, setDisplaySize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function checkDisplayResolution(): Promise<void> {
      let width = window.screen.width * window.devicePixelRatio;
      let height = window.screen.height * window.devicePixelRatio;

      if (isTauri()) {
        try {
          const monitor = await currentMonitor();
          if (monitor) {
            width = monitor.size.width;
            height = monitor.size.height;
          }
        } catch (error) {
          console.error("Could not read monitor resolution:", error);
        }
      }

      if (isMounted) {
        setDisplaySize({ width: Math.round(width), height: Math.round(height) });
        setIsChecking(false);
      }
    }

    void checkDisplayResolution();
    return () => {
      isMounted = false;
    };
  }, []);

  if (isChecking || !displaySize) {
    return (
      <main className="application-bootstrap" lang="fa" dir="rtl">
        <section className="application-bootstrap__card">
          <h1>آرگین</h1>
          <p>در حال بررسی وضوح نمایشگر...</p>
        </section>
      </main>
    );
  }

  if (displaySize.width < MIN_DISPLAY_WIDTH || displaySize.height < MIN_DISPLAY_HEIGHT) {
    return (
      <main className="application-bootstrap" lang="fa" dir="rtl">
        <section className="application-bootstrap__card application-resolution-card" role="alert">
          <h1>وضوح نمایشگر پشتیبانی نمی‌شود</h1>
          <p>این برنامه فقط در رزولوشن ۱۳۶۰ × ۷۶۸ پیکسل یا بالاتر قابل اجراست.</p>
          <p className="application-resolution-card__current">
            رزولوشن فعلی: {displaySize.width.toLocaleString("fa-IR")} × {displaySize.height.toLocaleString("fa-IR")}
          </p>
        </section>
      </main>
    );
  }

  return children;
}

export default App;
