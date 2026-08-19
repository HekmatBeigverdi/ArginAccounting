import { useMemo, useState } from "react";

import {
  companyActivityTypeLabels,
  companyProfilePermissions,
  type CompanyActivityType,
  CompanyValidationError,
  updateCompanyActivityType
} from "@argin/company";
import { SqliteCompanyUnitOfWork } from "@argin/company-tauri";
import { getDesktopDatabase } from "@argin/database-tauri";

import { useActiveContext } from "../../app/providers/active-context-provider";
import { useAuthSession } from "../../app/providers/auth-session-provider";
import { Badge } from "../../components/data-display";
import { Feedback } from "../../components/feedback";
import { Button, Field, Select } from "../../components/forms";
import { Card, Page, Panel } from "../../components/layout";
import { CompanySetupForm } from "../../features/company/company-setup-form";

import "./company-workspace.css";

export function CompanySetupPage() {
  const context = useActiveContext();
  const { session } = useAuthSession();
  const [showCreate, setShowCreate] = useState(context.companies.length === 0);
  const [activityType, setActivityType] = useState<CompanyActivityType>(
    context.activeCompany?.activityType ?? "custom"
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const permissions = useMemo(
    () => new Set(session?.user.permissions ?? []),
    [session]
  );
  const hasFullAccess = permissions.has("system.full-access");
  const canUpdateActivity =
    hasFullAccess || permissions.has(companyProfilePermissions.updateActivityType);

  const activeCompany = context.activeCompany;

  function selectCompany(companyId: string, nextActivityType: CompanyActivityType): void {
    setMessage("");
    setError("");
    setActivityType(nextActivityType);
    context.setCompanyId(companyId);
    setShowCreate(false);
  }

  async function saveActivityType(): Promise<void> {
    if (!activeCompany || !canUpdateActivity) return;
    setIsSaving(true);
    setMessage("");
    setError("");

    try {
      const database = await getDesktopDatabase();
      const unitOfWork = new SqliteCompanyUnitOfWork(database);
      await updateCompanyActivityType(
        unitOfWork,
        {
          hasPermission(permission) {
            return Promise.resolve(hasFullAccess || permissions.has(permission));
          }
        },
        {
          companyId: activeCompany.id,
          activityType
        }
      );
      await context.refresh();
      context.setCompanyId(activeCompany.id);
      setMessage("نوع فعالیت شرکت با موفقیت به‌روزرسانی شد. پیشنهاد الگوی کدینگ فقط پس از پیش‌نمایش و تأیید قابل اعمال است.");
    } catch (reason) {
      if (reason instanceof CompanyValidationError) {
        setError(reason.issues.map((issue) => issue.message).join(" "));
      } else {
        setError(
          reason instanceof Error
            ? reason.message
            : "به‌روزرسانی اطلاعات شرکت انجام نشد."
        );
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Page className="company-workspace">
      <header className="company-workspace__header">
        <div>
          <h2>شرکت‌ها و شعب</h2>
          <p>انتخاب شرکت، مشاهده شعب موجود و ثبت شرکت جدید در یک فضای کاری یکپارچه.</p>
        </div>
        <Button
          type="button"
          variant={showCreate ? "default" : "primary"}
          onClick={() => setShowCreate((current) => !current)}
        >
          {showCreate ? "بازگشت به اطلاعات شرکت" : "تعریف شرکت جدید"}
        </Button>
      </header>

      {context.error ? <Feedback tone="error">{context.error}</Feedback> : null}
      {error ? <Feedback tone="error">{error}</Feedback> : null}
      {message ? <Feedback tone="success">{message}</Feedback> : null}

      {showCreate ? (
        <Panel className="company-workspace__create-panel">
          <div className="company-workspace__panel-title">
            <h3>تعریف شرکت و دفتر مرکزی</h3>
            <p>ثبت اولیه شرکت، دفتر مرکزی و اطلاعات اختیاری مالیاتی.</p>
          </div>
          <CompanySetupForm
            onCreated={async (result) => {
              await context.refresh();
              context.setCompanyId(result.companyId);
              setShowCreate(false);
              setMessage("شرکت جدید ایجاد شد و به‌عنوان شرکت فعال انتخاب شد.");
            }}
          />
        </Panel>
      ) : (
        <div className="company-workspace__grid">
          <Panel>
            <div className="company-workspace__panel-title">
              <h3>فهرست شرکت‌ها</h3>
              <p>{context.companies.length} شرکت ثبت‌شده</p>
            </div>

            {context.companies.length === 0 ? (
              <Feedback tone="info">هنوز شرکتی ثبت نشده است.</Feedback>
            ) : (
              <div className="company-workspace__list">
                {context.companies.map((company) => (
                  <button
                    key={company.id}
                    type="button"
                    className={[
                      "company-workspace__company-button",
                      company.id === context.companyId
                        ? "company-workspace__company-button--active"
                        : ""
                    ].filter(Boolean).join(" ")}
                    aria-pressed={company.id === context.companyId}
                    onClick={() => selectCompany(company.id, company.activityType)}
                  >
                    <strong>{company.legalName}</strong>
                    <span>{company.code} · {companyActivityTypeLabels[company.activityType]}</span>
                  </button>
                ))}
              </div>
            )}
          </Panel>

          <div className="company-workspace__details">
            {!activeCompany ? (
              <Feedback tone="info">
                برای مشاهده اطلاعات، یک شرکت را از فهرست انتخاب کنید یا شرکت جدیدی بسازید.
              </Feedback>
            ) : (
              <>
                <Card
                  header={
                    <>
                      <div>
                        <h3>{activeCompany.legalName}</h3>
                        <p>{activeCompany.tradeName || "بدون نام تجاری"}</p>
                      </div>
                      <Badge tone={activeCompany.status === "active" ? "success" : "neutral"}>
                        {activeCompany.status === "active" ? "فعال" : "غیرفعال"}
                      </Badge>
                    </>
                  }
                >
                  <div className="company-workspace__summary-grid">
                    <div className="company-workspace__summary-item">
                      <span>کد شرکت</span>
                      <strong dir="ltr">{activeCompany.code}</strong>
                    </div>
                    <div className="company-workspace__summary-item">
                      <span>شناسه ملی</span>
                      <strong dir="ltr">{activeCompany.nationalId || "—"}</strong>
                    </div>
                    <div className="company-workspace__summary-item">
                      <span>شماره ثبت</span>
                      <strong dir="ltr">{activeCompany.registrationNumber || "—"}</strong>
                    </div>
                    <div className="company-workspace__summary-item">
                      <span>ارز پایه</span>
                      <strong>ریال ایران</strong>
                    </div>
                    <div className="company-workspace__summary-item">
                      <span>زبان و تقویم</span>
                      <strong>فارسی · شمسی</strong>
                    </div>
                    <div className="company-workspace__summary-item">
                      <span>تعداد شعب</span>
                      <strong>{context.branches.length}</strong>
                    </div>
                  </div>
                </Card>

                <Card header={<h3>نوع فعالیت و الگوی کدینگ</h3>}>
                  <div className="company-workspace__activity-form">
                    <Field
                      label="نوع فعالیت"
                      hint="تغییر نوع فعالیت فقط پیشنهاد الگوی کدینگ را تغییر می‌دهد و کدینگ بدون پیش‌نمایش و تأیید اعمال نمی‌شود."
                    >
                      <Select
                        value={activityType}
                        disabled={!canUpdateActivity || isSaving}
                        onChange={(event) => setActivityType(event.target.value as CompanyActivityType)}
                      >
                        {Object.entries(companyActivityTypeLabels).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </Select>
                    </Field>
                    <Button
                      type="button"
                      variant="primary"
                      disabled={!canUpdateActivity || isSaving || activityType === activeCompany.activityType}
                      onClick={() => { void saveActivityType(); }}
                    >
                      {isSaving ? "در حال ذخیره..." : "ذخیره نوع فعالیت"}
                    </Button>
                  </div>
                  {!canUpdateActivity ? (
                    <Feedback tone="warning">مجوز تغییر نوع فعالیت شرکت را ندارید.</Feedback>
                  ) : null}
                </Card>

                <Card header={<h3>شعب شرکت</h3>}>
                  {context.branches.length === 0 ? (
                    <Feedback tone="info">برای این شرکت شعبه‌ای ثبت نشده است.</Feedback>
                  ) : (
                    <div className="company-workspace__branches">
                      {context.branches.map((branch) => (
                        <div key={branch.id} className="company-workspace__branch-row">
                          <div className="company-workspace__branch-name">
                            <strong>{branch.name}</strong>
                            <small>کد {branch.code}</small>
                          </div>
                          {branch.isHeadOffice ? <Badge tone="info">دفتر مرکزی</Badge> : <Badge>شعبه</Badge>}
                          <Badge tone={branch.status === "active" ? "success" : "neutral"}>
                            {branch.status === "active" ? "فعال" : "غیرفعال"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </>
            )}
          </div>
        </div>
      )}
    </Page>
  );
}
