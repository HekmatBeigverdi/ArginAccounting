import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";

import type {
  Permission,
  Role
} from "@argin/security";

import {
  SqlitePermissionRepository,
  SqliteRoleRepository,
  SqliteSecurityAssignmentRepository
} from "@argin/security-tauri";

import {
  getDesktopDatabase
} from "@argin/database-tauri";

export function RolePermissionManagement() {
  const [roles, setRoles] =
    useState<Role[]>([]);

  const [permissions, setPermissions] =
    useState<Permission[]>([]);

  const [selectedRoleId, setSelectedRoleId] =
    useState("");

  const [
    selectedPermissionIds,
    setSelectedPermissionIds
  ] = useState<string[]>([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [isSaving, setIsSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [errorMessage, setErrorMessage] =
    useState("");

  const selectedRole = useMemo(
    () =>
      roles.find(
        (role) => role.id === selectedRoleId
      ) ?? null,
    [roles, selectedRoleId]
  );

  const isSystemAdministrator =
    selectedRole?.normalizedCode ===
    "SYSTEM-ADMINISTRATOR";

  const loadInitialData =
    useCallback(async () => {
      try {
        const database =
          await getDesktopDatabase();

        const roleRepository =
          new SqliteRoleRepository(database);

        const permissionRepository =
          new SqlitePermissionRepository(
            database
          );

        const [roleList, permissionList] =
          await Promise.all([
            roleRepository.findAll(),
            permissionRepository.findAll()
          ]);

        setRoles(roleList);
        setPermissions(permissionList);

        if (roleList.length > 0) {
          setSelectedRoleId(
            (current) =>
              current || roleList[0].id
          );
        }
      } catch (error) {
        console.error(error);

        setErrorMessage(
          "دریافت نقش‌ها و مجوزها با خطا مواجه شد."
        );
      } finally {
        setIsLoading(false);
      }
    }, []);

  const loadRolePermissions =
    useCallback(async () => {
      if (!selectedRoleId) {
        setSelectedPermissionIds([]);
        return;
      }

      try {
        const database =
          await getDesktopDatabase();

        const repository =
          new SqlitePermissionRepository(
            database
          );

        const assigned =
          await repository.findByRoleId(
            selectedRoleId
          );

        setSelectedPermissionIds(
          assigned.map(
            (permission) => permission.id
          )
        );
      } catch (error) {
        console.error(error);

        setErrorMessage(
          "دریافت مجوزهای نقش با خطا مواجه شد."
        );
      }
    }, [selectedRoleId]);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    void loadRolePermissions();
  }, [loadRolePermissions]);

  function togglePermission(
    permissionId: string
  ): void {
    if (isSystemAdministrator) {
      return;
    }

    setSelectedPermissionIds(
      (current) =>
        current.includes(permissionId)
          ? current.filter(
              (id) => id !== permissionId
            )
          : [...current, permissionId]
    );
  }

  async function save(): Promise<void> {
    if (!selectedRoleId) {
      return;
    }

    setIsSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      const database =
        await getDesktopDatabase();

      const repository =
        new SqliteSecurityAssignmentRepository(
          database
        );

      await repository.replaceRolePermissions(
        selectedRoleId,
        selectedPermissionIds,
        null
      );

      setMessage(
        "مجوزهای نقش با موفقیت ذخیره شد."
      );
    } catch (error) {
      console.error(error);

      setErrorMessage(
        "ذخیره مجوزهای نقش با خطا مواجه شد."
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <p>
        در حال دریافت نقش‌ها و مجوزها...
      </p>
    );
  }

  return (
    <section className="security-panel">
      <h2>مجوزهای نقش</h2>

      <label>
        نقش
        <select
          value={selectedRoleId}
          onChange={(event) => {
            setSelectedRoleId(
              event.target.value
            );

            setMessage("");
            setErrorMessage("");
          }}
        >
          {roles.map((role) => (
            <option
              key={role.id}
              value={role.id}
            >
              {role.title} ({role.code})
            </option>
          ))}
        </select>
      </label>

      {isSystemAdministrator && (
        <p className="security-notice">
          نقش مدیر سیستم به‌صورت خودکار
          همه مجوزهای فعال را دارد و قابل
          محدودسازی نیست.
        </p>
      )}

      <div className="security-permission-list">
        {permissions.map((permission) => (
          <label
            key={permission.id}
            className="security-checkbox"
          >
            <input
              type="checkbox"
              checked={selectedPermissionIds.includes(
                permission.id
              )}
              disabled={
                isSystemAdministrator ||
                !permission.isActive
              }
              onChange={() => {
                togglePermission(
                  permission.id
                );
              }}
            />

            <span>
              <strong>
                {permission.title}
              </strong>

              <small>
                {permission.module} —{" "}
                {permission.code}
              </small>
            </span>
          </label>
        ))}
      </div>

      {message && (
        <p className="security-success">
          {message}
        </p>
      )}

      {errorMessage && (
        <p className="security-errors">
          {errorMessage}
        </p>
      )}

      <button
        type="button"
        disabled={
          isSaving ||
          !selectedRoleId ||
          isSystemAdministrator
        }
        onClick={() => {
          void save();
        }}
      >
        {isSaving
          ? "در حال ذخیره..."
          : "ذخیره مجوزهای نقش"}
      </button>
    </section>
  );
}
