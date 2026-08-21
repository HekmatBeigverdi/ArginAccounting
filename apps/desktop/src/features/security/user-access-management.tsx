import { useCallback, useEffect, useState } from "react";

import type { Role, UserSummary } from "@argin/security";
import type { Branch } from "@argin/company";
import {
  SqliteRoleRepository,
  SqliteSecurityAssignmentRepository,
  SqliteUserRepository,
} from "@argin/security-tauri";
import { SqliteBranchRepository } from "@argin/company-tauri";
import { getDesktopDatabase } from "@argin/database-tauri";

import { Feedback } from "../../components/feedback";
import { Button, Field, Select } from "../../components/forms";
import { Panel } from "../../components/layout";

export function UserAccessManagement() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const database = await getDesktopDatabase();
      const [userList, roleList, branchList] = await Promise.all([
        new SqliteUserRepository(database).findAll(),
        new SqliteRoleRepository(database).findAll(),
        new SqliteBranchRepository(database).findAll(),
      ]);
      setUsers(userList);
      setRoles(roleList);
      setBranches(branchList);
      setSelectedUserId((current) => current || userList[0]?.id || "");
    } catch {
      setErrorMessage("دریافت اطلاعات دسترسی کاربران با خطا مواجه شد.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadSelectedUserAccess = useCallback(async () => {
    if (!selectedUserId) {
      setSelectedRoleIds([]);
      setSelectedBranchIds([]);
      return;
    }
    setErrorMessage("");
    try {
      const database = await getDesktopDatabase();
      const [assignedRoles, branchIds] = await Promise.all([
        new SqliteRoleRepository(database).findByUserId(selectedUserId),
        new SqliteSecurityAssignmentRepository(database).findBranchIdsByUserId(selectedUserId),
      ]);
      setSelectedRoleIds(assignedRoles.map((role) => role.id));
      setSelectedBranchIds(branchIds);
    } catch {
      setErrorMessage("دریافت نقش‌ها و شعب کاربر با خطا مواجه شد.");
    }
  }, [selectedUserId]);

  useEffect(() => { void loadInitialData(); }, [loadInitialData]);
  useEffect(() => { void loadSelectedUserAccess(); }, [loadSelectedUserAccess]);

  function toggleRole(roleId: string): void {
    setSelectedRoleIds((current) => current.includes(roleId) ? current.filter((id) => id !== roleId) : [...current, roleId]);
  }

  function toggleBranch(branchId: string): void {
    setSelectedBranchIds((current) => current.includes(branchId) ? current.filter((id) => id !== branchId) : [...current, branchId]);
  }

  async function save(): Promise<void> {
    if (!selectedUserId) return;
    setIsSaving(true);
    setMessage("");
    setErrorMessage("");
    try {
      const database = await getDesktopDatabase();
      const repository = new SqliteSecurityAssignmentRepository(database);
      await repository.replaceUserRoles(selectedUserId, selectedRoleIds, null);
      await repository.replaceUserBranchAccess(selectedUserId, selectedBranchIds, null);
      setMessage("دسترسی‌های کاربر با موفقیت ذخیره شد.");
    } catch {
      setErrorMessage("ذخیره دسترسی‌های کاربر با خطا مواجه شد.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <Panel><p className="security-feature-muted">در حال دریافت دسترسی کاربران...</p></Panel>;
  }

  return (
    <Panel className="security-feature-panel">
      <div className="security-feature-panel__heading">
        <div><h3>نقش‌ها و دسترسی شعب</h3><p>دسترسی کاربر انتخاب‌شده به نقش‌ها و شعب فعال را مدیریت کنید.</p></div>
      </div>

      <Field label="کاربر">
        <Select value={selectedUserId} onChange={(event) => { setSelectedUserId(event.target.value); setMessage(""); setErrorMessage(""); }}>
          {users.map((user) => <option key={user.id} value={user.id}>{user.displayName} ({user.username})</option>)}
        </Select>
      </Field>

      {users.length === 0 ? <Feedback tone="info">برای تخصیص دسترسی ابتدا یک کاربر ایجاد کنید.</Feedback> : null}
      {errorMessage ? <Feedback tone="error">{errorMessage}</Feedback> : null}
      {message ? <Feedback tone="success">{message}</Feedback> : null}

      <div className="security-selection-grid">
        <fieldset className="security-selection-group">
          <legend>نقش‌های کاربر</legend>
          <div className="security-choice-list">
            {roles.map((role) => (
              <label key={role.id} className="security-choice">
                <input type="checkbox" checked={selectedRoleIds.includes(role.id)} disabled={!role.isActive} onChange={() => toggleRole(role.id)} />
                <span><strong>{role.title}</strong><small>{role.code}</small></span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="security-selection-group">
          <legend>شعب قابل دسترس</legend>
          {branches.length === 0 ? <p className="security-feature-muted">هنوز شعبه‌ای تعریف نشده است.</p> : (
            <div className="security-choice-list">
              {branches.map((branch) => (
                <label key={branch.id} className="security-choice">
                  <input type="checkbox" checked={selectedBranchIds.includes(branch.id)} disabled={branch.status !== "active"} onChange={() => toggleBranch(branch.id)} />
                  <span><strong>{branch.name}</strong><small>{branch.code}</small></span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
      </div>

      <div className="security-form__actions">
        <Button type="button" variant="primary" disabled={isSaving || !selectedUserId} onClick={() => { void save(); }}>
          {isSaving ? "در حال ذخیره..." : "ذخیره دسترسی‌ها"}
        </Button>
      </div>
    </Panel>
  );
}
