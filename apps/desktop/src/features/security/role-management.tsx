import {
  type FormEvent,
  useCallback,
  useEffect,
  useState
} from "react";

import {
  createRole,
  SecurityValidationError,
  type Role
} from "@argin/security";

import {
  SqliteRoleRepository
} from "@argin/security-tauri";

import {
  getDesktopDatabase
} from "@argin/database-tauri";

export function RoleManagement() {
  const [roles, setRoles] =
    useState<Role[]>([]);

  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] =
    useState("");

  const [errors, setErrors] =
    useState<string[]>([]);

  const [message, setMessage] =
    useState("");

  const loadRoles = useCallback(async () => {
    const database =
      await getDesktopDatabase();

    const repository =
      new SqliteRoleRepository(database);

    setRoles(await repository.findAll());
  }, []);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();

    setErrors([]);
    setMessage("");

    try {
      const database =
        await getDesktopDatabase();

      const repository =
        new SqliteRoleRepository(database);

      await createRole(repository, {
        code,
        title,
        description
      });

      setCode("");
      setTitle("");
      setDescription("");

      setMessage(
        "نقش با موفقیت ایجاد شد."
      );

      await loadRoles();
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
          "ایجاد نقش با خطا مواجه شد."
        ]);
      }
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
        <h2>نقش جدید</h2>

        <label>
          کد نقش
          <input
            value={code}
            placeholder="ACCOUNTANT"
            onChange={(event) => {
              setCode(event.target.value);
            }}
          />
        </label>

        <label>
          عنوان نقش
          <input
            value={title}
            placeholder="حسابدار"
            onChange={(event) => {
              setTitle(event.target.value);
            }}
          />
        </label>

        <label>
          توضیحات
          <textarea
            value={description}
            onChange={(event) => {
              setDescription(
                event.target.value
              );
            }}
          />
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

        <button type="submit">
          ایجاد نقش
        </button>
      </form>

      <section className="security-panel">
        <h2>نقش‌ها</h2>

        <div className="security-table-wrapper">
          <table className="security-table">
            <thead>
              <tr>
                <th>کد</th>
                <th>عنوان</th>
                <th>نوع</th>
                <th>وضعیت</th>
              </tr>
            </thead>

            <tbody>
              {roles.map((role) => (
                <tr key={role.id}>
                  <td>{role.code}</td>
                  <td>{role.title}</td>
                  <td>
                    {role.isSystem
                      ? "سیستمی"
                      : "عادی"}
                  </td>
                  <td>
                    {role.isActive
                      ? "فعال"
                      : "غیرفعال"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
