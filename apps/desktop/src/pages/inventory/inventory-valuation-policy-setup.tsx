import { useEffect, useState } from "react";
import { getDesktopDatabase } from "@argin/database-tauri";
import { inventoryValuationPermissions } from "@argin/inventory/valuation-security";
import type { InventoryBootstrapValuationMethod } from "@argin/inventory-tauri";
import { useActiveContext } from "../../app/providers/active-context-provider";
import { useAuthSession } from "../../app/providers/auth-session-provider";
import { useAuditServices } from "../../composition/audit";
import {
  createInventoryValuationWorkspaceServices,
  type InventoryValuationWorkspaceServices,
} from "../../composition/inventory/create-inventory-valuation-workspace-services";
import { Feedback } from "../../components/feedback";
import { PersianDatePicker } from "../../components/forms";
import "./inventory-valuation-policy-setup.css";

export function InventoryValuationPolicySetup({
  services,
  onCompleted,
}: {
  services?: InventoryValuationWorkspaceServices;
  onCompleted: () => Promise<void> | void;
}) {
  const activeContext = useActiveContext();
  const { session } = useAuthSession();
  const audit = useAuditServices();
  const [method, setMethod] = useState<InventoryBootstrapValuationMethod>("fifo");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [earliestMovementDate, setEarliestMovementDate] = useState<string | null>(null);

  const permissions = session?.user.permissions ?? [];
  const branchIds = session?.user.branchIds ?? [];
  const canManage =
    permissions.includes("system.full-access") ||
    permissions.includes(inventoryValuationPermissions.policyManage);

  useEffect(() => {
    if (!activeContext.companyId) return;
    void getDesktopDatabase()
      .then(async (db) => {
        const row = await db.queryOne<{ d: string | null }>(
          "SELECT MIN(business_date) d FROM inventory_all_stock_movements WHERE company_id=?",
          [activeContext.companyId],
        );
        const firstDate = row?.d ?? null;
        setEarliestMovementDate(firstDate);
        if (firstDate) setEffectiveFrom(firstDate);
      })
      .catch((caughtError) =>
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "خواندن اولین تاریخ گردش ناموفق بود.",
        ),
      );
  }, [activeContext.companyId]);

  async function submit(): Promise<void> {
    if (!activeContext.companyId || !effectiveFrom || !canManage) return;
    setSaving(true);
    setError("");
    const requestId = crypto.randomUUID();
    const occurredAt = new Date().toISOString();
    const actorId = session?.user.id ?? "desktop-local-user";

    try {
      const valuationServices =
        services ??
        createInventoryValuationWorkspaceServices(
          await getDesktopDatabase(),
          permissions,
          branchIds,
        );
      const result = await valuationServices.initializePolicy({
        companyId: activeContext.companyId,
        method,
        effectiveFrom,
        actorId,
        requestId,
        occurredAt,
      });

      try {
        await audit.recordAuditEntry({
          id: `inventory-valuation:inventory.valuation.policy.initial-set:${requestId}:inventory-valuation-policy:${result.policyId}`,
          occurredAt,
          action: "create",
          outcome: "success",
          source: "desktop",
          actor: { type: "user", id: actorId, displayName: actorId },
          scope: {
            companyId: activeContext.companyId,
            branchId: null,
            fiscalYearId: null,
          },
          target: {
            entityType: "inventory-valuation-policy",
            entityId: result.policyId,
            entityDisplayName: `${result.method}@${result.effectiveFrom}`,
          },
          message: "inventory.valuation.policy.initial-set",
          reason: "Initial company inventory valuation policy activation",
          before: null,
          after: {
            method: result.method,
            effectiveFrom: result.effectiveFrom,
            revision: result.revision,
            valuedMovementCount: result.valuedMovementCount,
            skippedReversalPairCount: result.skippedReversalPairCount,
            productCount: result.productCount,
          },
          correlationId: requestId,
          metadata: {
            requestId,
            valuationAction: "inventory.valuation.policy.initial-set",
          },
        });
      } catch (auditError) {
        console.error("Inventory valuation policy Audit write failed", auditError);
        setError(
          "سیاست و بازسازی ارزش‌گذاری ثبت شد، اما ثبت رویداد ممیزی با خطا مواجه شد. قبل از عملیات مالی بعدی لاگ ممیزی را بررسی کنید.",
        );
      }

      await onCompleted();
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "ایجاد سیاست اولیه ارزش‌گذاری ناموفق بود.";

      if (message.startsWith("VALUATION_BOOTSTRAP_UNRESOLVED_COST:")) {
        setError(
          "پیش از فعال‌کردن سیاست، بهای همه ورودی‌های فعال را در تب «نیازمند بررسی» تعیین کنید. رسیدهای برگشت‌خورده در این کنترل محاسبه نمی‌شوند.",
        );
      } else if (
        message.startsWith("VALUATION_BOOTSTRAP_EFFECTIVE_DATE_AFTER_FIRST_MOVEMENT:")
      ) {
        setError(
          "تاریخ شروع سیاست اولیه باید برابر یا قبل از اولین گردش موجودی شرکت باشد.",
        );
      } else if (message.startsWith("VALUATION_BOOTSTRAP_NEGATIVE_STOCK")) {
        setError(
          "در بازسازی ارزش‌گذاری، خروج بیشتر از موجودی قابل ارزش‌گذاری مشاهده شد. ابتدا گردش مقداری را بررسی کنید.",
        );
      } else if (message.startsWith("VALUATION_BOOTSTRAP_TRANSFER_PAIR_INVALID:")) {
        setError(
          "یکی از انتقال‌های بین انبار ناقص یا نامتوازن است. انتقال باید دقیقاً یک Movement خروجی و یک Movement ورودی هم‌مقدار برای همان کالا و همان سند داشته باشد. ابتدا سند انتقال را بررسی کنید.",
        );
      } else if (
        message === "VALUATION_BOOTSTRAP_MWA_REVERSAL_REQUIRES_FULL_RECALCULATION_ENGINE"
      ) {
        setError(
          "در گردش قبلی سند برگشتی وجود دارد. برای میانگین موزون متحرک، ورود و برگشت می‌توانند میانگین تاریخی را تغییر دهند؛ بنابراین سیستم به‌جای محاسبه حدسی، این بازسازی اولیه را متوقف کرده است. برای تست فعلی از FIFO استفاده کنید؛ پشتیبانی کامل این سناریو باید از موتور Reverse Valuation/Recalculation انجام شود.",
        );
      } else {
        setError(message);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="valuation-section valuation-policy-setup">
      <div className="valuation-section__head">
        <div>
          <h3>تعیین سیاست اولیه ارزش‌گذاری</h3>
          <p>
            این انتخاب در سطح شرکت انجام می‌شود. پس از شروع ارزش‌گذاری، روش
            به‌صورت مستقیم قابل تغییر نیست و تغییرات بعدی باید از مسیر انتقال
            کنترل‌شده سیاست انجام شوند.
          </p>
        </div>
      </div>

      {error && <Feedback tone="error">{error}</Feedback>}

      <div className="valuation-policy-setup__grid">
        <label>
          روش ارزش‌گذاری
          <select
            value={method}
            onChange={(event) =>
              setMethod(event.target.value as InventoryBootstrapValuationMethod)
            }
            disabled={!canManage || saving}
          >
            <option value="fifo">FIFO — اولین وارده، اولین صادره</option>
            <option value="moving_average">میانگین موزون متحرک</option>
          </select>
        </label>

        <label>
          تاریخ شروع سیاست
          <PersianDatePicker
            value={effectiveFrom}
            onChange={setEffectiveFrom}
            ariaLabel="تاریخ شروع سیاست ارزش‌گذاری"
          />
          {earliestMovementDate && (
            <small>
              برای شرکت دارای گردش قبلی، پیشنهاد امن سیستم همان تاریخ اولین
              گردش موجودی است.
            </small>
          )}
        </label>
      </div>

      <p className="valuation-note">
        با ثبت سیاست اولیه، Cost Inputهای قبلی و Movementهای معتبر از تاریخ
        شروع بازسازی می‌شوند. انتقال‌های معتبر بین انبار نیز با حفظ دقیق بهای
        حمل‌شده بازپخش می‌شوند؛ در FIFO لایه‌های مصرف‌شده به مقصد منتقل می‌شوند
        و انتقال به‌تنهایی سود یا زیان ایجاد نمی‌کند. جفت‌های برگشت کامل که اثر
        نهایی ندارند از کاندید بهای دستی حذف می‌شوند.
      </p>

      <div className="valuation-policy-setup__actions">
        <button
          className="valuation-primary-action"
          disabled={!canManage || saving || !effectiveFrom}
          onClick={() => void submit()}
        >
          {saving
            ? "در حال بازسازی ارزش‌گذاری…"
            : "ثبت سیاست و بازسازی ارزش‌گذاری"}
        </button>
        {!canManage && (
          <span className="valuation-muted">
            برای این عملیات مجوز مدیریت سیاست ارزش‌گذاری لازم است.
          </span>
        )}
      </div>
    </section>
  );
}
