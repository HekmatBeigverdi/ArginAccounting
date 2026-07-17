import {
  type FormEvent,
  useState
} from "react";

import {
  CompanyValidationError,
  setupCompany
} from "@argin/company";

import {
  SqliteCompanyUnitOfWork
} from "@argin/company-tauri";

import {
  getDesktopDatabase
} from "@argin/database-tauri";

interface FormState {
  companyCode: string;
  legalName: string;
  tradeName: string;
  nationalId: string;
  registrationNumber: string;
  branchCode: string;
  branchName: string;
  province: string;
  city: string;
  addressLine: string;
  postalCode: string;
  phone: string;
  economicCode: string;
  fiscalId: string;
}

const initialState: FormState = {
  companyCode: "MAIN",
  legalName: "",
  tradeName: "",
  nationalId: "",
  registrationNumber: "",
  branchCode: "01",
  branchName: "دفتر مرکزی",
  province: "",
  city: "",
  addressLine: "",
  postalCode: "",
  phone: "",
  economicCode: "",
  fiscalId: ""
};

export function CompanySetupForm() {
  const [form, setForm] = useState<FormState>(
    initialState
  );

  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] =
    useState(false);

  function updateField(
    field: keyof FormState,
    value: string
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

    setMessage("");
    setErrors([]);
    setIsSubmitting(true);

    try {
      const database = await getDesktopDatabase();

      const unitOfWork =
        new SqliteCompanyUnitOfWork(database);

      await setupCompany(unitOfWork, {
        company: {
          code: form.companyCode,
          legalName: form.legalName,
          tradeName: form.tradeName || null,
          nationalId: form.nationalId || null,
          registrationNumber:
            form.registrationNumber || null
        },
        headOffice: {
          code: form.branchCode,
          name: form.branchName
        },
        ...(form.addressLine
          ? {
              address: {
                province: form.province || null,
                city: form.city || null,
                addressLine: form.addressLine,
                postalCode: form.postalCode || null,
                phone: form.phone || null
              }
            }
          : {}),
        ...(
          form.economicCode || form.fiscalId
            ? {
                taxProfile: {
                  economicCode:
                    form.economicCode || null,
                  fiscalId: form.fiscalId || null,
                  sellerBranchCode: null,
                  taxpayerType: "legal",
                  isEnabled: false
                }
              }
            : {}
        )
      });

      setMessage("اطلاعات شرکت با موفقیت ثبت شد.");
    } catch (error) {
      if (error instanceof CompanyValidationError) {
        setErrors(
          error.issues.map((issue) => issue.message)
        );
      } else {
        console.error(error);

        setErrors([
          "ثبت اطلاعات شرکت با خطا مواجه شد."
        ]);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className="company-form"
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
    >
      <header>
        <h2>تعریف شرکت</h2>
        <p>
          اطلاعات پایه شرکت و دفتر مرکزی را وارد کنید.
        </p>
      </header>

      <fieldset>
        <legend>اطلاعات حقوقی شرکت</legend>

        <label>
          کد شرکت
          <input
            value={form.companyCode}
            onChange={(event) => {
              updateField(
                "companyCode",
                event.target.value
              );
            }}
          />
        </label>

        <label>
          نام قانونی شرکت
          <input
            value={form.legalName}
            onChange={(event) => {
              updateField(
                "legalName",
                event.target.value
              );
            }}
          />
        </label>

        <label>
          نام تجاری
          <input
            value={form.tradeName}
            onChange={(event) => {
              updateField(
                "tradeName",
                event.target.value
              );
            }}
          />
        </label>

        <label>
          شناسه ملی
          <input
            inputMode="numeric"
            value={form.nationalId}
            onChange={(event) => {
              updateField(
                "nationalId",
                event.target.value
              );
            }}
          />
        </label>

        <label>
          شماره ثبت
          <input
            value={form.registrationNumber}
            onChange={(event) => {
              updateField(
                "registrationNumber",
                event.target.value
              );
            }}
          />
        </label>
      </fieldset>

      <fieldset>
        <legend>دفتر مرکزی</legend>

        <label>
          کد شعبه
          <input
            value={form.branchCode}
            onChange={(event) => {
              updateField(
                "branchCode",
                event.target.value
              );
            }}
          />
        </label>

        <label>
          نام شعبه
          <input
            value={form.branchName}
            onChange={(event) => {
              updateField(
                "branchName",
                event.target.value
              );
            }}
          />
        </label>

        <label>
          استان
          <input
            value={form.province}
            onChange={(event) => {
              updateField(
                "province",
                event.target.value
              );
            }}
          />
        </label>

        <label>
          شهر
          <input
            value={form.city}
            onChange={(event) => {
              updateField(
                "city",
                event.target.value
              );
            }}
          />
        </label>

        <label className="company-form-wide">
          نشانی
          <textarea
            value={form.addressLine}
            onChange={(event) => {
              updateField(
                "addressLine",
                event.target.value
              );
            }}
          />
        </label>

        <label>
          کد پستی
          <input
            inputMode="numeric"
            value={form.postalCode}
            onChange={(event) => {
              updateField(
                "postalCode",
                event.target.value
              );
            }}
          />
        </label>

        <label>
          تلفن
          <input
            value={form.phone}
            onChange={(event) => {
              updateField(
                "phone",
                event.target.value
              );
            }}
          />
        </label>
      </fieldset>

      <fieldset>
        <legend>اطلاعات اولیه سامانه مودیان</legend>

        <p className="company-form-note">
          تکمیل این بخش در حال حاضر اختیاری است.
        </p>

        <label>
          شماره اقتصادی
          <input
            value={form.economicCode}
            onChange={(event) => {
              updateField(
                "economicCode",
                event.target.value
              );
            }}
          />
        </label>

        <label>
          شناسه حافظه مالیاتی
          <input
            value={form.fiscalId}
            onChange={(event) => {
              updateField(
                "fiscalId",
                event.target.value
              );
            }}
          />
        </label>
      </fieldset>

      {errors.length > 0 && (
        <div className="company-form-errors">
          {errors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      )}

      {message && (
        <p className="company-form-success">
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
      >
        {isSubmitting
          ? "در حال ثبت..."
          : "ثبت شرکت"}
      </button>
    </form>
  );
}
