import {
  FiscalYearForm
} from "../../features/fiscal/fiscal-year-form";

export function NewFiscalYearPage() {
  return (
    <section className="temporary-page">
      <header className="temporary-page__header">
        <div>
          <p className="temporary-page__eyebrow">
            مدیریت مالی
          </p>

          <h1>ایجاد سال مالی</h1>

          <p>
            بازه سال مالی و دوره‌های عملیاتی شرکت را
            تعریف کنید.
          </p>
        </div>
      </header>

      <FiscalYearForm />
    </section>
  );
}
