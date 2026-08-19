import { type FormEvent, useEffect, useState } from "react";

import type { Company } from "@argin/company";
import { SqliteCompanyRepository } from "@argin/company-tauri";
import {
  createFiscalYear,
  FiscalValidationError,
  type FiscalPeriodDraft
} from "@argin/fiscal";
import { SqliteFiscalUnitOfWork } from "@argin/fiscal-tauri";
import { getDesktopDatabase } from "@argin/database-tauri";

import { Feedback } from "../../components/feedback";
import { Button, Field, Input, Select } from "../../components/forms";

interface FiscalFormState {
  companyId: string;
  code: string;
  title: string;
  startDate: string;
  endDate: string;
  makeCurrent: boolean;
}

const initialState: FiscalFormState = {
  companyId: "",
  code: "1405",
  title: "سال مالی ۱۴۰۵",
  startDate: "2026-03-21",
  endDate: "2027-03-20",
  makeCurrent: true
};

function createSinglePeriod(form: FiscalFormState): FiscalPeriodDraft[] {
  return [{
    sequence: 1,
    code: "01",
    title: "دوره اصلی",
    startDate: form.startDate,
    endDate: form.endDate
  }];
}

interface FiscalYearFormProps {
  companyId?: string;
  onCreated?(fiscalYearId: string): void | Promise<void>;
}

export function FiscalYearForm({ companyId, onCreated }: FiscalYearFormProps) {
  const [form, setForm] = useState<FiscalFormState>({
    ...initialState,
    companyId: companyId ?? ""
  });
  const [companies, setCompanies] = useState<Company[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getDesktopDatabase()
      .then((database) => new SqliteCompanyRepository(database).findAll())
      .then((records) => {
        if (cancelled) return;
        setCompanies(records);
        setForm((current) => ({
          ...current,
          companyId:
            companyId && records.some((item) => item.id === companyId)
              ? companyId
              : records.some((item) => item.id === current.companyId)
                ? current.companyId
                : records[0]?.id ?? ""
        }));
      })
      .catch(() => {
        if (!cancelled) setErrors(["دریافت فهرست شرکت‌ها با خطا مواجه شد."]);
      });
    return () => { cancelled = true; };
  }, [companyId]);

  function updateField<K extends keyof FiscalFormState>(
    field: K,
    value: FiscalFormState[K]
  ): void {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setErrors([]);
    setMessage("");
    setIsSubmitting(true);

    try {
      const database = await getDesktopDatabase();
      const unitOfWork = new SqliteFiscalUnitOfWork(database);
      const result = await createFiscalYear(unitOfWork, {
        companyId: form.companyId,
        code: form.code,
        title: form.title,
        startDate: form.startDate,
        endDate: form.endDate,
        makeCurrent: form.makeCurrent,
        periods: createSinglePeriod(form)
      });
      setMessage("سال مالی با موفقیت ایجاد شد.");
      await onCreated?.(result.fiscalYearId);
    } catch (error) {
      if (error instanceof FiscalValidationError) {
        setErrors(error.issues.map((issue) => issue.message));
      } else {
        setErrors(["ایجاد سال مالی با خطا مواجه شد."]);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className="fiscal-form"
      onSubmit={(event) => { void handleSubmit(event); }}
    >
      <header className="fiscal-form__header">
        <h2>تعریف سال مالی</h2>
        <p>
          تاریخ ورودی به صورت میلادی استاندارد ذخیره می‌شود؛ نمایش سال‌ها و دوره‌های ثبت‌شده در فضای کاری به صورت هجری شمسی است.
        </p>
      </header>

      <div className="fiscal-form__grid">
        <Field label="شرکت">
          <Select
            value={form.companyId}
            onChange={(event) => updateField("companyId", event.target.value)}
            disabled={Boolean(companyId)}
          >
            <option value="">انتخاب شرکت</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>{company.legalName}</option>
            ))}
          </Select>
        </Field>

        <Field label="کد سال مالی">
          <Input value={form.code} onChange={(event) => updateField("code", event.target.value)} />
        </Field>

        <Field label="عنوان سال مالی">
          <Input value={form.title} onChange={(event) => updateField("title", event.target.value)} />
        </Field>

        <Field label="تاریخ شروع" hint="فرمت ذخیره‌سازی: YYYY-MM-DD">
          <Input type="date" value={form.startDate} onChange={(event) => updateField("startDate", event.target.value)} />
        </Field>

        <Field label="تاریخ پایان" hint="فرمت ذخیره‌سازی: YYYY-MM-DD">
          <Input type="date" value={form.endDate} onChange={(event) => updateField("endDate", event.target.value)} />
        </Field>
      </div>

      <label className="fiscal-form__check">
        <Input
          type="checkbox"
          checked={form.makeCurrent}
          onChange={(event) => updateField("makeCurrent", event.target.checked)}
        />
        <span>انتخاب به عنوان سال مالی جاری</span>
      </label>

      {errors.length > 0 ? (
        <Feedback tone="error">
          {errors.map((error) => <div key={error}>{error}</div>)}
        </Feedback>
      ) : null}
      {message ? <Feedback tone="success">{message}</Feedback> : null}

      <div className="fiscal-form__actions">
        <Button
          type="submit"
          variant="primary"
          disabled={isSubmitting || companies.length === 0 || !form.companyId}
        >
          {isSubmitting ? "در حال ایجاد..." : "ایجاد سال مالی"}
        </Button>
      </div>
    </form>
  );
}
