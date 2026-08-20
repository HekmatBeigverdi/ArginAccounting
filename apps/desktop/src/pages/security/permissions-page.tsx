import { PermissionList } from "../../features/security/permission-list";
import { SecurityWorkspace } from "./security-workspace";

export function PermissionsPage() {
  return (
    <SecurityWorkspace
      title="مجوزها"
      description="فهرست مجوزهای تعریف‌شده برای ماژول‌های نرم‌افزار و وضعیت فعال بودن آن‌ها را مشاهده کنید."
    >
      <PermissionList />
    </SecurityWorkspace>
  );
}
