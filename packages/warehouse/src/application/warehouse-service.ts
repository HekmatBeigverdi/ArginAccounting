import {
  createWarehouse,
  rehydrateWarehouse,
} from "../domain/warehouse.ts";
import {
  activateWarehouse,
  archiveWarehouse,
  restoreWarehouse,
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
  assertLocationParentAcyclic,
  createWarehouseLocation,
  createWarehouseZone,
  moveWarehouseLocation,
  setWarehouseLocationStatus,
  setWarehouseZoneStatus,
  updateWarehouseLocation,
  updateWarehouseZone,
  warehouseReferenceFrom,
} from "../domain/warehouse-physical-structure.ts";
import type {
  ChangeWarehouseLocationStatusCommand,
  ChangeWarehouseScopeCommand,
  ChangeWarehouseStatusCommand,
  ChangeWarehouseZoneStatusCommand,
  CreateWarehouseCommand,
  CreateWarehouseLocationCommand,
  CreateWarehouseZoneCommand,
  DeleteWarehouseCommand,
  DeleteWarehouseLocationCommand,
  DeleteWarehouseZoneCommand,
  MoveWarehouseLocationCommand,
  RestoreWarehouseCommand,
  UpdateWarehouseCommand,
  UpdateWarehouseLocationCommand,
  UpdateWarehouseZoneCommand,
} from "./contracts/warehouse-commands.ts";
import type {
  WarehouseDto,
  WarehouseListItemDto,
  WarehouseLocationDto,
  WarehousePageDto,
  WarehouseZoneDto,
} from "./contracts/warehouse-dto.ts";
import {
  allowUnintegratedWarehouseDependencies,
  type WarehouseDependencyGuard,
  type WarehouseProtectedOperation,
} from "./contracts/warehouse-dependencies.ts";
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
  if (normalized.length === 0) throw new WarehouseApplicationError(WAREHOUSE_APPLICATION_ERROR_CODES.invalidRequest);
  return normalized;
};

const normalizeTimestamp = (value: string): string => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new WarehouseApplicationError(WAREHOUSE_APPLICATION_ERROR_CODES.invalidRequest);
  return new Date(parsed).toISOString();
};

const assertExpectedVersion = (value: number): number => {
  if (!Number.isInteger(value) || value < 1) throw new WarehouseApplicationError(WAREHOUSE_APPLICATION_ERROR_CODES.invalidRequest);
  return value;
};

