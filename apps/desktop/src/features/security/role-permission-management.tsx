import { useCallback, useEffect, useMemo, useState } from "react";

import type { Permission, Role } from "@argin/security";
import {
  SqlitePermissionRepository,
  SqliteRoleRepository,
  SqliteSecurityAssignmentRepository,
} from "@argin/security-tauri";
import { getDesktopDatabase } from "@argin/database-tauri";

import { Feedback } from "../../components/feedback";
import { Button, Field, Select } from "../../components/forms";
import { Panel } from "../../components/layout";

export function RolePermissionManagement() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const selectedRole = useMemo(
    () => roles.find((role) => role.id === selectedRoleId) ?? null,
    [roles, selectedRoleId],
  );
  const isSystemAdministrator = selectedRole?.normalizedCode === "SYSTEM-ADMINISTRATOR";

  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const database = await getDesktopDatabase();
      const [roleList, permissionList] = await Promise.all([
        new SqliteRoleRepository(database).findAll(),
        new SqlitePermissionRepository(database).findAll(),
      ]);
      setRoles(roleList);
      setPermissions(permissionList);
      setSelectedRoleId((current) => current || roleList[0]?.id || "");
    } catch {
      setErrorMessage("دریافت نقش‌ها و مجوزها با خطا مواجه شد.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadRolePermissions = useCallback(async () => {
    if (!selectedRoleId) {
      setSelectedPermissionIds([]);
      return;
    }
    setErrorMessage("");
    try {
      const database = await getDesktopDatabase();
      const assigned = await new SqlitePermissionRepository(database).findByRoleId(selectedRoleId);
      setSelectedPermissionIds(assigned.map((permission) => permission.id));
    } catch {
      setErrorMessage("دریافت مجوزهای نقش با خطا مواجه شد.");
    }
  }, [selectedRoleId]);

  useEffect(() => { void loadInitialData(); }, [loadInitialData]);
  useEffect(() => { void loadRolePermissions(); }, [loadRolePermissions]);

  function togglePermission(permissionId: string): void {
    if (isSystemAdministrator) return;
    setSelectedPermissionIds((current) =>
      current.includes(permissionId)
        ? current.filter((id) => id !== permissionId)
        : [...current, permissionId],
    );
  }

  async function save(): Promise<void> {
    if (!selectedRoleId) return;
    setIsSaving(true);
    setMessage("");
    setErrorMessage("");
    try {
      const database = await getDesktopDatabase();
      await new SqliteSecurityAssignmentRepository(database).replaceRolePermissions(
        selectedRoleId,
        selectedPermissionIds,
        null,
      );
      setMessage("مجوزهای نقش با موفقیت ذخیره شد.");
    } catch {
      setErrorMessage("ذخیره مجوزهای نقش با خطا مواجه شد.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <Panel><p className="security-feature-muted">در حال دریافت نقش‌ها و مجوزها...</p></Panel>;
  }

  return (
    <Panel className="security-feature-panel">
      <div className="security-feature-panel__heading">
        <div><h3>مجوزهای نقش</h3><p>مجوزهای فعال را برای نقش انتخاب‌شده مدیریت کنید.</p></div>
      </div>

      <Field label="نقش">
        <Select
          value={selectedRoleId}
          onChange={(event) => {
            setSelectedRoleId(event.target.value);
            setMessage("");
            setErrorMessage("");
          }}
        >
          {roles.map((role) => <option key={role.id} value={role.id}>{role.title} ({role.code})</option>)}
        </Select>
      </Field>

      {isSystemAdministrator ? (
        <Feedback tone="info">نقش مدیر سیستم به‌صورت خودکار همه مجوزهای فعال را دارد و قابل محدودسازی نیست.</Feedback>
      ) : null}
      {errorMessage ? <Feedback tone="error">{errorMessage}</Feedback> : null}
      {message ? <Feedback tone="success">{message}</Feedback> : null}

      <div className="security-choice-list" aria-label="مجوزهای نقش">
        {permissions.map((permission) => (
          <label key={permission.id} className="security-choice">
            <input
              type="checkbox"
              checked={selectedPermissionIds.includes(permission.id)}
              disabled={isSystemAdministrator || !permission.isActive}
              onChange={() => togglePermission(permission.id)}
            />
            <span><strong>{permission.title}</strong><small>{permission.module} — {permission.code}</small></span>
          </label>
        ))}
      </div>

      <div className="security-form__actions">
        <Button type="button" variant="primary" disabled={isSaving || !selectedRoleId || isSystemAdministrator} onClick={() => { void save(); }}>
          {isSaving ? "در حال ذخیره..." : "ذخیره مجوزهای نقش"}
        </Button>
      </div>
    </Panel>
  );
}
