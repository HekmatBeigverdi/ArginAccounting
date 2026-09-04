import {
  createWarehouse,
  rehydrateWarehouse,
} from "../domain/warehouse.ts";
import {
  activateWarehouse,
  archiveWarehouse,
  classifyWarehouse,
  deactivateWarehouse,
  rehydrateClassifiedWarehouse,
} from "../domain/warehouse-lifecycle.ts";
import {
  assignWarehouseOrganizationalScope,
  changeWarehouseOrganizationalScope,
  rehydrateOrganizedWarehouse,
  type OrganizedWarehouseSnapshot,
  type WarehouseBranchReference,
  type WarehouseOrganizationalScope,
} from "../domain/warehouse-organization.ts";
import {
  createWarehouseIdentifierSnapshot,
  normalizeWarehouseCode,
  normalizeWarehouseExternalIdentifier,
  type WarehouseExternalIdentifier,
} from "../domain/warehouse-identifiers.ts";
import {
  createWarehouseLocation,
  createWarehouseZone,
  warehouseReferenceFrom,
} from "../domain/warehouse-physical-structure.ts";
import type {
  ChangeWarehouseScopeCommand,
  ChangeWarehouseStatusCommand,
  CreateWarehouseCommand,
  CreateWarehouseLocationCommand,
  CreateWarehouseZoneCommand,
  UpdateWarehouseCommand,
} from "./contracts/warehouse-commands.ts";
import type {
  WarehouseDto,
  WarehouseListItemDto,
  WarehouseLocationDto,
  WarehousePageDto,
  WarehouseZoneDto,
} from "./contracts/warehouse-dto.ts";
import {
  WAREHOUSE_APPLICATION_ERROR_CODES,
  WarehouseApplicationError,
} from "./contracts/warehouse-errors.ts";
import type {
  GetWarehouseByCodeQuery,
  GetWarehouseByIdQuery,
  ListWarehousesQuery,
  WarehouseSelectorQuery,
} from "./contracts/warehouse-queries.ts";
import type { WarehouseReader } from "./contracts/warehouse-reader.ts";
import type {
  WarehousePersistenceState,
  WarehouseRepository,
} from "./contracts/warehouse-repository.ts";
import type { WarehouseUnitOfWork } from "./contracts/warehouse-unit-of-work.ts";
import type {
  WarehouseBranchResolver,
  WarehouseIdempotencyExecutor,
} from "./contracts/warehouse-validation.ts";

const requireText = (value: string): string => {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new WarehouseApplicationError(
      WAREHOUSE_APPLICATION_ERROR_CODES.invalidRequest,
    );
  }
  return normalized;
};

const normalizeTimestamp = (value: string): string => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new WarehouseApplicationError(
      WAREHOUSE_APPLICATION_ERROR_CODES.invalidRequest,
    );
  }
  return new Date(parsed).toISOString();
};

const assertExpectedVersion = (value: number): number => {
  if (!Number.isInteger(value) || value < 1) {
    throw new WarehouseApplicationError(
      WAREHOUSE_APPLICATION_ERROR_CODES.invalidRequest,
    );
  }
  return value;
};

const toDto = (state: WarehousePersistenceState): WarehouseDto =>
  Object.freeze({
    warehouseId: state.warehouse.warehouseId,
    companyId: state.warehouse.companyId,
    code: state.warehouse.code,
    title: state.warehouse.title,
    description: state.warehouse.description,
    kind: state.warehouse.kind,
    status: state.warehouse.status,
    organizationalScope: state.warehouse.organizationalScope,
    externalIdentifiers: state.externalIdentifiers,
    version: state.version,
    createdAt: state.warehouse.createdAt,
    updatedAt: state.warehouse.updatedAt,
  });

const loadRequired = async (
  repository: WarehouseRepository,
  companyId: string,
  warehouseId: string,
): Promise<WarehousePersistenceState> => {
  const state = await repository.findById(requireText(companyId), requireText(warehouseId));
  if (!state || state.warehouse.companyId !== companyId.trim()) {
    throw new WarehouseApplicationError(
      WAREHOUSE_APPLICATION_ERROR_CODES.notFound,
    );
  }
  return state;
};

