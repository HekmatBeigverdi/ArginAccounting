import {
  useCallback,
  useEffect,
  useState
} from "react";

import type {
  Role,
  UserSummary
} from "@argin/security";

import type {
  Branch
} from "@argin/company";

import {
  SqliteRoleRepository,
  SqliteSecurityAssignmentRepository,
  SqliteUserRepository
} from "@argin/security-tauri";

import {
  SqliteBranchRepository
} from "@argin/company-tauri";

import {
  getDesktopDatabase
} from "@argin/database-tauri";

export function UserAccessManagement() {
  const [users, setUsers] =
    useState<UserSummary[]>([]);

  const [roles, setRoles] =
    useState<Role[]>([]);

  const [branches, setBranches] =
    useState<Branch[]>([]);

  const [selectedUserId, setSelectedUserId] =
    useState("");

  const [selectedRoleIds, setSelectedRoleIds] =
    useState<string[]>([]);

  const [
    selectedBranchIds,
    setSelectedBranchIds
  ] = useState<string[]>([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [isSaving, setIsSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [errorMessage, setErrorMessage] =
    useState("");

  const loadInitialData =
    useCallback(async () => {
      try {
        const database =
          await getDesktopDatabase();

        const userRepository =
          new SqliteUserRepository(database);

        const roleRepository =
          new SqliteRoleRepository(database);

        const branchRepository =
          new SqliteBranchRepository(database);

        const [
          userList,
          roleList,
          branchList
        ] = await Promise.all([
          userRepository.findAll(),
          roleRepository.findAll(),
          branchRepository.findAll()
        ]);

        setUsers(userList);
        setRoles(roleList);
        setBranches(branchList);

        if (userList.length > 0) {
          setSelectedUserId(
            (current) =>
              current || userList[0].id
          );
        }
      } catch (error) {
        console.error(error);

        setErrorMessage(
          "دریافت اطلاعات دسترسی کاربران با خطا مواجه شد."
        );
      } finally {
        setIsLoading(false);
      }
    }, []);

  const loadSelectedUserAccess =
    useCallback(async () => {
      if (!selectedUserId) {
        setSelectedRoleIds([]);
        setSelectedBranchIds([]);
        return;
      }

      try {
        const database =
          await getDesktopDatabase();

        const roleRepository =
          new SqliteRoleRepository(database);

        const assignmentRepository =
          new SqliteSecurityAssignmentRepository(
            database
          );

        const [
          assignedRoles,
          branchIds
        ] = await Promise.all([
          roleRepository.findByUserId(
            selectedUserId
          ),
          assignmentRepository
            .findBranchIdsByUserId(
              selectedUserId
            )
        ]);

        setSelectedRoleIds(
          assignedRoles.map(
            (role) => role.id
          )
        );

        setSelectedBranchIds(branchIds);
      } catch (error) {
        console.error(error);

        setErrorMessage(
          "دریافت نقش‌ها و شعب کاربر با خطا مواجه شد."
        );
      }
    }, [selectedUserId]);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    void loadSelectedUserAccess();
  }, [loadSelectedUserAccess]);

  function toggleRole(roleId: string): void {
    setSelectedRoleIds(
      (current) =>
        current.includes(roleId)
          ? current.filter(
              (id) => id !== roleId
            )
          : [...current, roleId]
    );
  }

  function toggleBranch(
    branchId: string
  ): void {
    setSelectedBranchIds(
      (current) =>
        current.includes(branchId)
          ? current.filter(
              (id) => id !== branchId
            )
          : [...current, branchId]
    );
  }

  async function save(): Promise<void> {
    if (!selectedUserId) {
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

      await repository.replaceUserRoles(
        selectedUserId,
        selectedRoleIds,
        null
      );

      await repository.replaceUserBranchAccess(
        selectedUserId,
        selectedBranchIds,
        null
      );

      setMessage(
        "دسترسی‌های کاربر با موفقیت ذخیره شد."
      );
    } catch (error) {
      console.error(error);

      setErrorMessage(
        "ذخیره دسترسی‌های کاربر با خطا مواجه شد."
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <p>
        در حال دریافت دسترسی کاربران...
      </p>
    );
  }

  return (
    <section className="security-panel">
      <h2>نقش‌ها و دسترسی شعب</h2>

      <label>
        کاربر
        <select
          value={selectedUserId}
          onChange={(event) => {
            setSelectedUserId(
              event.target.value
            );

            setMessage("");
            setErrorMessage("");
          }}
        >
          {users.map((user) => (
            <option
              key={user.id}
              value={user.id}
            >
              {user.displayName} (
              {user.username})
            </option>
          ))}
        </select>
      </label>

      <fieldset>
        <legend>نقش‌های کاربر</legend>

        <div className="security-permission-list">
          {roles.map((role) => (
            <label
              key={role.id}
              className="security-checkbox"
            >
              <input
                type="checkbox"
                checked={selectedRoleIds.includes(
                  role.id
                )}
                disabled={!role.isActive}
                onChange={() => {
                  toggleRole(role.id);
                }}
              />

              <span>
                <strong>
                  {role.title}
                </strong>

                <small>{role.code}</small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>شعب قابل دسترس</legend>

        {branches.length === 0 ? (
          <p>
            هنوز شعبه‌ای تعریف نشده است.
          </p>
        ) : (
          <div className="security-permission-list">
            {branches.map((branch) => (
              <label
                key={branch.id}
                className="security-checkbox"
              >
                <input
                  type="checkbox"
                  checked={selectedBranchIds.includes(
                    branch.id
                  )}
                  disabled={
                    branch.status !== "active"
                  }
                  onChange={() => {
                    toggleBranch(branch.id);
                  }}
                />

                <span>
                  <strong>
                    {branch.name}
                  </strong>

                  <small>
                    {branch.code}
                  </small>
                </span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

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
          isSaving || !selectedUserId
        }
        onClick={() => {
          void save();
        }}
      >
        {isSaving
          ? "در حال ذخیره..."
          : "ذخیره دسترسی‌ها"}
      </button>
    </section>
  );
}
