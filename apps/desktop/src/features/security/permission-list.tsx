import {
  useEffect,
  useState
} from "react";

import type {
  Permission
} from "@argin/security";

import {
  SqlitePermissionRepository
} from "@argin/security-tauri";

import {
  getDesktopDatabase
} from "@argin/database-tauri";

export function PermissionList() {
  const [permissions, setPermissions] =
    useState<Permission[]>([]);

  const [isLoading, setIsLoading] =
    useState(true);

  useEffect(() => {
    let isMounted = true;

    async function load(): Promise<void> {
      try {
        const database =
          await getDesktopDatabase();

        const repository =
          new SqlitePermissionRepository(
            database
          );

        const result =
          await repository.findAll();

        if (isMounted) {
          setPermissions(result);
        }
      } catch (error) {
        console.error(
          "Loading permissions failed:",
          error
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return <p>در حال دریافت مجوزها...</p>;
  }

  return (
    <section className="security-panel">
      <div className="security-table-wrapper">
        <table className="security-table">
          <thead>
            <tr>
              <th>ماژول</th>
              <th>کد مجوز</th>
              <th>عنوان</th>
              <th>وضعیت</th>
            </tr>
          </thead>

          <tbody>
            {permissions.map((permission) => (
              <tr key={permission.id}>
                <td>{permission.module}</td>
                <td>{permission.code}</td>
                <td>{permission.title}</td>
                <td>
                  {permission.isActive
                    ? "فعال"
                    : "غیرفعال"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