const assertVersion = (
  state: WarehousePersistenceState,
  expectedVersion: number,
): void => {
  if (state.version !== assertExpectedVersion(expectedVersion)) {
    throw new WarehouseApplicationError(
      WAREHOUSE_APPLICATION_ERROR_CODES.concurrencyConflict,
    );
  }
};

const resolveBranch = async (
  resolver: WarehouseBranchResolver,
  companyId: string,
  scope: WarehouseOrganizationalScope,
): Promise<WarehouseBranchReference | undefined> => {
  if (scope.mode === "company") {
    return undefined;
  }
  const branch = await resolver.findById(companyId, requireText(scope.branchId));
  if (!branch || branch.companyId !== companyId) {
    throw new WarehouseApplicationError(
      WAREHOUSE_APPLICATION_ERROR_CODES.branchReferenceInvalid,
    );
  }
  return branch;
};

const assertIdentifierAvailability = async (
  repository: WarehouseRepository,
  companyId: string,
  warehouseId: string,
  code: string,
  identifiers: readonly WarehouseExternalIdentifier[],
): Promise<void> => {
  const byCode = await repository.findByCode(companyId, normalizeWarehouseCode(code));
  if (byCode && byCode.warehouse.warehouseId !== warehouseId) {
    throw new WarehouseApplicationError(
      WAREHOUSE_APPLICATION_ERROR_CODES.duplicateIdentifier,
    );
  }

  for (const identifier of identifiers.map(normalizeWarehouseExternalIdentifier)) {
    const existing = await repository.findByExternalIdentifier(
      companyId,
      identifier.namespace,
      identifier.value,
    );
    if (existing && existing.warehouse.warehouseId !== warehouseId) {
      throw new WarehouseApplicationError(
        WAREHOUSE_APPLICATION_ERROR_CODES.duplicateIdentifier,
      );
    }
  }
};

const rehydrateWithIdentityChanges = async (
  state: WarehousePersistenceState,
  command: UpdateWarehouseCommand,
  branches: WarehouseBranchResolver,
): Promise<OrganizedWarehouseSnapshot> => {
  const updatedAt = normalizeTimestamp(command.occurredAt);
  const base = rehydrateWarehouse({
    warehouseId: state.warehouse.warehouseId,
    companyId: state.warehouse.companyId,
    code: command.code,
    title: command.title,
    description: command.description ?? null,
    createdAt: state.warehouse.createdAt,
    updatedAt,
  });
  const classified = rehydrateClassifiedWarehouse({
    ...base,
    kind: state.warehouse.kind,
    status: state.warehouse.status,
  });
  const branch = await resolveBranch(
    branches,
    state.warehouse.companyId,
    state.warehouse.organizationalScope,
  );
  return rehydrateOrganizedWarehouse(
    { ...classified, organizationalScope: state.warehouse.organizationalScope },
    branch,
  );
};

export interface WarehouseServiceDependencies {
  readonly unitOfWork: WarehouseUnitOfWork;
  readonly reader: WarehouseReader;
  readonly idempotency: WarehouseIdempotencyExecutor;
  readonly branches: WarehouseBranchResolver;
}

export class WarehouseService {
  constructor(private readonly dependencies: WarehouseServiceDependencies) {}

  getById(query: GetWarehouseByIdQuery): Promise<WarehouseDto | null> {
    return this.dependencies.reader.getById(query);
  }

  getByCode(query: GetWarehouseByCodeQuery): Promise<WarehouseDto | null> {
    return this.dependencies.reader.getByCode(query);
  }

  list(query: ListWarehousesQuery): Promise<WarehousePageDto<WarehouseListItemDto>> {
    return this.dependencies.reader.list(query);
  }

  select(query: WarehouseSelectorQuery): Promise<readonly WarehouseListItemDto[]> {
    return this.dependencies.reader.select(query);
  }

