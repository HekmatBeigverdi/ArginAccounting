import { type FormEvent, useRef, useState } from "react";
import { useNavigate } from "react-router";

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

import arginLogo from "../../assets/login/argin-logo.png";
import userIcon from "../../assets/login/user.svg";
import passwordVisibilityIcon from "../../assets/login/password-visibility.svg";
import keyboardIcon from "../../assets/login/keyboard.svg";

import "./security-workspace.css";

export function LoginPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [username, setUsername] = useState(() => window.localStorage.getItem("argin.remembered-username") ?? "");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [keyboardLanguage, setKeyboardLanguage] = useState<"fa" | "en">("fa");
  const [keyboardShift, setKeyboardShift] = useState(false);
  const [keyboardTarget, setKeyboardTarget] = useState<"username" | "password">("username");
  const [rememberUsername, setRememberUsername] = useState(() => Boolean(window.localStorage.getItem("argin.remembered-username")));
  const usernameInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);

  const navigate = useNavigate();
  const { setSession } = useAuthSession();

  const keyboardRows = keyboardLanguage === "fa"
    ? [["۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹", "۰"], ["ض", "ص", "ث", "ق", "ف", "غ", "ع", "ه", "خ", "ح", "ج"], ["ش", "س", "ی", "ب", "ل", "ا", "ت", "ن", "م", "ک", "گ"], ["ظ", "ط", "ز", "ر", "ذ", "د", "پ", "و"]]
    : [["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"], ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"], ["a", "s", "d", "f", "g", "h", "j", "k", "l"], ["z", "x", "c", "v", "b", "n", "m"]];

  function setKeyboardTargetValue(nextValue: string, cursor: number): void {
    const input = keyboardTarget === "username" ? usernameInput.current : passwordInput.current;
    const setValue = keyboardTarget === "username" ? setUsername : setPassword;
    setValue(nextValue);
    window.requestAnimationFrame(() => {
      if (!input) return;
      input.focus();
      const nextCursor = Math.min(cursor, nextValue.length);
      input.setSelectionRange(nextCursor, nextCursor);
    });
  }

  function insertKeyboardText(text: string): void {
    const input = keyboardTarget === "username" ? usernameInput.current : passwordInput.current;
    const currentValue = keyboardTarget === "username" ? username : password;
    const start = input?.selectionStart ?? currentValue.length;
    const end = input?.selectionEnd ?? currentValue.length;
    setKeyboardTargetValue(`${currentValue.slice(0, start)}${text}${currentValue.slice(end)}`, start + text.length);
  }

  function backspaceKeyboardText(): void {
    const input = keyboardTarget === "username" ? usernameInput.current : passwordInput.current;
    const currentValue = keyboardTarget === "username" ? username : password;
    const start = input?.selectionStart ?? currentValue.length;
    const end = input?.selectionEnd ?? currentValue.length;
    const deleteFrom = start === end ? Math.max(0, start - 1) : start;
    setKeyboardTargetValue(`${currentValue.slice(0, deleteFrom)}${currentValue.slice(end)}`, deleteFrom);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");
    setRecoveryMessage("");

    if (rememberUsername) {
      window.localStorage.setItem("argin.remembered-username", username.trim());
    } else {
      window.localStorage.removeItem("argin.remembered-username");
    }

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
      <section className="security-login-welcome" aria-labelledby="security-login-welcome-title">
        <h1 id="security-login-welcome-title">به آرگین خوش آمدید</h1>
        <p>برای ورود به نرم‌افزار، اطلاعات حساب کاربری را وارد کنید.</p>
      </section>

      <Panel className="security-login-card" aria-label="ورود به حساب کاربری">
        <header className="security-login-card__brand">
          <img src={arginLogo} alt="نشان آرگین" />
          <span>نرم‌افزار</span>
          <strong>حسابداری آرگین</strong>
        </header>

        <form className="security-login-form" onSubmit={(event) => { void handleSubmit(event); }}>
          <div className="security-login-form__heading">
            <h2>ورود به حساب کاربری</h2>
            <p>انتخاب کاربر</p>
          </div>

          <Field label="نام کاربری یا شماره همراه" className="security-login-field security-login-field--username">
            <span className="security-login-input-wrap">
              <Input
                ref={usernameInput}
                value={username}
                autoComplete="username"
                autoFocus
                disabled={isSubmitting}
                placeholder="نام کاربری یا شماره همراه"
                aria-invalid={Boolean(errorMessage)}
                aria-describedby={errorMessage ? "security-login-error" : undefined}
                onChange={(event) => setUsername(event.target.value)}
                onFocus={() => setKeyboardTarget("username")}
              />
              <img src={userIcon} alt="" aria-hidden="true" />
            </span>
          </Field>

          <Field label="گذرواژه" className="security-login-field">
            <span className="security-login-input-wrap security-login-input-wrap--password">
              <Input
                ref={passwordInput}
                type={showPassword ? "text" : "password"}
                value={password}
                autoComplete="current-password"
                disabled={isSubmitting}
                placeholder="گذرواژه"
                aria-invalid={Boolean(errorMessage)}
                aria-describedby={errorMessage ? "security-login-error" : undefined}
                onChange={(event) => setPassword(event.target.value)}
                onFocus={() => setKeyboardTarget("password")}
              />
              <button
                type="button"
                className="security-login-password-toggle"
                aria-label={showPassword ? "پنهان کردن گذرواژه" : "نمایش گذرواژه"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                <img src={passwordVisibilityIcon} alt="" aria-hidden="true" />
              </button>
            </span>
          </Field>

          <div className="security-login-options">
            <label className="security-login-remember">
              <input
                type="checkbox"
                checked={rememberUsername}
                onChange={(event) => setRememberUsername(event.target.checked)}
              />
              <span>مرا به خاطر بسپار</span>
            </label>
            <button
              type="button"
              className="security-login-recovery"
              onClick={() => {
                setErrorMessage("");
                setRecoveryMessage("برای بازنشانی گذرواژه با مدیر سیستم تماس بگیرید.");
              }}
            >
              فراموشی گذرواژه
            </button>
          </div>

          {errorMessage ? <Feedback tone="error"><span id="security-login-error">{errorMessage}</span></Feedback> : null}
          {recoveryMessage ? <Feedback tone="info">{recoveryMessage}</Feedback> : null}

          <Button
            type="button"
            variant="default"
            className="security-login-keyboard"
            disabled={isSubmitting}
            aria-expanded={isKeyboardOpen}
            aria-controls="security-login-virtual-keyboard"
            onClick={() => setIsKeyboardOpen((open) => !open)}
          >
            <img src={keyboardIcon} alt="" aria-hidden="true" />
            نمایش صفحه‌کلید
          </Button>

          <Button
            type="submit"
            variant="primary"
            className="security-login-submit"
            disabled={isSubmitting || !username.trim() || !password}
          >
            {isSubmitting ? "در حال ورود..." : "ورود به آرگین"}
          </Button>
        </form>

        {isKeyboardOpen ? (
          <section
            id="security-login-virtual-keyboard"
            className="security-login-virtual-keyboard"
            role="dialog"
            aria-label="صفحه‌کلید مجازی"
            dir="rtl"
          >
            <header className="security-login-virtual-keyboard__header">
              <span>ورودی برای {keyboardTarget === "username" ? "نام کاربری" : "گذرواژه"}</span>
              <div className="security-login-virtual-keyboard__header-actions">
                <div className="security-login-virtual-keyboard__languages" aria-label="زبان صفحه‌کلید">
                  <button type="button" aria-pressed={keyboardLanguage === "fa"} onClick={() => setKeyboardLanguage("fa")}>فارسی</button>
                  <button type="button" aria-pressed={keyboardLanguage === "en"} onClick={() => setKeyboardLanguage("en")}>English</button>
                </div>
                <button
                  type="button"
                  className="security-login-virtual-keyboard__close"
                  aria-label="بستن صفحه‌کلید مجازی"
                  title="بستن"
                  onClick={() => setIsKeyboardOpen(false)}
                >
                  ×
                </button>
              </div>
            </header>
            <div className="security-login-virtual-keyboard__rows">
              {keyboardRows.map((row, rowIndex) => (
                <div className="security-login-virtual-keyboard__row" key={`row-${rowIndex}`}>
                  {row.map((key) => (
                    <button
                      type="button"
                      key={key}
                      onClick={() => insertKeyboardText(keyboardLanguage === "en" && keyboardShift ? key.toUpperCase() : key)}
                    >
                      {keyboardLanguage === "en" && keyboardShift ? key.toUpperCase() : key}
                    </button>
                  ))}
                </div>
              ))}
              <div className="security-login-virtual-keyboard__row security-login-virtual-keyboard__row--symbols">
                {["@", ".", "-", "_"].map((key) => (
                  <button type="button" key={key} onClick={() => insertKeyboardText(key)}>{key}</button>
                ))}
                {keyboardLanguage === "en" ? (
                  <button type="button" className="security-login-virtual-keyboard__action" aria-pressed={keyboardShift} onClick={() => setKeyboardShift((shift) => !shift)}>⇧</button>
                ) : null}
                <button type="button" className="security-login-virtual-keyboard__action" onClick={backspaceKeyboardText}>⌫ حذف</button>
                <button type="button" className="security-login-virtual-keyboard__action" onClick={() => insertKeyboardText(" ")}>فاصله</button>
                <button type="button" className="security-login-virtual-keyboard__action" onClick={() => setKeyboardTargetValue("", 0)}>پاک‌کردن</button>
              </div>
            </div>
          </section>
        ) : null}

        <footer className="security-login-card__footer">نسخهٔ دسکتاپ <span aria-hidden="true">•</span> نشست امن</footer>
      </Panel>
    </main>
  );
}
