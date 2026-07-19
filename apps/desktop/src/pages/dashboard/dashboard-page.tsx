export function DashboardPage() {
  return (
    <section className="temporary-page">
      <header className="temporary-page__header">
        <div>
          <p className="temporary-page__eyebrow">
            ArginAccounting
          </p>

          <h1>داشبورد</h1>

          <p>
            این داشبورد موقت است و طراحی نهایی آن در فاز
            رابط کاربری فارسی انجام خواهد شد.
          </p>
        </div>
      </header>

      <div className="temporary-dashboard-grid">
        <article className="temporary-dashboard-card">
          <span>شرکت و شعب</span>
          <strong>اطلاعات پایه</strong>
          <p>
            تعریف شرکت، شعب و اطلاعات هویتی مالیاتی
          </p>
        </article>

        <article className="temporary-dashboard-card">
          <span>مدیریت مالی</span>
          <strong>سال مالی</strong>
          <p>
            تعریف سال و دوره مالی و کنترل تاریخ عملیات
          </p>
        </article>

        <article className="temporary-dashboard-card">
          <span>امنیت</span>
          <strong>فاز ۷</strong>
          <p>
            کاربران، نقش‌ها و مجوزها در حال توسعه هستند.
          </p>
        </article>
      </div>
    </section>
  );
}