  async create(command: CreateWarehouseCommand): Promise<WarehouseDto> {
    const companyId = requireText(command.companyId);
    const requestId = requireText(command.requestId);
    return this.dependencies.idempotency.run(
      `warehouse:create:${companyId}`,
      requestId,
      async () => this.dependencies.unitOfWork.execute(async ({ warehouses }) => {
        if (await warehouses.findById(companyId, requireText(command.warehouseId))) {
          throw new WarehouseApplicationError(
            WAREHOUSE_APPLICATION_ERROR_CODES.duplicateIdentifier,
          );
        }

        const externalIdentifiers = command.externalIdentifiers ?? [];
        await assertIdentifierAvailability(
          warehouses,
          companyId,
          command.warehouseId,
          command.code,
          externalIdentifiers,
        );

        const base = createWarehouse({
          warehouseId: command.warehouseId,
          companyId,
          code: command.code,
          title: command.title,
          description: command.description,
          createdAt: normalizeTimestamp(command.occurredAt),
        });
        const classified = classifyWarehouse({ warehouse: base, kind: command.kind });
        const branch = await resolveBranch(
          this.dependencies.branches,
          companyId,
          command.organizationalScope,
        );
        const organized = assignWarehouseOrganizationalScope({
          warehouse: classified,
          scope: command.organizationalScope,
          ...(branch ? { branch } : {}),
        });
        const identifiers = createWarehouseIdentifierSnapshot(
          organized,
          externalIdentifiers,
        );
        const state: WarehousePersistenceState = Object.freeze({
          warehouse: organized,
          externalIdentifiers: identifiers.externalIdentifiers,
          version: 1,
        });
        await warehouses.add(state);
        return toDto(state);
      }),
    );
  }

  async update(command: UpdateWarehouseCommand): Promise<WarehouseDto> {
    const companyId = requireText(command.companyId);
    const requestId = requireText(command.requestId);
    return this.dependencies.idempotency.run(
      `warehouse:update:${companyId}:${requireText(command.warehouseId)}`,
      requestId,
      async () => this.dependencies.unitOfWork.execute(async ({ warehouses }) => {
        const current = await loadRequired(warehouses, companyId, command.warehouseId);
        assertVersion(current, command.expectedVersion);
        const externalIdentifiers = command.externalIdentifiers ?? [];
        await assertIdentifierAvailability(
          warehouses,
          companyId,
          current.warehouse.warehouseId,
          command.code,
          externalIdentifiers,
        );
        const warehouse = await rehydrateWithIdentityChanges(
          current,
          command,
          this.dependencies.branches,
        );
        const identifiers = createWarehouseIdentifierSnapshot(
          warehouse,
          externalIdentifiers,
        );
        const next: WarehousePersistenceState = Object.freeze({
          warehouse,
          externalIdentifiers: identifiers.externalIdentifiers,
          version: current.version + 1,
        });
        await warehouses.update(next, command.expectedVersion);
        return toDto(next);
      }),
    );
  }

  async changeStatus(command: ChangeWarehouseStatusCommand): Promise<WarehouseDto> {
    const companyId = requireText(command.companyId);
    return this.dependencies.idempotency.run(
      `warehouse:status:${companyId}:${requireText(command.warehouseId)}`,
      requireText(command.requestId),
      async () => this.dependencies.unitOfWork.execute(async ({ warehouses }) => {
        const current = await loadRequired(warehouses, companyId, command.warehouseId);
        assertVersion(current, command.expectedVersion);
        const target = command.targetStatus;
        const warehouse = target === "active"
          ? activateWarehouse(current.warehouse, command.occurredAt)
          : target === "inactive"
            ? deactivateWarehouse(current.warehouse, command.occurredAt)
            : target === "archived"
              ? archiveWarehouse(current.warehouse, command.occurredAt)
              : (() => {
                  throw new WarehouseApplicationError(
                    WAREHOUSE_APPLICATION_ERROR_CODES.invalidRequest,
                  );
                })();
        if (warehouse === current.warehouse) {
          return toDto(current);
        }
        const next: WarehousePersistenceState = Object.freeze({
          ...current,
          warehouse,
          version: current.version + 1,
        });
        await warehouses.update(next, command.expectedVersion);
        return toDto(next);
      }),
    );
  }

