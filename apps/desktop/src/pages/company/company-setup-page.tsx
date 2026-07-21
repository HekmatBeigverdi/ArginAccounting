import {
  CompanySetupForm
} from "../../features/company/company-setup-form";

export function CompanySetupPage() {
  return (
    <section className="temporary-page">
      <header className="temporary-page__header">
        <div>
          <p className="temporary-page__eyebrow">
            اطلاعات پایه
          </p>

          <h1>تعریف شرکت</h1>

          <p>
            اطلاعات حقوقی شرکت، دفتر مرکزی و اطلاعات
            اولیه مالیاتی را ثبت کنید.
          </p>
        </div>
      </header>

      <CompanySetupForm />
    </section>
  );
}
