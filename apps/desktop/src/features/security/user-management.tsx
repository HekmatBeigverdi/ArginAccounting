import { type FormEvent, useCallback, useEffect, useState } from "react";

import { createUser, SecurityValidationError, type UserSummary } from "@argin/security";
import { SqliteSecurityUnitOfWork, SqliteUserRepository, TauriPasswordHasher } from "@argin/security-tauri";
import { getDesktopDatabase } from "@argin/database-tauri";

import { Badge, DataTable } from "../../components/data-display";
import { Feedback } from "../../components/feedback";
import { Button, Field, Input } from "../../components/forms";
import { Panel } from "../../components/layout";

interface UserFormState {
  username: string;
  displayName: string;
  password: string;
  mustChangePassword: boolean;
}

const initialForm: UserFormState = {
  username: "",
  displayName: "",
  password: "",
  mustChangePassword: true,
};

export function UserManagement() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [form, setForm] = useState<UserFormState>(initialForm);
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");
    try {
      const database = await getDesktopDatabase();
      setUsers(await new SqliteUserRepository(database).findAll());
    } catch {
      setLoadError("دریافت کاربران با خطا مواجه شد.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void loadUsers(); }, [loadUsers]);

  function updateField<K extends keyof UserFormState>(field: K, value: UserFormState[K]): void {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setErrors([]);
    setMessage("");
    setIsSubmitting(true);

    try {
      const database = await getDesktopDatabase();
      await createUser(new SqliteSecurityUnitOfWork(database), new TauriPasswordHasher(), form);
      setForm(initialForm);
      setMessage("کاربر با موفقیت ایجاد شد.");
      await loadUsers();
    } catch (error) {
      setErrors(
        error instanceof SecurityValidationError
          ? error.issues.map((issue) => issue.message)
          : ["ایجاد کاربر با خطا مواجه شد."],
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="security-management-layout">
      <Panel className="security-feature-panel">
        <div className="security-feature-panel__heading">
          <div><h3>کاربر جدید</h3><p>حساب محلی جدید برای استفاده از نرم‌افزار بسازید.</p></div>
        </div>
        <form className="security-form" onSubmit={(event) => { void handleSubmit(event); }}>
          <Field label="نام کاربری"><Input value={form.username} autoComplete="off" disabled={isSubmitting} onChange={(event) => updateField("username", event.target.value)} /></Field>
          <Field label="نام نمایشی"><Input value={form.displayName} disabled={isSubmitting} onChange={(event) => updateField("displayName", event.target.value)} /></Field>
          <Field label="رمز عبور"><Input type="password" value={form.password} autoComplete="new-password" disabled={isSubmitting} onChange={(event) => updateField("password", event.target.value)} /></Field>
          <label className="security-form__check">
            <input type="checkbox" checked={form.mustChangePassword} disabled={isSubmitting} onChange={(event) => updateField("mustChangePassword", event.target.checked)} />
            <span><strong>تغییر اجباری رمز در اولین ورود</strong><small>کاربر پس از نخستین ورود باید رمز عبور خود را تغییر دهد.</small></span>
          </label>
          {errors.length > 0 ? <Feedback tone="error">{errors.map((error) => <div key={error}>{error}</div>)}</Feedback> : null}
          {message ? <Feedback tone="success">{message}</Feedback> : null}
          <div className="security-form__actions"><Button type="submit" variant="primary" disabled={isSubmitting}>{isSubmitting ? "در حال ذخیره..." : "ایجاد کاربر"}</Button></div>
        </form>
      </Panel>

      <Panel className="security-feature-panel">
        <div className="security-feature-panel__heading"><div><h3>کاربران</h3><p>{users.length.toLocaleString("fa-IR")} حساب کاربری</p></div></div>
        {loadError ? <Feedback tone="error">{loadError}</Feedback> : null}
        {isLoading ? <p className="security-feature-muted">در حال دریافت اطلاعات...</p> : null}
        {!isLoading && !loadError && users.length === 0 ? <Feedback tone="info">هنوز کاربری ایجاد نشده است.</Feedback> : null}
        {users.length > 0 ? (
          <DataTable>
            <thead><tr><th>نام کاربری</th><th>نام نمایشی</th><th>وضعیت</th><th>آخرین ورود</th></tr></thead>
            <tbody>{users.map((user) => <tr key={user.id}><td dir="ltr">{user.username}</td><td>{user.displayName}</td><td><Badge tone={user.status === "active" ? "success" : "neutral"}>{user.status === "active" ? "فعال" : "غیرفعال"}</Badge></td><td>{user.lastLoginAt ?? "بدون ورود"}</td></tr>)}</tbody>
          </DataTable>
        ) : null}
      </Panel>
    </div>
  );
}
