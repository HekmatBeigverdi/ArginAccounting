import { type FormEvent, useState } from "react";
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
import { DesktopTitleBar } from "../../components/desktop/desktop-title-bar";
import { Feedback } from "../../components/feedback";
import { Button, Input } from "../../components/forms";
import loginUserIcon from "../../assets/argin-ui/login-user.svg";
import passwordEyeIcon from "../../assets/argin-ui/login-password-eye.svg";
import keyboardIcon from "../../assets/argin-ui/login-keyboard.svg";
import arginLogo from "../../assets/argin-ui/argin-logo.png";
import loginBackground from "../../assets/argin-ui/login-background.jpg";

import "./login-page.css";

type LoginField = "username" | "password";

const keyboardRows = ["1234567890", "qwertyuiop", "asdfghjkl", "zxcvbnm"];

export function LoginPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [keyboardTarget, setKeyboardTarget] = useState<LoginField>("username");

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

  function appendVirtualKey(key: string): void {
    if (keyboardTarget === "username") setUsername((current) => current + key);
    else setPassword((current) => current + key);
  }

  function removeVirtualKey(): void {
    if (keyboardTarget === "username") setUsername((current) => current.slice(0, -1));
    else setPassword((current) => current.slice(0, -1));
  }

  return (
    <main className="argin-login" lang="fa" dir="rtl">
      <div className="argin-login__window">
        <DesktopTitleBar className="desktop-titlebar--login" />

        <section className="argin-login__workspace" aria-label="ورود به نرم‌افزار حسابداری آرگین">
          <img className="argin-login__background" src={loginBackground} alt="" aria-hidden="true" />
          <div className="argin-login__welcome">
            <h1>به آرگین خوش آمدید</h1>
            <p>برای ورود به نرم‌افزار، اطلاعات حساب کاربری را وارد کنید.</p>
          </div>

          <section className="argin-login__card" aria-labelledby="login-heading">
            <div className="argin-login__brand">
              <img src={arginLogo} alt="نشان آرگین" />
              <span>نرم‌افزار</span>
              <strong>حسابداری آرگین</strong>
            </div>
            <div className="argin-login__divider" />
            <h2 id="login-heading">ورود به حساب کاربری</h2>

            <form className="argin-login__form" onSubmit={(event) => { void handleSubmit(event); }}>
              <label className="argin-login__field">
                <span>نام کاربری</span>
                <span className="argin-login__input-wrap">
                  <Input
                    value={username}
                    autoComplete="username"
                    autoFocus
                    disabled={isSubmitting}
                    placeholder="نام کاربری یا شماره همراه"
                    onFocus={() => setKeyboardTarget("username")}
                    onChange={(event) => setUsername(event.target.value)}
                  />
                  <img src={loginUserIcon} alt="" aria-hidden="true" />
                </span>
              </label>

              <label className="argin-login__field">
                <span>گذرواژه</span>
                <span className="argin-login__input-wrap argin-login__input-wrap--password">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    autoComplete="current-password"
                    disabled={isSubmitting}
                    placeholder="گذرواژه را وارد کنید"
                    onFocus={() => setKeyboardTarget("password")}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    className="argin-login__icon-button"
                    type="button"
                    aria-label={showPassword ? "پنهان کردن گذرواژه" : "نمایش گذرواژه"}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    <img src={passwordEyeIcon} alt="" aria-hidden="true" />
                  </button>
                </span>
              </label>

              {errorMessage ? <Feedback tone="error">{errorMessage}</Feedback> : null}

              <button
                className="argin-login__keyboard-toggle"
                type="button"
                aria-expanded={showKeyboard}
                onClick={() => setShowKeyboard((value) => !value)}
              >
                <span>{showKeyboard ? "بستن صفحه‌کلید" : "نمایش صفحه‌کلید"}</span>
                <img src={keyboardIcon} alt="" aria-hidden="true" />
              </button>

              {showKeyboard ? (
                <div className="argin-login__keyboard" aria-label="صفحه‌کلید مجازی">
                  {keyboardRows.map((row) => (
                    <div className="argin-login__keyboard-row" key={row}>
                      {[...row].map((key) => (
                        <button key={key} type="button" onClick={() => appendVirtualKey(key)}>{key}</button>
                      ))}
                    </div>
                  ))}
                  <div className="argin-login__keyboard-row argin-login__keyboard-row--actions">
                    <button type="button" onClick={removeVirtualKey}>پاک‌کردن</button>
                    <button type="button" onClick={() => setShowKeyboard(false)}>بستن</button>
                  </div>
                </div>
              ) : null}

              <Button
                className="argin-login__submit"
                type="submit"
                variant="primary"
                disabled={isSubmitting || !username.trim() || !password}
              >
                {isSubmitting ? "در حال ورود..." : "ورود به آرگین"}
              </Button>
            </form>

            <p className="argin-login__footer">نسخهٔ دسکتاپ <span>•</span> نشست امن محلی</p>
          </section>
        </section>
      </div>
    </main>
  );
}
