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
import {
  warehouseCorrelationId,
  warehousePermissions,
  type WarehouseAuditAction,
  type WarehouseAuditSink,
  type WarehouseAuthorizationPolicy,
  type WarehousePermission,
  type WarehouseReadSecurityContext,
  type WarehouseSecurityContext,
} from "./contracts/warehouse-security.ts";
import { WarehouseService } from "./warehouse-service.ts";

const normalizedOccurredAt = (value: string): string => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : value;
};

export class SecuredWarehouseService {
  constructor(
    private readonly inner: WarehouseService,
    private readonly authorization: WarehouseAuthorizationPolicy,
    private readonly audit: WarehouseAuditSink,
  ) {}

  async create(
    security: WarehouseSecurityContext,
    command: CreateWarehouseCommand,
  ): Promise<WarehouseDto> {
    await this.requireMutation(security, command, warehousePermissions.create);
    const result = await this.inner.create(command);
    await this.record("warehouse.create", security, command, result.warehouseId, null, {
      code: result.code,
      kind: result.kind,
      status: result.status,
      version: result.version,
    });
    return result;
  }

  async update(
    security: WarehouseSecurityContext,
    command: UpdateWarehouseCommand,
  ): Promise<WarehouseDto> {
    await this.requireMutation(security, command, warehousePermissions.update);
    const result = await this.inner.update(command);
    await this.record("warehouse.update", security, command, result.warehouseId, null, {
      code: result.code,
      version: result.version,
    });
    return result;
  }

  async changeStatus(
    security: WarehouseSecurityContext,
    command: ChangeWarehouseStatusCommand,
  ): Promise<WarehouseDto> {
    await this.requireMutation(security, command, warehousePermissions.changeStatus);
    const result = await this.inner.changeStatus(command);
    if (result.version !== command.expectedVersion) {
      await this.record(
        "warehouse.change-status",
        security,
        command,
        result.warehouseId,
        null,
        { status: result.status, version: result.version },
      );
    }
    return result;
  }

  async changeScope(
    security: WarehouseSecurityContext,
    command: ChangeWarehouseScopeCommand,
  ): Promise<WarehouseDto> {
    await this.requireMutation(security, command, warehousePermissions.manageScope);
    const result = await this.inner.changeScope(command);
    if (result.version !== command.expectedVersion) {
      await this.record(
        "warehouse.change-scope",
        security,
        command,
        result.warehouseId,
        null,
        {
          scopeMode: result.organizationalScope.mode,
          branchId: result.organizationalScope.mode === "branch"
            ? result.organizationalScope.branchId
            : null,
          version: result.version,
        },
      );
    }
    return result;
  }

  async createZone(
    security: WarehouseSecurityContext,
    command: CreateWarehouseZoneCommand,
  ): Promise<WarehouseZoneDto> {
    await this.requireMutation(security, command, warehousePermissions.manageLocations);
    const result = await this.inner.createZone(command);
    await this.record("warehouse.zone.create", security, command, command.warehouseId, result.zoneId, {
      code: result.code,
      status: result.status,
    });
    return result;
  }

  async createLocation(
    security: WarehouseSecurityContext,
    command: CreateWarehouseLocationCommand,
  ): Promise<WarehouseLocationDto> {
    await this.requireMutation(security, command, warehousePermissions.manageLocations);
    const result = await this.inner.createLocation(command);
    await this.record(
      "warehouse.location.create",
      security,
      command,
      command.warehouseId,
      result.locationId,
      {
        code: result.code,
        kind: result.kind,
        zoneId: result.zoneId,
        parentLocationId: result.parentLocationId,
      },
    );
    return result;
  }

  private async requireMutation(
    security: WarehouseSecurityContext,
    command: { readonly companyId: string; readonly requestId: string },
    permission: WarehousePermission,
  ): Promise<void> {
    try {
      await this.authorization.require({
        actorId: security.actorId,
        companyId: command.companyId,
        correlationId: warehouseCorrelationId(security, command.requestId),
        requestId: command.requestId,
      }, permission);
    } catch (error) {
      if (error instanceof WarehouseApplicationError) throw error;
      throw new WarehouseApplicationError(WAREHOUSE_APPLICATION_ERROR_CODES.unauthorized);
    }
  }

  private async record(
    action: WarehouseAuditAction,
    security: WarehouseSecurityContext,
    command: { readonly companyId: string; readonly requestId: string; readonly occurredAt: string },
    warehouseId: string,
    childEntityId: string | null,
    metadata: Readonly<Record<string, string | number | boolean | null>>,
  ): Promise<void> {
    await this.audit.record(Object.freeze({
      action,
      actorId: security.actorId,
      companyId: command.companyId,
      warehouseId,
      childEntityId,
      correlationId: warehouseCorrelationId(security, command.requestId),
      requestId: command.requestId,
      occurredAt: normalizedOccurredAt(command.occurredAt),
      metadata: Object.freeze({ ...metadata }),
    }));
  }
}

export class SecuredWarehouseReader {
  constructor(
    private readonly inner: Pick<WarehouseService, "getById" | "getByCode" | "list" | "select">,
    private readonly authorization: WarehouseAuthorizationPolicy,
    private readonly context: WarehouseReadSecurityContext,
  ) {}

  async getById(query: GetWarehouseByIdQuery): Promise<WarehouseDto | null> {
    await this.require(query.companyId);
    return this.inner.getById(query);
  }

  async getByCode(query: GetWarehouseByCodeQuery): Promise<WarehouseDto | null> {
    await this.require(query.companyId);
    return this.inner.getByCode(query);
  }

  async list(query: ListWarehousesQuery): Promise<WarehousePageDto<WarehouseListItemDto>> {
    await this.require(query.filter.companyId);
    return this.inner.list(query);
  }

  async select(query: WarehouseSelectorQuery): Promise<readonly WarehouseListItemDto[]> {
    await this.require(query.companyId);
    return this.inner.select(query);
  }

  private async require(companyId: string): Promise<void> {
    try {
      await this.authorization.require({
        actorId: this.context.actorId,
        companyId,
        correlationId: warehouseCorrelationId(this.context, this.context.requestId),
        requestId: this.context.requestId,
      }, warehousePermissions.view);
    } catch (error) {
      if (error instanceof WarehouseApplicationError) throw error;
      throw new WarehouseApplicationError(WAREHOUSE_APPLICATION_ERROR_CODES.unauthorized);
    }
  }
}
