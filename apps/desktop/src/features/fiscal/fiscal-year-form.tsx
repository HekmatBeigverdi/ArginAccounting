import {
  type FormEvent,
  useEffect,
  useState
} from "react";

import type {
  Company
} from "@argin/company";

import {
  SqliteCompanyRepository
} from "@argin/company-tauri";

import {
  createFiscalYear,
  FiscalValidationError,
  type FiscalPeriodDraft
} from "@argin/fiscal";

import {
  SqliteFiscalUnitOfWork
} from "@argin/fiscal-tauri";

import {
  getDesktopDatabase
} from "@argin/database-tauri";

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

function createSinglePeriod(
  form: FiscalFormState
): FiscalPeriodDraft[] {
  return [
    {
      sequence: 1,
      code: "01",
      title: "دوره اصلی",
      startDate: form.startDate,
      endDate: form.endDate
    }
  ];
}

export function FiscalYearForm() {
  const [form, setForm] =
    useState<FiscalFormState>(initialState);

  const [companies, setCompanies] =
    useState<Company[]>([]);

  const [errors, setErrors] =
    useState<string[]>([]);

  const [message, setMessage] =
    useState("");

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  useEffect(() => {
    async function loadCompanies(): Promise<void> {
      const database = await getDesktopDatabase();

      const repository =
        new SqliteCompanyRepository(database);

      const records = await repository.findAll();

      setCompanies(records);

      if (
        form.companyId.length === 0 &&
        records[0]
      ) {
        setForm((current) => ({
          ...current,
          companyId: records[0]?.id ?? ""
        }));
      }
    }

    void loadCompanies();
  }, [form.companyId]);

  function updateField<K extends keyof FiscalFormState>(
    field: K,
    value: FiscalFormState[K]
  ): void {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();

    setErrors([]);
    setMessage("");
    setIsSubmitting(true);

    try {
      const database = await getDesktopDatabase();

      const unitOfWork =
        new SqliteFiscalUnitOfWork(database);

      await createFiscalYear(unitOfWork, {
        companyId: form.companyId,
        code: form.code,
        title: form.title,
        startDate: form.startDate,
        endDate: form.endDate,
        makeCurrent: form.makeCurrent,
        periods: createSinglePeriod(form)
      });

      setMessage(
        "سال مالی با موفقیت ایجاد شد."
      );
    } catch (error) {
      if (error instanceof FiscalValidationError) {
        setErrors(
          error.issues.map((issue) => issue.message)
        );
      } else {
        console.error(error);

        setErrors([
          "ایجاد سال مالی با خطا مواجه شد."
        ]);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className="fiscal-form"
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
    >
      <header>
        <h2>تعریف سال مالی</h2>

        <p>
          تاریخ‌ها در دیتابیس به صورت میلادی استاندارد
          ذخیره و در رابط نهایی به صورت هجری شمسی
          نمایش داده می‌شوند.
        </p>
      </header>

      <label>
        شرکت
        <select
          value={form.companyId}
          onChange={(event) => {
            updateField(
              "companyId",
              event.target.value
            );
          }}
        >
          <option value="">
            انتخاب شرکت
          </option>

          {companies.map((company) => (
            <option
              key={company.id}
              value={company.id}
            >
              {company.legalName}
            </option>
          ))}
        </select>
      </label>

      <label>
        کد سال مالی
        <input
          value={form.code}
          onChange={(event) => {
            updateField(
              "code",
              event.target.value
            );
          }}
        />
      </label>

      <label>
        عنوان سال مالی
        <input
          value={form.title}
          onChange={(event) => {
            updateField(
              "title",
              event.target.value
            );
          }}
        />
      </label>

      <label>
        تاریخ شروع
        <input
          type="date"
          value={form.startDate}
          onChange={(event) => {
            updateField(
              "startDate",
              event.target.value
            );
          }}
        />
      </label>

      <label>
        تاریخ پایان
        <input
          type="date"
          value={form.endDate}
          onChange={(event) => {
            updateField(
              "endDate",
              event.target.value
            );
          }}
        />
      </label>

      <label className="fiscal-form-check">
        <input
          type="checkbox"
          checked={form.makeCurrent}
          onChange={(event) => {
            updateField(
              "makeCurrent",
              event.target.checked
            );
          }}
        />

        انتخاب به عنوان سال مالی جاری
      </label>

      {errors.length > 0 && (
        <div className="fiscal-form-errors">
          {errors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      )}

      {message && (
        <p className="fiscal-form-success">
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={
          isSubmitting ||
          companies.length === 0
        }
      >
        {isSubmitting
          ? "در حال ایجاد..."
          : "ایجاد سال مالی"}
      </button>
    </form>
  );
}
