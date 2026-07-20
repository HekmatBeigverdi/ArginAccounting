import {
  type FormEvent,
  useState
} from "react";

import {
  authenticateUser,
  SecurityValidationError
} from "@argin/security";

import {
  SqlitePermissionRepository,
  SqliteRoleRepository,
  SqliteSecurityAssignmentRepository,
  SqliteUserRepository,
  TauriPasswordHasher
} from "@argin/security-tauri";

import {
  getDesktopDatabase
} from "@argin/database-tauri";

export function LoginPage() {
  const [username, setUsername] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [errorMessage, setErrorMessage] =
    useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();

    setMessage("");
    setErrorMessage("");

    try {
      const database =
        await getDesktopDatabase();

      const session = await authenticateUser(
        new SqliteUserRepository(database),
        new SqliteRoleRepository(database),
        new SqlitePermissionRepository(
          database
        ),
        new SqliteSecurityAssignmentRepository(
          database
        ),
        new TauriPasswordHasher(),
        {
          username,
          password
        }
      );

      setMessage(
        `ورود ${session.user.displayName} موفق بود.`
      );
    } catch (error) {
      if (
        error instanceof
        SecurityValidationError
      ) {
        setErrorMessage(
          error.issues[0]?.message ??
            "ورود ناموفق بود."
        );
      } else {
        console.error(error);
        setErrorMessage(
          "ورود با خطا مواجه شد."
        );
      }
    }
  }

  return (
    <section className="temporary-page">
      <form
        className="security-panel"
        style={{
          maxWidth: "420px",
          margin: "4rem auto"
        }}
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
      >
        <h1>ورود به ArginAccounting</h1>

        <label>
          نام کاربری
          <input
            value={username}
            autoComplete="username"
            onChange={(event) => {
              setUsername(event.target.value);
            }}
          />
        </label>

        <label>
          رمز عبور
          <input
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(event) => {
              setPassword(event.target.value);
            }}
          />
        </label>

        {errorMessage && (
          <p className="security-errors">
            {errorMessage}
          </p>
        )}

        {message && (
          <p className="security-success">
            {message}
          </p>
        )}

        <button type="submit">
          ورود
        </button>
      </form>
    </section>
  );
}
