import { useEffect, useState, type PropsWithChildren } from "react";
import { registerWarehouseDependencyGuard } from "@argin/warehouse";
import { InventoryWarehouseDependencyGuard } from "@argin/inventory-tauri";
import { getDesktopDatabase } from "@argin/database-tauri";

/**
 * Desktop is the composition root where the Phase 19 Warehouse dependency port is
 * connected to the Phase 20 Inventory implementation. Children are rendered only
 * after registration, so destructive Warehouse/Zone/Location actions cannot observe
 * the permissive pre-Inventory fallback during application startup.
 */
export function InventoryWarehouseIntegrationProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let registered = false;

    void getDesktopDatabase()
      .then((database) => {
        if (!active) return;
        registerWarehouseDependencyGuard(new InventoryWarehouseDependencyGuard(database));
        registered = true;
        setReady(true);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "راه‌اندازی کنترل وابستگی انبار و موجودی ناموفق بود.");
      });

    return () => {
      active = false;
      if (registered) registerWarehouseDependencyGuard(null);
    };
  }, []);

  if (error) {
    return <div role="alert" dir="rtl">راه‌اندازی ارتباط انبار و موجودی با خطا مواجه شد: {error}</div>;
  }
  if (!ready) {
    return <div role="status" dir="rtl">در حال آماده‌سازی کنترل وابستگی انبار و موجودی…</div>;
  }
  return children;
}
