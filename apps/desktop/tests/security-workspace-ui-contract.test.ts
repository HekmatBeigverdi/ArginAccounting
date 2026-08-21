import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const workspace = read("../src/pages/security/security-workspace.tsx");
const styles = read("../src/pages/security/security-workspace.css");
const usersPage = read("../src/pages/security/users-page.tsx");
const rolesPage = read("../src/pages/security/roles-page.tsx");
const permissionsPage = read("../src/pages/security/permissions-page.tsx");
const loginPage = read("../src/pages/security/login-page.tsx");
const userManagement = read("../src/features/security/user-management.tsx");
const roleManagement = read("../src/features/security/role-management.tsx");
const permissionList = read("../src/features/security/permission-list.tsx");
const rolePermissions = read("../src/features/security/role-permission-management.tsx");
const userAccess = read("../src/features/security/user-access-management.tsx");
const securitySources = [usersPage, rolesPage, permissionsPage, loginPage, userManagement, roleManagement, permissionList, rolePermissions, userAccess];

test("security pages use one shared workspace instead of temporary navigation", () => {
  assert.match(workspace, /<Page className="security-workspace"/u);
  assert.match(workspace, /NavLink/u);
  assert.match(workspace, /\/security\/users/u);
  assert.match(workspace, /\/security\/roles/u);
  assert.match(workspace, /\/security\/permissions/u);
  assert.doesNotMatch(workspace, /\/system\/(users|roles|permissions)/u);
  for (const source of [usersPage, rolesPage, permissionsPage]) {
    assert.match(source, /<SecurityWorkspace/u);
    assert.doesNotMatch(source, /temporary-page/u);
    assert.doesNotMatch(source, /بازگشت به داشبورد/u);
  }
});

test("login uses shared form feedback and layout primitives", () => {
  assert.match(loginPage, /<Panel/u);
  assert.match(loginPage, /<Field/u);
  assert.match(loginPage, /<Input/u);
  assert.match(loginPage, /<Button/u);
  assert.match(loginPage, /<Feedback/u);
  assert.match(loginPage, /authenticateUser/u);
  assert.doesNotMatch(loginPage, /temporary-page|security-panel/u);
});

test("security management uses shared design-system primitives", () => {
  assert.match(userManagement, /<DataTable/u);
  assert.match(userManagement, /<Badge/u);
  assert.match(userManagement, /<Field/u);
  assert.match(roleManagement, /<DataTable/u);
  assert.match(roleManagement, /<Textarea/u);
  assert.match(permissionList, /<DataTable/u);
  assert.match(permissionList, /<Badge/u);
  assert.match(rolePermissions, /<Select/u);
  assert.match(userAccess, /<Select/u);
});

test("existing assignment and authentication boundaries remain in use", () => {
  assert.match(rolePermissions, /replaceRolePermissions/u);
  assert.match(userAccess, /replaceUserRoles/u);
  assert.match(userAccess, /replaceUserBranchAccess/u);
  assert.match(loginPage, /authenticateUser/u);
  assert.match(userManagement, /createUser/u);
  assert.match(roleManagement, /createRole/u);
});

test("disabled system and inactive access states remain explicit", () => {
  assert.match(rolePermissions, /isSystemAdministrator/u);
  assert.match(rolePermissions, /!permission\.isActive/u);
  assert.match(userAccess, /!role\.isActive/u);
  assert.match(userAccess, /branch\.status !== "active"/u);
});

test("security flows no longer rely on development console logging", () => {
  for (const source of securitySources) assert.doesNotMatch(source, /console\.(log|error|debug)/u);
});

test("security workspace is token based responsive and keyboard visible", () => {
  assert.match(styles, /var\(--ui-/u);
  assert.match(styles, /\.security-workspace__tab:focus-visible/u);
  assert.match(styles, /@media \(max-width: 980px\)/u);
  assert.match(styles, /@media \(max-width: 680px\)/u);
});
