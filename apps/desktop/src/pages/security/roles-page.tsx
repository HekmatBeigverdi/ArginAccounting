import { RoleManagement } from "../../features/security/role-management";
import { RolePermissionManagement } from "../../features/security/role-permission-management";
import { SecurityWorkspace } from "./security-workspace";

export function RolesPage() {
  return (
    <SecurityWorkspace
      title="نقش‌ها"
      description="نقش‌های سازمانی را تعریف کنید و مجوزهای هر نقش را بدون تغییر قواعد امنیتی سیستم مدیریت کنید."
    >
      <div className="security-feature-stack">
        <RoleManagement />
        <RolePermissionManagement />
      </div>
    </SecurityWorkspace>
  );
}
