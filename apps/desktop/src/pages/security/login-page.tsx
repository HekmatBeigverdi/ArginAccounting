import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router";

import { authenticateUser, SecurityValidationError } from "@argin/security";
import {
  SqlitePermissionRepository,
  SqliteRoleRepository,
  SqliteSecurityAssignmentRepository,
  SqliteUserRepository,
  TauriPasswordHasher,
} from "@argin/security-tauri";
import { getDesktopDatabase } from "@argin/database-tauri";

import { useAuthSession } from "../../app/providers/auth-session-provider";
import { Feedback } from "../../components/feedback";
import { Button, Field, Input } from "../../components/forms";
import { Panel } from "../../components/layout";

import "./security-workspace.css";

export function LoginPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const navigate = useNavigate();
  const { setSession } = useAuthSession();

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const database = await getDesktopDatabase();
      const session = await authenticateUser(
        new SqliteUserRepository(database),
        new SqliteRoleRepository(database),
        new SqlitePermissionRepository(database),
        new SqliteSecurityAssignmentRepository(database),
        new TauriPasswordHasher(),
        { username, password },
      );

      setSession(session);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      if (error instanceof SecurityValidationError) {
        setErrorMessage(error.issues[0]?.message ?? "نام کاربری یا رمز عبور معتبر نیست.");
      } else {
        setErrorMessage("ورود به سیستم انجام نشد. دوباره تلاش کنید.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="security-login-page" lang="fa" dir="rtl">
      <Panel className="security-login-card">
        <div className="security-login-card__brand">
          <div className="security-login-card__mark" aria-hidden="true">آ</div>
          <h1>ورود به آرگین</h1>
          <p>برای ادامه، با حساب کاربری محلی خود وارد شوید.</p>
        </div>

        <form className="security-form" onSubmit={(event) => { void handleSubmit(event); }}>
          <Field label="نام کاربری">
            <Input
              value={username}
              autoComplete="username"
              autoFocus
              disabled={isSubmitting}
              onChange={(event) => setUsername(event.target.value)}
            />
          </Field>

          <Field label="رمز عبور">
            <Input
              type="password"
              value={password}
              autoComplete="current-password"
              disabled={isSubmitting}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>

          {errorMessage ? <Feedback tone="error">{errorMessage}</Feedback> : null}

          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting || !username.trim() || !password}
          >
            {isSubmitting ? "در حال ورود..." : "ورود"}
          </Button>
        </form>

        <div className="security-login-card__footer">
          <Link to="/dashboard">بازگشت به داشبورد</Link>
        </div>
      </Panel>
    </main>
  );
}
