import { useEffect, useState } from "react";

import type { Permission } from "@argin/security";
import { SqlitePermissionRepository } from "@argin/security-tauri";
import { getDesktopDatabase } from "@argin/database-tauri";

import { Badge, DataTable } from "../../components/data-display";
import { Feedback } from "../../components/feedback";
import { Panel } from "../../components/layout";

export function PermissionList() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    void getDesktopDatabase()
      .then((database) => new SqlitePermissionRepository(database).findAll())
      .then((result) => {
        if (mounted) setPermissions(result);
      })
      .catch(() => {
        if (mounted) setError("دریافت فهرست مجوزها با خطا مواجه شد.");
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => { mounted = false; };
  }, []);

  return (
    <Panel className="security-feature-panel">
      <div className="security-feature-panel__heading">
        <div>
          <h3>فهرست مجوزها</h3>
          <p>{permissions.length.toLocaleString("fa-IR")} مجوز تعریف‌شده</p>
        </div>
      </div>

      {error ? <Feedback tone="error">{error}</Feedback> : null}
      {isLoading ? <p className="security-feature-muted">در حال دریافت مجوزها...</p> : null}
      {!isLoading && !error && permissions.length === 0 ? (
        <Feedback tone="info">هنوز مجوزی در سیستم تعریف نشده است.</Feedback>
      ) : null}

      {permissions.length > 0 ? (
        <DataTable>
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
                <td dir="ltr">{permission.code}</td>
                <td>{permission.title}</td>
                <td className="security-status-cell">
                  <Badge tone={permission.isActive ? "success" : "neutral"}>
                    {permission.isActive ? "فعال" : "غیرفعال"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      ) : null}
    </Panel>
  );
}
