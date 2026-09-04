import type {
  WarehouseLocationRepository,
  WarehouseRepository,
  WarehouseZoneRepository,
} from "./warehouse-repository.ts";

export interface WarehouseUnitOfWorkContext {
  readonly warehouses: WarehouseRepository;
  readonly zones: WarehouseZoneRepository;
  readonly locations: WarehouseLocationRepository;
}

export interface WarehouseUnitOfWork {
  execute<T>(work: (context: WarehouseUnitOfWorkContext) => Promise<T>): Promise<T>;
}