const toDto = (state: WarehousePersistenceState): WarehouseDto => Object.freeze({
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

const loadRequired = async (repository: WarehouseRepository, companyId: string, warehouseId: string): Promise<WarehousePersistenceState> => {
  const state = await repository.findById(requireText(companyId), requireText(warehouseId));
  if (!state || state.warehouse.companyId !== companyId.trim()) throw new WarehouseApplicationError(WAREHOUSE_APPLICATION_ERROR_CODES.notFound);
  return state;
};

const assertVersion = (state: WarehousePersistenceState, expectedVersion: number): void => {
  if (state.version !== assertExpectedVersion(expectedVersion)) throw new WarehouseApplicationError(WAREHOUSE_APPLICATION_ERROR_CODES.concurrencyConflict);
};

const resolveBranch = async (resolver: WarehouseBranchResolver, companyId: string, scope: WarehouseOrganizationalScope): Promise<WarehouseBranchReference | undefined> => {
  if (scope.mode === "company") return undefined;
  const branch = await resolver.findById(companyId, requireText(scope.branchId));
  if (!branch || branch.companyId !== companyId) throw new WarehouseApplicationError(WAREHOUSE_APPLICATION_ERROR_CODES.branchReferenceInvalid);
  return branch;
};

const assertIdentifierAvailability = async (repository: WarehouseRepository, companyId: string, warehouseId: string, code: string, identifiers: readonly WarehouseExternalIdentifier[]): Promise<void> => {
  const byCode = await repository.findByCode(companyId, normalizeWarehouseCode(code));
  if (byCode && byCode.warehouse.warehouseId !== warehouseId) throw new WarehouseApplicationError(WAREHOUSE_APPLICATION_ERROR_CODES.duplicateIdentifier);
  for (const identifier of identifiers.map(normalizeWarehouseExternalIdentifier)) {
    const existing = await repository.findByExternalIdentifier(companyId, identifier.namespace, identifier.value);
    if (existing && existing.warehouse.warehouseId !== warehouseId) throw new WarehouseApplicationError(WAREHOUSE_APPLICATION_ERROR_CODES.duplicateIdentifier);
  }
};

const rehydrateWithIdentityChanges = async (state: WarehousePersistenceState, command: UpdateWarehouseCommand, branches: WarehouseBranchResolver): Promise<OrganizedWarehouseSnapshot> => {
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
  const classified = rehydrateClassifiedWarehouse({ ...base, kind: state.warehouse.kind, status: state.warehouse.status });
  const branch = await resolveBranch(branches, state.warehouse.companyId, state.warehouse.organizationalScope);
  return rehydrateOrganizedWarehouse({ ...classified, organizationalScope: state.warehouse.organizationalScope }, branch);
};

export interface WarehouseServiceDependencies {
  readonly unitOfWork: WarehouseUnitOfWork;
  readonly reader: WarehouseReader;
  readonly idempotency: WarehouseIdempotencyExecutor;
  readonly branches: WarehouseBranchResolver;
  readonly dependencyGuard?: WarehouseDependencyGuard;
}

export class WarehouseService {
  constructor(private readonly dependencies: WarehouseServiceDependencies) {}

  getById(query: GetWarehouseByIdQuery): Promise<WarehouseDto | null> { return this.dependencies.reader.getById(query); }
  getByCode(query: GetWarehouseByCodeQuery): Promise<WarehouseDto | null> { return this.dependencies.reader.getByCode(query); }
  list(query: ListWarehousesQuery): Promise<WarehousePageDto<WarehouseListItemDto>> { return this.dependencies.reader.list(query); }
  select(query: WarehouseSelectorQuery): Promise<readonly WarehouseListItemDto[]> { return this.dependencies.reader.select(query); }

  private async assertDependencies(input: { companyId: string; operation: WarehouseProtectedOperation; warehouseId: string; zoneId?: string | null; locationId?: string | null }): Promise<void> {
    const guard = this.dependencies.dependencyGuard ?? allowUnintegratedWarehouseDependencies;
    const result = await guard.check(input);
    if (!result.allowed || result.blockers.length > 0) throw new WarehouseApplicationError(WAREHOUSE_APPLICATION_ERROR_CODES.dependencyBlocked);
  }

  async create(command: CreateWarehouseCommand): Promise<WarehouseDto> {
    const companyId = requireText(command.companyId);
    return this.dependencies.idempotency.run(`warehouse:create:${companyId}`, requireText(command.requestId), async () => this.dependencies.unitOfWork.execute(async ({ warehouses }) => {
      if (await warehouses.findById(companyId, requireText(command.warehouseId))) throw new WarehouseApplicationError(WAREHOUSE_APPLICATION_ERROR_CODES.duplicateIdentifier);
      const externalIdentifiers = command.externalIdentifiers ?? [];
      await assertIdentifierAvailability(warehouses, companyId, command.warehouseId, command.code, externalIdentifiers);
      const base = createWarehouse({ warehouseId: command.warehouseId, companyId, code: command.code, title: command.title, description: command.description ?? null, createdAt: normalizeTimestamp(command.occurredAt) });
      const classified = classifyWarehouse({ warehouse: base, kind: command.kind });
      const branch = await resolveBranch(this.dependencies.branches, companyId, command.organizationalScope);
      const organized = assignWarehouseOrganizationalScope({ warehouse: classified, scope: command.organizationalScope, ...(branch ? { branch } : {}) });
      const identifiers = createWarehouseIdentifierSnapshot(organized, externalIdentifiers);
      const state: WarehousePersistenceState = Object.freeze({ warehouse: organized, externalIdentifiers: identifiers.externalIdentifiers, version: 1 });
      await warehouses.add(state);
      return toDto(state);
    }));
  }

  async update(command: UpdateWarehouseCommand): Promise<WarehouseDto> {
    const companyId = requireText(command.companyId);
    return this.dependencies.idempotency.run(`warehouse:update:${companyId}:${requireText(command.warehouseId)}`, requireText(command.requestId), async () => this.dependencies.unitOfWork.execute(async ({ warehouses }) => {
      const current = await loadRequired(warehouses, companyId, command.warehouseId);
      assertVersion(current, command.expectedVersion);
      const externalIdentifiers = command.externalIdentifiers ?? [];
      await assertIdentifierAvailability(warehouses, companyId, current.warehouse.warehouseId, command.code, externalIdentifiers);
      const warehouse = await rehydrateWithIdentityChanges(current, command, this.dependencies.branches);
      const identifiers = createWarehouseIdentifierSnapshot(warehouse, externalIdentifiers);
      const next: WarehousePersistenceState = Object.freeze({ warehouse, externalIdentifiers: identifiers.externalIdentifiers, version: current.version + 1 });
      await warehouses.update(next, command.expectedVersion);
      return toDto(next);
    }));
  }

  async changeStatus(command: ChangeWarehouseStatusCommand): Promise<WarehouseDto> {
    const companyId = requireText(command.companyId);
    return this.dependencies.idempotency.run(`warehouse:status:${companyId}:${requireText(command.warehouseId)}`, requireText(command.requestId), async () => this.dependencies.unitOfWork.execute(async ({ warehouses }) => {
      const current = await loadRequired(warehouses, companyId, command.warehouseId);
      assertVersion(current, command.expectedVersion);
      if (command.targetStatus === "inactive") await this.assertDependencies({ companyId, operation: "warehouse.deactivate", warehouseId: current.warehouse.warehouseId });
      if (command.targetStatus === "archived") await this.assertDependencies({ companyId, operation: "warehouse.archive", warehouseId: current.warehouse.warehouseId });
      const warehouse = command.targetStatus === "active"
        ? activateWarehouse(current.warehouse, command.occurredAt)
        : command.targetStatus === "inactive"
          ? deactivateWarehouse(current.warehouse, command.occurredAt)
          : command.targetStatus === "archived"
            ? archiveWarehouse(current.warehouse, command.occurredAt)
            : (() => { throw new WarehouseApplicationError(WAREHOUSE_APPLICATION_ERROR_CODES.invalidRequest); })();
      if (warehouse === current.warehouse) return toDto(current);
      const next: WarehousePersistenceState = Object.freeze({
        ...current,
        warehouse: Object.freeze({ ...warehouse, organizationalScope: current.warehouse.organizationalScope }),
        version: current.version + 1,
      });
      await warehouses.update(next, command.expectedVersion);
      return toDto(next);
    }));
  }

  async restore(command: RestoreWarehouseCommand): Promise<WarehouseDto> {
    const companyId = requireText(command.companyId);
    const warehouseId = requireText(command.warehouseId);
    return this.dependencies.idempotency.run(
      `warehouse:restore:${companyId}:${warehouseId}`,
      requireText(command.requestId),
      async () => this.dependencies.unitOfWork.execute(async ({ warehouses }) => {
        const current = await loadRequired(warehouses, companyId, warehouseId);
        assertVersion(current, command.expectedVersion);
        const restored = restoreWarehouse(current.warehouse, command.occurredAt);
        const next: WarehousePersistenceState = Object.freeze({
          ...current,
          warehouse: Object.freeze({ ...restored, organizationalScope: current.warehouse.organizationalScope }),
          version: current.version + 1,
        });
        await warehouses.update(next, command.expectedVersion);
        return toDto(next);
      }),
    );
  }

  async changeScope(command: ChangeWarehouseScopeCommand): Promise<WarehouseDto> {
    const companyId = requireText(command.companyId);
    return this.dependencies.idempotency.run(`warehouse:scope:${companyId}:${requireText(command.warehouseId)}`, requireText(command.requestId), async () => this.dependencies.unitOfWork.execute(async ({ warehouses }) => {
      const current = await loadRequired(warehouses, companyId, command.warehouseId);
      assertVersion(current, command.expectedVersion);
      const branch = await resolveBranch(this.dependencies.branches, companyId, command.organizationalScope);
      const warehouse = changeWarehouseOrganizationalScope({ warehouse: current.warehouse, scope: command.organizationalScope, occurredAt: normalizeTimestamp(command.occurredAt), ...(branch ? { branch } : {}) });
      if (warehouse === current.warehouse) return toDto(current);
      const next: WarehousePersistenceState = Object.freeze({ ...current, warehouse, version: current.version + 1 });
      await warehouses.update(next, command.expectedVersion);
      return toDto(next);
    }));
  }

  async deleteWarehouse(command: DeleteWarehouseCommand): Promise<void> {
    const companyId = requireText(command.companyId);
    return this.dependencies.idempotency.run(`warehouse:delete:${companyId}:${requireText(command.warehouseId)}`, requireText(command.requestId), async () => this.dependencies.unitOfWork.execute(async ({ warehouses, zones, locations }) => {
      const current = await loadRequired(warehouses, companyId, command.warehouseId);
      assertVersion(current, command.expectedVersion);
      const [zoneRows, locationRows] = await Promise.all([zones.listByWarehouse(companyId, current.warehouse.warehouseId), locations.listByWarehouse(companyId, current.warehouse.warehouseId)]);
      if (zoneRows.length > 0 || locationRows.length > 0) throw new WarehouseApplicationError(WAREHOUSE_APPLICATION_ERROR_CODES.structuralDependencyBlocked);
      await this.assertDependencies({ companyId, operation: "warehouse.delete", warehouseId: current.warehouse.warehouseId });
      await warehouses.markDeleted(companyId, current.warehouse.warehouseId, command.expectedVersion, normalizeTimestamp(command.occurredAt));
    }));
  }

  async createZone(command: CreateWarehouseZoneCommand): Promise<WarehouseZoneDto> {
    const companyId = requireText(command.companyId);
    return this.dependencies.idempotency.run(`warehouse:zone:create:${companyId}:${requireText(command.warehouseId)}`, requireText(command.requestId), async () => this.dependencies.unitOfWork.execute(async ({ warehouses, zones }) => {
      const warehouse = await loadRequired(warehouses, companyId, command.warehouseId);
      if (warehouse.warehouse.status === "archived") throw new WarehouseApplicationError(WAREHOUSE_APPLICATION_ERROR_CODES.archivedMutationForbidden);
      if (await zones.findById(companyId, requireText(command.zoneId))) throw new WarehouseApplicationError(WAREHOUSE_APPLICATION_ERROR_CODES.duplicateIdentifier);
      const zone = createWarehouseZone({ zoneId: command.zoneId, warehouse: warehouseReferenceFrom(warehouse.warehouse), code: command.code, title: command.title, description: command.description ?? null, createdAt: normalizeTimestamp(command.occurredAt) });
      await zones.add(zone);
      return zone;
    }));
  }

  async updateZone(command: UpdateWarehouseZoneCommand): Promise<WarehouseZoneDto> {
    const companyId = requireText(command.companyId);
    return this.dependencies.idempotency.run(`warehouse:zone:update:${companyId}:${requireText(command.zoneId)}`, requireText(command.requestId), async () => this.dependencies.unitOfWork.execute(async ({ warehouses, zones }) => {
      const warehouse = await loadRequired(warehouses, companyId, command.warehouseId);
      if (warehouse.warehouse.status === "archived") throw new WarehouseApplicationError(WAREHOUSE_APPLICATION_ERROR_CODES.archivedMutationForbidden);
      const current = await zones.findById(companyId, requireText(command.zoneId));
      if (!current || current.warehouseId !== warehouse.warehouse.warehouseId) throw new WarehouseApplicationError(WAREHOUSE_APPLICATION_ERROR_CODES.notFound);
      const next = updateWarehouseZone({ zone: current, code: command.code, title: command.title, description: command.description ?? null, occurredAt: command.occurredAt });
      await zones.update(next);
      return next;
    }));
  }

  async changeZoneStatus(command: ChangeWarehouseZoneStatusCommand): Promise<WarehouseZoneDto> {
    const companyId = requireText(command.companyId);
    return this.dependencies.idempotency.run(`warehouse:zone:status:${companyId}:${requireText(command.zoneId)}`, requireText(command.requestId), async () => this.dependencies.unitOfWork.execute(async ({ zones, locations }) => {
      const current = await zones.findById(companyId, requireText(command.zoneId));
      if (!current || current.warehouseId !== command.warehouseId) throw new WarehouseApplicationError(WAREHOUSE_APPLICATION_ERROR_CODES.notFound);
      if (command.targetStatus === "inactive") {
        const children = await locations.listByZone(companyId, current.warehouseId, current.zoneId);
        if (children.some((item) => item.status === "active")) throw new WarehouseApplicationError(WAREHOUSE_APPLICATION_ERROR_CODES.structuralDependencyBlocked);
        await this.assertDependencies({ companyId, operation: "zone.deactivate", warehouseId: current.warehouseId, zoneId: current.zoneId });
      }
      const next = setWarehouseZoneStatus(current, command.targetStatus, command.occurredAt);
      if (next !== current) await zones.update(next);
      return next;
    }));
  }

  async deleteZone(command: DeleteWarehouseZoneCommand): Promise<void> {
    const companyId = requireText(command.companyId);
    return this.dependencies.idempotency.run(`warehouse:zone:delete:${companyId}:${requireText(command.zoneId)}`, requireText(command.requestId), async () => this.dependencies.unitOfWork.execute(async ({ zones, locations }) => {
      const current = await zones.findById(companyId, requireText(command.zoneId));
      if (!current || current.warehouseId !== command.warehouseId) throw new WarehouseApplicationError(WAREHOUSE_APPLICATION_ERROR_CODES.notFound);
      if ((await locations.listByZone(companyId, current.warehouseId, current.zoneId)).length > 0) throw new WarehouseApplicationError(WAREHOUSE_APPLICATION_ERROR_CODES.structuralDependencyBlocked);
      await this.assertDependencies({ companyId, operation: "zone.delete", warehouseId: current.warehouseId, zoneId: current.zoneId });
      await zones.markDeleted(companyId, current.warehouseId, current.zoneId, normalizeTimestamp(command.occurredAt));
    }));
  }

  async createLocation(command: CreateWarehouseLocationCommand): Promise<WarehouseLocationDto> {
    const companyId = requireText(command.companyId);
    return this.dependencies.idempotency.run(`warehouse:location:create:${companyId}:${requireText(command.warehouseId)}`, requireText(command.requestId), async () => this.dependencies.unitOfWork.execute(async ({ warehouses, zones, locations }) => {
      const warehouse = await loadRequired(warehouses, companyId, command.warehouseId);
      if (warehouse.warehouse.status === "archived") throw new WarehouseApplicationError(WAREHOUSE_APPLICATION_ERROR_CODES.archivedMutationForbidden);
      if (await locations.findById(companyId, requireText(command.locationId))) throw new WarehouseApplicationError(WAREHOUSE_APPLICATION_ERROR_CODES.duplicateIdentifier);
      const zone = await zones.findById(companyId, requireText(command.zoneId));
      if (!zone || zone.warehouseId !== warehouse.warehouse.warehouseId) throw new WarehouseApplicationError(WAREHOUSE_APPLICATION_ERROR_CODES.notFound);
      if (command.parentLocationId) {
        const parent = await locations.findById(companyId, requireText(command.parentLocationId));
        if (!parent || parent.warehouseId !== zone.warehouseId || parent.zoneId !== zone.zoneId) throw new WarehouseApplicationError(WAREHOUSE_APPLICATION_ERROR_CODES.invalidRequest);
      }
      const location = createWarehouseLocation({ locationId: command.locationId, zone, warehouse: warehouseReferenceFrom(warehouse.warehouse), parentLocationId: command.parentLocationId ?? null, code: command.code, title: command.title, kind: command.kind, description: command.description ?? null, createdAt: normalizeTimestamp(command.occurredAt) });
      await locations.add(location);
      return location;
    }));
  }

  async updateLocation(command: UpdateWarehouseLocationCommand): Promise<WarehouseLocationDto> {
    const companyId = requireText(command.companyId);
    return this.dependencies.idempotency.run(`warehouse:location:update:${companyId}:${requireText(command.locationId)}`, requireText(command.requestId), async () => this.dependencies.unitOfWork.execute(async ({ locations }) => {
      const current = await locations.findById(companyId, requireText(command.locationId));
      if (!current) throw new WarehouseApplicationError(WAREHOUSE_APPLICATION_ERROR_CODES.notFound);
      const next = updateWarehouseLocation({ location: current, code: command.code, title: command.title, kind: command.kind, description: command.description ?? null, occurredAt: command.occurredAt });
      await locations.update(next);
      return next;
    }));
  }

  async changeLocationStatus(command: ChangeWarehouseLocationStatusCommand): Promise<WarehouseLocationDto> {
    const companyId = requireText(command.companyId);
    return this.dependencies.idempotency.run(`warehouse:location:status:${companyId}:${requireText(command.locationId)}`, requireText(command.requestId), async () => this.dependencies.unitOfWork.execute(async ({ locations }) => {
      const current = await locations.findById(companyId, requireText(command.locationId));
      if (!current) throw new WarehouseApplicationError(WAREHOUSE_APPLICATION_ERROR_CODES.notFound);
      if (command.targetStatus === "inactive") {
        const all = await locations.listByWarehouse(companyId, current.warehouseId);
        const descendants = collectDescendants(current.locationId, all);
        if (descendants.some((item) => item.status === "active")) throw new WarehouseApplicationError(WAREHOUSE_APPLICATION_ERROR_CODES.structuralDependencyBlocked);
        await this.assertDependencies({ companyId, operation: "location.deactivate", warehouseId: current.warehouseId, zoneId: current.zoneId, locationId: current.locationId });
      }
      const next = setWarehouseLocationStatus(current, command.targetStatus, command.occurredAt);
      if (next !== current) await locations.update(next);
      return next;
    }));
  }

  async moveLocation(command: MoveWarehouseLocationCommand): Promise<WarehouseLocationDto> {
    const companyId = requireText(command.companyId);
    return this.dependencies.idempotency.run(`warehouse:location:move:${companyId}:${requireText(command.locationId)}`, requireText(command.requestId), async () => this.dependencies.unitOfWork.execute(async ({ warehouses, zones, locations }) => {
      const current = await locations.findById(companyId, requireText(command.locationId));
      if (!current) throw new WarehouseApplicationError(WAREHOUSE_APPLICATION_ERROR_CODES.notFound);
      const targetWarehouse = await loadRequired(warehouses, companyId, command.targetWarehouseId);
      if (targetWarehouse.warehouse.status === "archived") throw new WarehouseApplicationError(WAREHOUSE_APPLICATION_ERROR_CODES.archivedMutationForbidden);
      const targetZone = await zones.findById(companyId, requireText(command.targetZoneId));
      if (!targetZone || targetZone.warehouseId !== targetWarehouse.warehouse.warehouseId || targetZone.status !== "active") throw new WarehouseApplicationError(WAREHOUSE_APPLICATION_ERROR_CODES.invalidRequest);
      const allCurrent = await locations.listByWarehouse(companyId, current.warehouseId);
      const descendants = collectDescendants(current.locationId, allCurrent);
      const crossingContainer = current.warehouseId !== targetWarehouse.warehouse.warehouseId || current.zoneId !== targetZone.zoneId;
      if (crossingContainer && descendants.length > 0) throw new WarehouseApplicationError(WAREHOUSE_APPLICATION_ERROR_CODES.structuralDependencyBlocked);
      let parentId: string | null = null;
      if (command.parentLocationId) {
        const parent = await locations.findById(companyId, requireText(command.parentLocationId));
        if (!parent || parent.warehouseId !== targetWarehouse.warehouse.warehouseId || parent.zoneId !== targetZone.zoneId || parent.status !== "active") throw new WarehouseApplicationError(WAREHOUSE_APPLICATION_ERROR_CODES.invalidRequest);
        parentId = parent.locationId;
      }
      if (!crossingContainer) {
        const parentMap = new Map(allCurrent.map((item) => [item.locationId, item.parentLocationId] as const));
        try { assertLocationParentAcyclic(current.locationId, parentId, parentMap); }
        catch { throw new WarehouseApplicationError(WAREHOUSE_APPLICATION_ERROR_CODES.moveCycle); }
      }
      await this.assertDependencies({ companyId, operation: "location.move", warehouseId: current.warehouseId, zoneId: current.zoneId, locationId: current.locationId });
      const next = moveWarehouseLocation({ location: current, targetZone, targetWarehouse: warehouseReferenceFrom(targetWarehouse.warehouse), parentLocationId: parentId, occurredAt: command.occurredAt });
      await locations.move(next, current.warehouseId, current.zoneId);
      return next;
    }));
  }

  async deleteLocation(command: DeleteWarehouseLocationCommand): Promise<void> {
    const companyId = requireText(command.companyId);
    return this.dependencies.idempotency.run(`warehouse:location:delete:${companyId}:${requireText(command.locationId)}`, requireText(command.requestId), async () => this.dependencies.unitOfWork.execute(async ({ locations }) => {
      const current = await locations.findById(companyId, requireText(command.locationId));
      if (!current) throw new WarehouseApplicationError(WAREHOUSE_APPLICATION_ERROR_CODES.notFound);
      const all = await locations.listByWarehouse(companyId, current.warehouseId);
      if (all.some((item) => item.parentLocationId === current.locationId)) throw new WarehouseApplicationError(WAREHOUSE_APPLICATION_ERROR_CODES.structuralDependencyBlocked);
      await this.assertDependencies({ companyId, operation: "location.delete", warehouseId: current.warehouseId, zoneId: current.zoneId, locationId: current.locationId });
      await locations.markDeleted(companyId, current.locationId, normalizeTimestamp(command.occurredAt));
    }));
  }
}

function collectDescendants(rootId: string, locations: readonly WarehouseLocationDto[]): readonly WarehouseLocationDto[] {
  const children = new Map<string, WarehouseLocationDto[]>();
  for (const item of locations) {
    if (!item.parentLocationId) continue;
    const bucket = children.get(item.parentLocationId) ?? [];
    bucket.push(item);
    children.set(item.parentLocationId, bucket);
  }
  const result: WarehouseLocationDto[] = [];
  const queue = [...(children.get(rootId) ?? [])];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current.locationId)) continue;
    visited.add(current.locationId);
    result.push(current);
    queue.push(...(children.get(current.locationId) ?? []));
  }
  return Object.freeze(result);
}
