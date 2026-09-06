import type {
  WarehouseDto,
  WarehouseListItemDto,
  WarehouseLocationDto,
  WarehousePageDto,
  WarehouseZoneDto,
} from "./warehouse-dto.ts";
import type {
  GetWarehouseByCodeQuery,
  GetWarehouseByIdQuery,
  ListWarehouseLocationsQuery,
  ListWarehousesQuery,
  ListWarehouseZonesQuery,
  WarehouseSelectorQuery,
} from "./warehouse-queries.ts";

export interface WarehouseReader {
  getById(query: GetWarehouseByIdQuery): Promise<WarehouseDto | null>;
  getByCode(query: GetWarehouseByCodeQuery): Promise<WarehouseDto | null>;
  list(query: ListWarehousesQuery): Promise<WarehousePageDto<WarehouseListItemDto>>;
  select(query: WarehouseSelectorQuery): Promise<readonly WarehouseListItemDto[]>;
  listZones(query: ListWarehouseZonesQuery): Promise<readonly WarehouseZoneDto[]>;
  listLocations(query: ListWarehouseLocationsQuery): Promise<readonly WarehouseLocationDto[]>;
}
