import "./App.css";

import {
  DatabaseStatusCard
} from "./features/database/database-status-card";

function App() {
  return (
    <main className="container" dir="rtl">
      <header className="app-header">
        <p className="app-kicker">
          نرم‌افزار حسابداری شرکتی
        </p>

        <h1>ArginAccounting</h1>

        <p>
          سامانه حسابداری فارسی، ماژولار و آفلاین‌محور
        </p>
      </header>

      <DatabaseStatusCard />

      <section className="localization-card">
        <h2>تنظیمات پایه</h2>

        <dl>
          <div>
            <dt>واحد پول پایه</dt>
            <dd>ریال ایران</dd>
          </div>

          <div>
            <dt>تقویم رابط کاربری</dt>
            <dd>هجری شمسی</dd>
          </div>

          <div>
            <dt>حالت اجرا</dt>
            <dd>دسکتاپ آفلاین</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}

export default App;
