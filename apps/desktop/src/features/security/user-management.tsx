import {
  type FormEvent,
  useCallback,
  useEffect,
  useState
} from "react";

import {
  createUser,
  SecurityValidationError,
  type UserSummary
} from "@argin/security";

import {
  SqliteUserRepository,
  TauriPasswordHasher
} from "@argin/security-tauri";

import {
  getDesktopDatabase
} from "@argin/database-tauri";

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
  mustChangePassword: true
};

export function UserManagement() {
  const [users, setUsers] =
    useState<UserSummary[]>([]);

  const [form, setForm] =
    useState<UserFormState>(initialForm);

  const [errors, setErrors] =
    useState<string[]>([]);

  const [message, setMessage] =
    useState("");

  const [isLoading, setIsLoading] =
    useState(true);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);

    try {
      const database =
        await getDesktopDatabase();

      const repository =
        new SqliteUserRepository(database);

      setUsers(await repository.findAll());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  function updateField<
    K extends keyof UserFormState
  >(
    field: K,
    value: UserFormState[K]
  ): void {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();

    setErrors([]);
    setMessage("");
    setIsSubmitting(true);

    try {
      const database =
        await getDesktopDatabase();

      const repository =
        new SqliteUserRepository(database);

      const passwordHasher =
        new TauriPasswordHasher();

      await createUser(
        repository,
        passwordHasher,
        form
      );

      setForm(initialForm);
      setMessage(
        "کاربر با موفقیت ایجاد شد."
      );

      await loadUsers();
    } catch (error) {
      if (
        error instanceof
        SecurityValidationError
      ) {
        setErrors(
          error.issues.map(
            (issue) => issue.message
          )
        );
      } else {
        console.error(error);
        setErrors([
          "ایجاد کاربر با خطا مواجه شد."
        ]);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="security-management-grid">
      <form
        className="security-panel"
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
      >
        <h2>کاربر جدید</h2>

        <label>
          نام کاربری
          <input
            value={form.username}
            autoComplete="off"
            onChange={(event) => {
              updateField(
                "username",
                event.target.value
              );
            }}
          />
        </label>

        <label>
          نام نمایشی
          <input
            value={form.displayName}
            onChange={(event) => {
              updateField(
                "displayName",
                event.target.value
              );
            }}
          />
        </label>

        <label>
          رمز عبور
          <input
            type="password"
            value={form.password}
            autoComplete="new-password"
            onChange={(event) => {
              updateField(
                "password",
                event.target.value
              );
            }}
          />
        </label>

        <label className="security-check">
          <input
            type="checkbox"
            checked={
              form.mustChangePassword
            }
            onChange={(event) => {
              updateField(
                "mustChangePassword",
                event.target.checked
              );
            }}
          />

          تغییر اجباری رمز در اولین ورود
        </label>

        {errors.length > 0 && (
          <div className="security-errors">
            {errors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </div>
        )}

        {message && (
          <p className="security-success">
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting
            ? "در حال ذخیره..."
            : "ایجاد کاربر"}
        </button>
      </form>

      <section className="security-panel">
        <h2>کاربران</h2>

        {isLoading ? (
          <p>در حال دریافت اطلاعات...</p>
        ) : users.length === 0 ? (
          <p>هنوز کاربری ایجاد نشده است.</p>
        ) : (
          <div className="security-table-wrapper">
            <table className="security-table">
              <thead>
                <tr>
                  <th>نام کاربری</th>
                  <th>نام نمایشی</th>
                  <th>وضعیت</th>
                  <th>آخرین ورود</th>
                </tr>
              </thead>

              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.username}</td>
                    <td>{user.displayName}</td>
                    <td>{user.status}</td>
                    <td>
                      {user.lastLoginAt ??
                        "بدون ورود"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