  async changeScope(command: ChangeWarehouseScopeCommand): Promise<WarehouseDto> {
    const companyId = requireText(command.companyId);
    return this.dependencies.idempotency.run(
      `warehouse:scope:${companyId}:${requireText(command.warehouseId)}`,
      requireText(command.requestId),
      async () => this.dependencies.unitOfWork.execute(async ({ warehouses }) => {
        const current = await loadRequired(warehouses, companyId, command.warehouseId);
        assertVersion(current, command.expectedVersion);
        const branch = await resolveBranch(
          this.dependencies.branches,
          companyId,
          command.organizationalScope,
        );
        const warehouse = changeWarehouseOrganizationalScope({
          warehouse: current.warehouse,
          scope: command.organizationalScope,
          occurredAt: normalizeTimestamp(command.occurredAt),
          ...(branch ? { branch } : {}),
        });
        if (warehouse === current.warehouse) {
          return toDto(current);
        }
        const next: WarehousePersistenceState = Object.freeze({
          ...current,
          warehouse,
          version: current.version + 1,
        });
        await warehouses.update(next, command.expectedVersion);
        return toDto(next);
      }),
    );
  }

  async createZone(command: CreateWarehouseZoneCommand): Promise<WarehouseZoneDto> {
    const companyId = requireText(command.companyId);
    return this.dependencies.idempotency.run(
      `warehouse:zone:create:${companyId}:${requireText(command.warehouseId)}`,
      requireText(command.requestId),
      async () => this.dependencies.unitOfWork.execute(async ({ warehouses, zones }) => {
        const warehouse = await loadRequired(warehouses, companyId, command.warehouseId);
        if (warehouse.warehouse.status === "archived") {
          throw new WarehouseApplicationError(
            WAREHOUSE_APPLICATION_ERROR_CODES.archivedMutationForbidden,
          );
        }
        if (await zones.findById(companyId, requireText(command.zoneId))) {
          throw new WarehouseApplicationError(
            WAREHOUSE_APPLICATION_ERROR_CODES.duplicateIdentifier,
          );
        }
        const zone = createWarehouseZone({
          zoneId: command.zoneId,
          warehouse: warehouseReferenceFrom(warehouse.warehouse),
          code: command.code,
          title: command.title,
          description: command.description,
          createdAt: normalizeTimestamp(command.occurredAt),
        });
        await zones.add(zone);
        return zone;
      }),
    );
  }

  async createLocation(
    command: CreateWarehouseLocationCommand,
  ): Promise<WarehouseLocationDto> {
    const companyId = requireText(command.companyId);
    return this.dependencies.idempotency.run(
      `warehouse:location:create:${companyId}:${requireText(command.warehouseId)}`,
      requireText(command.requestId),
      async () => this.dependencies.unitOfWork.execute(async ({ warehouses, zones, locations }) => {
        const warehouse = await loadRequired(warehouses, companyId, command.warehouseId);
        if (warehouse.warehouse.status === "archived") {
          throw new WarehouseApplicationError(
            WAREHOUSE_APPLICATION_ERROR_CODES.archivedMutationForbidden,
          );
        }
        if (await locations.findById(companyId, requireText(command.locationId))) {
          throw new WarehouseApplicationError(
            WAREHOUSE_APPLICATION_ERROR_CODES.duplicateIdentifier,
          );
        }
        const zone = await zones.findById(companyId, requireText(command.zoneId));
        if (!zone || zone.warehouseId !== warehouse.warehouse.warehouseId) {
          throw new WarehouseApplicationError(
            WAREHOUSE_APPLICATION_ERROR_CODES.notFound,
          );
        }
        if (command.parentLocationId) {
          const parent = await locations.findById(
            companyId,
            requireText(command.parentLocationId),
          );
          if (!parent || parent.warehouseId !== zone.warehouseId || parent.zoneId !== zone.zoneId) {
            throw new WarehouseApplicationError(
              WAREHOUSE_APPLICATION_ERROR_CODES.invalidRequest,
            );
          }
        }
        const location = createWarehouseLocation({
          locationId: command.locationId,
          zone,
          warehouse: warehouseReferenceFrom(warehouse.warehouse),
          parentLocationId: command.parentLocationId,
          code: command.code,
          title: command.title,
          kind: command.kind,
          description: command.description,
          createdAt: normalizeTimestamp(command.occurredAt),
        });
        await locations.add(location);
        return location;
      }),
    );
  }
}
