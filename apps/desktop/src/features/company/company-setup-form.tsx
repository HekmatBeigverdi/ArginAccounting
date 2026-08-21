import {
  type FormEvent,
  useState
} from "react";

import {
  companyActivityTypeLabels,
  type CompanyActivityType,
  type CompanySetupResult,
  CompanyValidationError,
  setupCompany
} from "@argin/company";
import {
  SqliteCompanyUnitOfWork
} from "@argin/company-tauri";
import {
  getDesktopDatabase
} from "@argin/database-tauri";

import { Feedback } from "../../components/feedback";
import {
  Button,
  Field,
  Input,
  Select,
  Textarea
} from "../../components/forms";

interface FormState {
  companyCode: string;
  legalName: string;
  tradeName: string;
  nationalId: string;
  registrationNumber: string;
  activityType: CompanyActivityType;
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

interface CompanySetupFormProps {
  onCreated?(result: CompanySetupResult): void | Promise<void>;
}

const initialState: FormState = {
  companyCode: "MAIN",
  legalName: "",
  tradeName: "",
  nationalId: "",
  registrationNumber: "",
  activityType: "custom",
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

export function CompanySetupForm({ onCreated }: CompanySetupFormProps) {
  const [form, setForm] = useState<FormState>(initialState);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(field: keyof FormState, value: string): void {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setMessage("");
    setErrors([]);
    setIsSubmitting(true);

    try {
      const database = await getDesktopDatabase();
      const unitOfWork = new SqliteCompanyUnitOfWork(database);
      const result = await setupCompany(unitOfWork, {
        company: {
          code: form.companyCode,
          legalName: form.legalName,
          tradeName: form.tradeName || null,
          nationalId: form.nationalId || null,
          registrationNumber: form.registrationNumber || null,
          activityType: form.activityType
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
        ...(form.economicCode || form.fiscalId
          ? {
              taxProfile: {
                economicCode: form.economicCode || null,
                fiscalId: form.fiscalId || null,
                sellerBranchCode: null,
                taxpayerType: "legal" as const,
                isEnabled: false
              }
            }
          : {})
      });

      setMessage("اطلاعات شرکت و دفتر مرکزی با موفقیت ثبت شد.");
      await onCreated?.(result);
    } catch (error) {
      if (error instanceof CompanyValidationError) {
        setErrors(error.issues.map((issue) => issue.message));
      } else {
        setErrors([
          error instanceof Error
            ? error.message
            : "ثبت اطلاعات شرکت با خطا مواجه شد."
        ]);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className="company-setup-form"
      onSubmit={(event) => { void handleSubmit(event); }}
    >
      <fieldset className="company-setup-form__section">
        <legend>اطلاعات حقوقی شرکت</legend>
        <div className="company-setup-form__grid">
          <Field label="کد شرکت">
            <Input
              value={form.companyCode}
              onChange={(event) => updateField("companyCode", event.target.value)}
            />
          </Field>
          <Field label="نام قانونی شرکت">
            <Input
              value={form.legalName}
              onChange={(event) => updateField("legalName", event.target.value)}
            />
          </Field>
          <Field label="نام تجاری">
            <Input
              value={form.tradeName}
              onChange={(event) => updateField("tradeName", event.target.value)}
            />
          </Field>
          <Field
            label="نوع فعالیت شرکت"
            hint="این انتخاب فقط الگوی مناسب را پیشنهاد می‌دهد؛ اعمال کدینگ پس از پیش‌نمایش و تأیید جداگانه انجام می‌شود."
          >
            <Select
              value={form.activityType}
              onChange={(event) => updateField("activityType", event.target.value)}
            >
              {Object.entries(companyActivityTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </Field>
          <Field label="شناسه ملی">
            <Input
              inputMode="numeric"
              value={form.nationalId}
              onChange={(event) => updateField("nationalId", event.target.value)}
            />
          </Field>
          <Field label="شماره ثبت">
            <Input
              value={form.registrationNumber}
              onChange={(event) => updateField("registrationNumber", event.target.value)}
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className="company-setup-form__section">
        <legend>دفتر مرکزی</legend>
        <div className="company-setup-form__grid">
          <Field label="کد شعبه">
            <Input
              value={form.branchCode}
              onChange={(event) => updateField("branchCode", event.target.value)}
            />
          </Field>
          <Field label="نام شعبه">
            <Input
              value={form.branchName}
              onChange={(event) => updateField("branchName", event.target.value)}
            />
          </Field>
          <Field label="استان">
            <Input
              value={form.province}
              onChange={(event) => updateField("province", event.target.value)}
            />
          </Field>
          <Field label="شهر">
            <Input
              value={form.city}
              onChange={(event) => updateField("city", event.target.value)}
            />
          </Field>
          <Field label="نشانی" className="company-setup-form__wide">
            <Textarea
              value={form.addressLine}
              onChange={(event) => updateField("addressLine", event.target.value)}
            />
          </Field>
          <Field label="کد پستی">
            <Input
              inputMode="numeric"
              value={form.postalCode}
              onChange={(event) => updateField("postalCode", event.target.value)}
            />
          </Field>
          <Field label="تلفن">
            <Input
              value={form.phone}
              onChange={(event) => updateField("phone", event.target.value)}
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className="company-setup-form__section">
        <legend>اطلاعات اولیه سامانه مودیان</legend>
        <p className="company-setup-form__note">تکمیل این بخش در حال حاضر اختیاری است.</p>
        <div className="company-setup-form__grid">
          <Field label="شماره اقتصادی">
            <Input
              value={form.economicCode}
              onChange={(event) => updateField("economicCode", event.target.value)}
            />
          </Field>
          <Field label="شناسه حافظه مالیاتی">
            <Input
              value={form.fiscalId}
              onChange={(event) => updateField("fiscalId", event.target.value)}
            />
          </Field>
        </div>
      </fieldset>

      {errors.length > 0 ? (
        <Feedback tone="error">
          {errors.map((error) => <div key={error}>{error}</div>)}
        </Feedback>
      ) : null}
      {message ? <Feedback tone="success">{message}</Feedback> : null}

      <div className="company-setup-form__actions">
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? "در حال ثبت..." : "ثبت شرکت و دفتر مرکزی"}
        </Button>
      </div>
    </form>
  );
}
