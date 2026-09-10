import type { InventoryDocumentLineSnapshot } from "@argin/inventory";
import type { InventoryLineLocationTitles } from "@argin/inventory-tauri";

export function formatInventoryLineLocation(
  line: InventoryDocumentLineSnapshot,
  titles: InventoryLineLocationTitles | undefined,
  destination = false,
): string {
  const reference = destination
    ? line.operation?.destination
    : line.operation?.warehouse;
  if (!reference) return "—";
  const warehouse = destination
    ? titles?.destinationWarehouseTitle
    : titles?.warehouseTitle;
  const zone = destination ? titles?.destinationZoneTitle : titles?.zoneTitle;
  const location = destination
    ? titles?.destinationLocationTitle
    : titles?.locationTitle;
  return [
    warehouse ?? "نام انبار در دسترس نیست",
    ...(reference.zoneId ? [zone ?? "نام ناحیه در دسترس نیست"] : []),
    ...(reference.locationId ? [location ?? "نام موقعیت در دسترس نیست"] : []),
  ].join(" / ");
}
