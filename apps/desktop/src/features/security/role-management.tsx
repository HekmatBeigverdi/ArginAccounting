import { type FormEvent, useCallback, useEffect, useState } from "react";

import { createRole, SecurityValidationError, type Role } from "@argin/security";
import { SqliteRoleRepository, SqliteSecurityUnitOfWork } from "@argin/security-tauri";
import { getDesktopDatabase } from "@argin/database-tauri";

import { Badge, DataTable } from "../../components/data-display";
import { Feedback } from "../../components/feedback";
import { Button, Field, Input, Textarea } from "../../components/forms";
import { Panel } from "../../components/layout";

export function RoleManagement() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadRoles = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");
    try {
      const database = await getDesktopDatabase();
      setRoles(await new SqliteRoleRepository(database).findAll());
    } catch {
      setLoadError("دریافت نقش‌ها با خطا مواجه شد.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void loadRoles(); }, [loadRoles]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setErrors([]);
    setMessage("");
    setIsSubmitting(true);
    try {
      const database = await getDesktopDatabase();
      await createRole(new SqliteSecurityUnitOfWork(database), { code, title, description });
      setCode("");
      setTitle("");
      setDescription("");
      setMessage("نقش با موفقیت ایجاد شد.");
      await loadRoles();
    } catch (error) {
      setErrors(
        error instanceof SecurityValidationError
          ? error.issues.map((issue) => issue.message)
          : ["ایجاد نقش با خطا مواجه شد."],
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="security-management-layout">
      <Panel className="security-feature-panel">
        <div className="security-feature-panel__heading"><div><h3>نقش جدید</h3><p>یک نقش سازمانی برای گروه‌بندی مجوزها تعریف کنید.</p></div></div>
        <form className="security-form" onSubmit={(event) => { void handleSubmit(event); }}>
          <Field label="کد نقش" hint="برای مثال ACCOUNTANT"><Input value={code} dir="ltr" disabled={isSubmitting} onChange={(event) => setCode(event.target.value)} /></Field>
          <Field label="عنوان نقش"><Input value={title} disabled={isSubmitting} onChange={(event) => setTitle(event.target.value)} /></Field>
          <Field label="توضیحات"><Textarea value={description} disabled={isSubmitting} onChange={(event) => setDescription(event.target.value)} /></Field>
          {errors.length > 0 ? <Feedback tone="error">{errors.map((error) => <div key={error}>{error}</div>)}</Feedback> : null}
          {message ? <Feedback tone="success">{message}</Feedback> : null}
          <div className="security-form__actions"><Button type="submit" variant="primary" disabled={isSubmitting}>{isSubmitting ? "در حال ذخیره..." : "ایجاد نقش"}</Button></div>
        </form>
      </Panel>

      <Panel className="security-feature-panel">
        <div className="security-feature-panel__heading"><div><h3>نقش‌ها</h3><p>{roles.length.toLocaleString("fa-IR")} نقش تعریف‌شده</p></div></div>
        {loadError ? <Feedback tone="error">{loadError}</Feedback> : null}
        {isLoading ? <p className="security-feature-muted">در حال دریافت نقش‌ها...</p> : null}
        {!isLoading && !loadError && roles.length === 0 ? <Feedback tone="info">هنوز نقشی تعریف نشده است.</Feedback> : null}
        {roles.length > 0 ? (
          <DataTable>
            <thead><tr><th>کد</th><th>عنوان</th><th>نوع</th><th>وضعیت</th></tr></thead>
            <tbody>{roles.map((role) => <tr key={role.id}><td dir="ltr">{role.code}</td><td>{role.title}</td><td>{role.isSystem ? <Badge tone="info">سیستمی</Badge> : <Badge>عادی</Badge>}</td><td><Badge tone={role.isActive ? "success" : "neutral"}>{role.isActive ? "فعال" : "غیرفعال"}</Badge></td></tr>)}</tbody>
          </DataTable>
        ) : null}
      </Panel>
    </div>
  );
}
