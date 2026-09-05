import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  WAREHOUSE_APPLICATION_ERROR_CODES,
  WarehouseApplicationError,
  WarehouseService,
  SecuredWarehouseReader,
  SecuredWarehouseService,
  warehousePermissions,
  type WarehouseAuthorizationPolicy,
  type WarehouseDto,
  type WarehouseKind,
  type WarehouseListItemDto,
  type WarehouseLocationDto,
  type WarehouseOrganizationalScope,
  type WarehouseStatus,
  type WarehouseZoneDto,
} from "@argin/warehouse";
import {
  SqliteWarehouseBranchResolver,
  SqliteWarehouseIdempotencyExecutor,
  SqliteWarehouseReader,
  SqliteWarehouseUnitOfWork,
} from "@argin/warehouse-tauri";
import { getDesktopDatabase } from "@argin/database-tauri";

import { useActiveContext } from "../../app/providers/active-context-provider";
import { useAuthSession } from "../../app/providers/auth-session-provider";
import { Feedback } from "../../components/feedback";
import { Page } from "../../components/layout";
import { createPersistentWarehouseAuditSink } from "./warehouse-audit-sink";

import "./warehouses-page.css";

type StatusFilter = "all" | WarehouseStatus;
type KindFilter = "all" | WarehouseKind;
type StructureTab = "zones" | "locations";
type LocationKind = WarehouseLocationDto["kind"];

interface BranchOption {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}
interface WarehouseDraft {
  code: string;
  title: string;
  description: string;
  kind: WarehouseKind;
  scopeMode: "company" | "branch";
  branchId: string;
  externalIdentifiers: string;
}
interface ZoneDraft {
  zoneId: string | null;
  code: string;
  title: string;
  description: string;
}
interface LocationDraft {
  locationId: string | null;
  zoneId: string;
  parentLocationId: string;
  code: string;
  title: string;
  kind: LocationKind;
  description: string;
}
interface MoveDraft {
  warehouseId: string;
  zoneId: string;
  parentLocationId: string;
}

const emptyWarehouseDraft: WarehouseDraft = {
  code: "",
  title: "",
  description: "",
  kind: "general",
  scopeMode: "company",
  branchId: "",
  externalIdentifiers: "",
};
const emptyZoneDraft: ZoneDraft = {
  zoneId: null,
  code: "",
  title: "",
  description: "",
};
const emptyLocationDraft: LocationDraft = {
  locationId: null,
  zoneId: "",
  parentLocationId: "",
  code: "",
  title: "",
  kind: "bin",
  description: "",
};
const emptyMoveDraft: MoveDraft = {
  warehouseId: "",
  zoneId: "",
  parentLocationId: "",
};

const persianDateTime = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
const kindLabels: Readonly<Record<WarehouseKind, string>> = Object.freeze({
  general: "عمومی",
  "raw-material": "مواد اولیه",
  "finished-goods": "محصول نهایی",
  consumables: "مصرفی",
  "spare-parts": "قطعات یدکی",
  wip: "در جریان ساخت",
  transit: "در راه",
  consignment: "امانی",
  other: "سایر",
});
const statusLabels: Readonly<Record<WarehouseStatus, string>> = Object.freeze({
  active: "فعال",
  inactive: "غیرفعال",
  archived: "بایگانی‌شده",
});
const physicalStatusLabels = Object.freeze({
  active: "فعال",
  inactive: "غیرفعال",
} as const);
const locationKindLabels: Readonly<Record<LocationKind, string>> =
  Object.freeze({
    bin: "باکس/بین",
    rack: "رک",
    shelf: "قفسه",
    staging: "موقت/آماده‌سازی",
    receiving: "دریافت",
    dispatch: "ارسال",
    other: "سایر",
  });

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : persianDateTime.format(date);
}
function nullable(value: string): string | null {
  const normalized = value.trim();
  return normalized ? normalized : null;
}
function parseExternalIdentifiers(value: string) {
  if (!value.trim()) return [] as const;
  return value
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const index = part.indexOf("=");
      if (index <= 0 || index === part.length - 1)
        throw new Error("شناسه خارجی باید به‌صورت NAMESPACE=VALUE وارد شود.");
      return { namespace: part.slice(0, index), value: part.slice(index + 1) };
    });
}
function identifiersToText(detail: WarehouseDto): string {
  return detail.externalIdentifiers
    .map((item) => `${item.namespace}=${item.value}`)
    .join("|");
}
function scopeLabel(
  scope: WarehouseOrganizationalScope,
  branches: readonly BranchOption[],
): string {
  if (scope.mode === "company") return "کل شرکت";
  const branch = branches.find((item) => item.id === scope.branchId);
  return branch ? `شعبه ${branch.name}` : `شعبه ${scope.branchId}`;
}
function errorMessage(reason: unknown): string {
  const code =
    reason instanceof WarehouseApplicationError
      ? reason.code
      : typeof reason === "object" && reason !== null && "code" in reason
        ? String((reason as { code?: unknown }).code ?? "")
        : "";
  const map: Readonly<Record<string, string>> = Object.freeze({
    [WAREHOUSE_APPLICATION_ERROR_CODES.invalidRequest]:
      "اطلاعات واردشده معتبر نیست.",
    [WAREHOUSE_APPLICATION_ERROR_CODES.notFound]:
      "رکورد موردنظر پیدا نشد یا قبلاً حذف شده است.",
    [WAREHOUSE_APPLICATION_ERROR_CODES.duplicateIdentifier]:
      "کد یا شناسه واردشده قبلاً استفاده شده است.",
    [WAREHOUSE_APPLICATION_ERROR_CODES.concurrencyConflict]:
      "رکورد هم‌زمان تغییر کرده است؛ صفحه را تازه‌سازی کنید.",
    [WAREHOUSE_APPLICATION_ERROR_CODES.branchReferenceInvalid]:
      "شعبه انتخاب‌شده معتبر یا فعال نیست.",
    [WAREHOUSE_APPLICATION_ERROR_CODES.archivedMutationForbidden]:
      "انبار بایگانی‌شده قابل تغییر نیست.",
    [WAREHOUSE_APPLICATION_ERROR_CODES.dependencyBlocked]:
      "به دلیل موجودی یا اسناد وابسته، این عملیات مجاز نیست.",
    [WAREHOUSE_APPLICATION_ERROR_CODES.structuralDependencyBlocked]:
      "ابتدا وابستگی‌های ساختاری یا زیرمجموعه‌های این رکورد را تعیین تکلیف کنید.",
    [WAREHOUSE_APPLICATION_ERROR_CODES.moveCycle]:
      "تغییر والد باعث ایجاد چرخه در ساختار موقعیت‌ها می‌شود.",
    [WAREHOUSE_APPLICATION_ERROR_CODES.unauthorized]:
      "برای این عملیات مجوز کافی ندارید.",
  });
  return (
    map[code] ??
    (reason instanceof Error ? reason.message : "عملیات با خطا مواجه شد.")
  );
}
function securityContext(actorId: string) {
  return { actorId, correlationId: crypto.randomUUID() } as const;
}
function requestBase(companyId: string) {
  return {
    companyId,
    requestId: crypto.randomUUID(),
    occurredAt: new Date().toISOString(),
  } as const;
}
function draftFrom(detail: WarehouseDto): WarehouseDraft {
  return {
    code: detail.code,
    title: detail.title,
    description: detail.description ?? "",
    kind: detail.kind,
    scopeMode: detail.organizationalScope.mode,
    branchId:
      detail.organizationalScope.mode === "branch"
        ? detail.organizationalScope.branchId
        : "",
    externalIdentifiers: identifiersToText(detail),
  };
}

export function WarehousesPage() {
  const { session } = useAuthSession();
  const active = useActiveContext();
  const actorId = session?.user.id ?? "desktop-local-user";
  const permissionSet = useMemo(
    () => new Set(session?.user.permissions ?? []),
    [session],
  );
  const can = useCallback(
    (permission: string) =>
      permissionSet.has("system.full-access") || permissionSet.has(permission),
    [permissionSet],
  );

  const [items, setItems] = useState<readonly WarehouseListItemDto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<WarehouseDto | null>(null);
  const [branches, setBranches] = useState<readonly BranchOption[]>([]);
  const [zones, setZones] = useState<readonly WarehouseZoneDto[]>([]);
  const [locations, setLocations] = useState<readonly WarehouseLocationDto[]>(
    [],
  );
  const [moveWarehouses, setMoveWarehouses] = useState<
    readonly WarehouseListItemDto[]
  >([]);
  const [moveZones, setMoveZones] = useState<readonly WarehouseZoneDto[]>([]);
  const [moveParents, setMoveParents] = useState<
    readonly WarehouseLocationDto[]
  >([]);
  const [movingLocation, setMovingLocation] =
    useState<WarehouseLocationDto | null>(null);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [warehouseFormOpen, setWarehouseFormOpen] = useState(false);
  const [zoneFormOpen, setZoneFormOpen] = useState(false);
  const [locationFormOpen, setLocationFormOpen] = useState(false);
  const [moveFormOpen, setMoveFormOpen] = useState(false);
  const [warehouseDraft, setWarehouseDraft] =
    useState<WarehouseDraft>(emptyWarehouseDraft);
  const [zoneDraft, setZoneDraft] = useState<ZoneDraft>(emptyZoneDraft);
  const [locationDraft, setLocationDraft] =
    useState<LocationDraft>(emptyLocationDraft);
  const [moveDraft, setMoveDraft] = useState<MoveDraft>(emptyMoveDraft);
  const [structureTab, setStructureTab] = useState<StructureTab>("zones");

  const authorization = useMemo<WarehouseAuthorizationPolicy>(
    () => ({
      require: async (_context, permission) => {
        if (!can(permission))
          throw new WarehouseApplicationError(
            WAREHOUSE_APPLICATION_ERROR_CODES.unauthorized,
          );
      },
    }),
    [can],
  );

  const buildAdapters = useCallback(async () => {
    const database = await getDesktopDatabase();
    const reader = new SqliteWarehouseReader(database);
    const service = new WarehouseService({
      unitOfWork: new SqliteWarehouseUnitOfWork(database),
      reader,
      idempotency: new SqliteWarehouseIdempotencyExecutor(database),
      branches: new SqliteWarehouseBranchResolver(database),
    });
    return {
      rawReader: reader,
      reader: new SecuredWarehouseReader(reader, authorization, {
        actorId,
        correlationId: crypto.randomUUID(),
        requestId: crypto.randomUUID(),
      }),
      service: new SecuredWarehouseService(
        service,
        authorization,
        createPersistentWarehouseAuditSink(database),
      ),
    };
  }, [actorId, authorization]);

  const loadBranches = useCallback(async () => {
    if (!active.companyId) return setBranches([]);
    try {
      const database = await getDesktopDatabase();
      setBranches(
        await database.query<BranchOption>(
          `SELECT id, code, name FROM branches WHERE company_id = ? AND status = 'active' ORDER BY is_head_office DESC, code COLLATE NOCASE ASC`,
          [active.companyId],
        ),
      );
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }, [active.companyId]);

  const reload = useCallback(async () => {
    if (!active.companyId || !can(warehousePermissions.view)) {
      setItems([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { reader } = await buildAdapters();
      const result = await reader.list({
        filter: {
          companyId: active.companyId,
          ...(deferredSearch.trim() ? { search: deferredSearch.trim() } : {}),
          ...(kindFilter === "all" ? {} : { kinds: [kindFilter] }),
          ...(statusFilter === "all" ? {} : { statuses: [statusFilter] }),
        },
        page: { page, pageSize: 50 },
        sort: { field: "code", direction: "asc" },
      });
      setItems(result.items);
      setTotalCount(result.totalCount);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [
    active.companyId,
    buildAdapters,
    can,
    deferredSearch,
    kindFilter,
    page,
    statusFilter,
  ]);

  const loadDetail = useCallback(
    async (warehouseId: string | null) => {
      if (!warehouseId || !active.companyId) {
        setDetail(null);
        setZones([]);
        setLocations([]);
        return;
      }
      try {
        const { reader, rawReader } = await buildAdapters();
        const current = await reader.getById({
          companyId: active.companyId,
          warehouseId,
        });
        setDetail(current);
        if (!current) {
          setZones([]);
          setLocations([]);
          return;
        }
        const [nextZones, nextLocations] = await Promise.all([
          rawReader.listZones({ companyId: active.companyId, warehouseId }),
          rawReader.listLocations({ companyId: active.companyId, warehouseId }),
        ]);
        setZones(nextZones);
        setLocations(nextLocations);
      } catch (reason) {
        setError(errorMessage(reason));
      }
    },
    [active.companyId, buildAdapters],
  );

  useEffect(() => {
    setSelectedId(null);
    setDetail(null);
    setPage(1);
    void loadBranches();
  }, [active.companyId, loadBranches]);
  useEffect(() => {
    void reload();
  }, [reload]);
  useEffect(() => {
    void loadDetail(selectedId);
  }, [loadDetail, selectedId]);

  function clearFeedback() {
    setMessage("");
    setError("");
  }
  function openCreate() {
    clearFeedback();
    setDetail(null);
    setSelectedId(null);
    setWarehouseDraft(emptyWarehouseDraft);
    setWarehouseFormOpen(true);
  }
  function openEdit() {
    if (!detail) return;
    clearFeedback();
    setWarehouseDraft(draftFrom(detail));
    setWarehouseFormOpen(true);
  }

  async function submitWarehouse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !active.companyId ||
      !warehouseDraft.code.trim() ||
      !warehouseDraft.title.trim()
    )
      return setError("کد و عنوان انبار الزامی است.");
    if (warehouseDraft.scopeMode === "branch" && !warehouseDraft.branchId)
      return setError("برای انبار شعبه‌ای، انتخاب شعبه الزامی است.");
    setSaving(true);
    clearFeedback();
    try {
      const { service } = await buildAdapters();
      const scope: WarehouseOrganizationalScope =
        warehouseDraft.scopeMode === "company"
          ? { mode: "company" }
          : { mode: "branch", branchId: warehouseDraft.branchId };
      if (!detail) {
        const created = await service.create(securityContext(actorId), {
          ...requestBase(active.companyId),
          warehouseId: crypto.randomUUID(),
          code: warehouseDraft.code,
          title: warehouseDraft.title,
          description: nullable(warehouseDraft.description),
          kind: warehouseDraft.kind,
          organizationalScope: scope,
          externalIdentifiers: parseExternalIdentifiers(
            warehouseDraft.externalIdentifiers,
          ),
        });
        setSelectedId(created.warehouseId);
        setDetail(created);
        setMessage("انبار با موفقیت ایجاد شد.");
      } else {
        let current = await service.update(securityContext(actorId), {
          ...requestBase(active.companyId),
          warehouseId: detail.warehouseId,
          code: warehouseDraft.code,
          title: warehouseDraft.title,
          description: nullable(warehouseDraft.description),
          externalIdentifiers: parseExternalIdentifiers(
            warehouseDraft.externalIdentifiers,
          ),
          expectedVersion: detail.version,
        });
        const scopeChanged =
          current.organizationalScope.mode !== scope.mode ||
          (scope.mode === "branch" &&
            current.organizationalScope.mode === "branch" &&
            current.organizationalScope.branchId !== scope.branchId);
        if (scopeChanged)
          current = await service.changeScope(securityContext(actorId), {
            ...requestBase(active.companyId),
            warehouseId: current.warehouseId,
            organizationalScope: scope,
            expectedVersion: current.version,
          });
        setDetail(current);
        setMessage("تغییرات انبار ذخیره شد.");
      }
      setWarehouseFormOpen(false);
      await reload();
      await loadDetail(detail?.warehouseId ?? selectedId);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(targetStatus: WarehouseStatus) {
    if (!detail || !active.companyId) return;
    setSaving(true);
    clearFeedback();
    try {
      const { service } = await buildAdapters();
      const next = await service.changeStatus(securityContext(actorId), {
        ...requestBase(active.companyId),
        warehouseId: detail.warehouseId,
        targetStatus,
        expectedVersion: detail.version,
      });
      setDetail(next);
      setMessage(`وضعیت انبار به «${statusLabels[next.status]}» تغییر کرد.`);
      await reload();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  async function deleteWarehouse() {
    if (
      !detail ||
      !active.companyId ||
      !confirm(
        `انبار «${detail.title}» حذف شود؟ این عملیات فقط برای انبار بدون وابستگی مجاز است.`,
      )
    )
      return;
    setSaving(true);
    clearFeedback();
    try {
      const { service } = await buildAdapters();
      await service.deleteWarehouse(securityContext(actorId), {
        ...requestBase(active.companyId),
        warehouseId: detail.warehouseId,
        expectedVersion: detail.version,
      });
      setSelectedId(null);
      setDetail(null);
      setZones([]);
      setLocations([]);
      setMessage("انبار حذف شد و Tombstone همگام‌سازی ثبت شد.");
      await reload();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  function openZoneCreate() {
    setZoneDraft(emptyZoneDraft);
    setZoneFormOpen(true);
  }
  function openZoneEdit(zone: WarehouseZoneDto) {
    setZoneDraft({
      zoneId: zone.zoneId,
      code: zone.code,
      title: zone.title,
      description: zone.description ?? "",
    });
    setZoneFormOpen(true);
  }
  async function submitZone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !detail ||
      !active.companyId ||
      !zoneDraft.code.trim() ||
      !zoneDraft.title.trim()
    )
      return setError("کد و عنوان ناحیه الزامی است.");
    setSaving(true);
    clearFeedback();
    try {
      const { service } = await buildAdapters();
      if (zoneDraft.zoneId) {
        await service.updateZone(securityContext(actorId), {
          ...requestBase(active.companyId),
          zoneId: zoneDraft.zoneId,
          warehouseId: detail.warehouseId,
          code: zoneDraft.code,
          title: zoneDraft.title,
          description: nullable(zoneDraft.description),
        });
        setMessage("ناحیه ویرایش شد.");
      } else {
        await service.createZone(securityContext(actorId), {
          ...requestBase(active.companyId),
          zoneId: crypto.randomUUID(),
          warehouseId: detail.warehouseId,
          code: zoneDraft.code,
          title: zoneDraft.title,
          description: nullable(zoneDraft.description),
        });
        setMessage("ناحیه ایجاد شد.");
      }
      setZoneFormOpen(false);
      setZoneDraft(emptyZoneDraft);
      await loadDetail(detail.warehouseId);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }
  async function toggleZone(zone: WarehouseZoneDto) {
    if (!active.companyId) return;
    try {
      const { service } = await buildAdapters();
      await service.changeZoneStatus(securityContext(actorId), {
        ...requestBase(active.companyId),
        zoneId: zone.zoneId,
        warehouseId: zone.warehouseId,
        targetStatus: zone.status === "active" ? "inactive" : "active",
      });
      setMessage("وضعیت ناحیه تغییر کرد.");
      await loadDetail(zone.warehouseId);
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }
  async function deleteZone(zone: WarehouseZoneDto) {
    if (
      !active.companyId ||
      !confirm(
        `ناحیه «${zone.title}» حذف شود؟ ناحیه دارای موقعیت قابل حذف نیست.`,
      )
    )
      return;
    try {
      const { service } = await buildAdapters();
      await service.deleteZone(securityContext(actorId), {
        ...requestBase(active.companyId),
        zoneId: zone.zoneId,
        warehouseId: zone.warehouseId,
      });
      setMessage("ناحیه حذف شد.");
      await loadDetail(zone.warehouseId);
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  function openLocationCreate() {
    setLocationDraft({
      ...emptyLocationDraft,
      zoneId: zones.find((item) => item.status === "active")?.zoneId ?? "",
    });
    setLocationFormOpen(true);
  }
  function openLocationEdit(location: WarehouseLocationDto) {
    setLocationDraft({
      locationId: location.locationId,
      zoneId: location.zoneId,
      parentLocationId: location.parentLocationId ?? "",
      code: location.code,
      title: location.title,
      kind: location.kind,
      description: location.description ?? "",
    });
    setLocationFormOpen(true);
  }
  async function submitLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !detail ||
      !active.companyId ||
      !locationDraft.zoneId ||
      !locationDraft.code.trim() ||
      !locationDraft.title.trim()
    )
      return setError("ناحیه، کد و عنوان موقعیت الزامی است.");
    setSaving(true);
    clearFeedback();
    try {
      const { service } = await buildAdapters();
      if (locationDraft.locationId) {
        await service.updateLocation(securityContext(actorId), {
          ...requestBase(active.companyId),
          locationId: locationDraft.locationId,
          code: locationDraft.code,
          title: locationDraft.title,
          kind: locationDraft.kind,
          description: nullable(locationDraft.description),
        });
        const old = locations.find(
          (item) => item.locationId === locationDraft.locationId,
        );
        if (
          old &&
          (old.parentLocationId ?? "") !== locationDraft.parentLocationId
        )
          await service.moveLocation(securityContext(actorId), {
            ...requestBase(active.companyId),
            locationId: old.locationId,
            targetWarehouseId: old.warehouseId,
            targetZoneId: old.zoneId,
            parentLocationId: nullable(locationDraft.parentLocationId),
          });
        setMessage("موقعیت ویرایش شد.");
      } else {
        await service.createLocation(securityContext(actorId), {
          ...requestBase(active.companyId),
          locationId: crypto.randomUUID(),
          warehouseId: detail.warehouseId,
          zoneId: locationDraft.zoneId,
          parentLocationId: nullable(locationDraft.parentLocationId),
          code: locationDraft.code,
          title: locationDraft.title,
          kind: locationDraft.kind,
          description: nullable(locationDraft.description),
        });
        setMessage("موقعیت ایجاد شد.");
      }
      setLocationFormOpen(false);
      setLocationDraft(emptyLocationDraft);
      await loadDetail(detail.warehouseId);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }
  async function toggleLocation(location: WarehouseLocationDto) {
    if (!active.companyId) return;
    try {
      const { service } = await buildAdapters();
      await service.changeLocationStatus(securityContext(actorId), {
        ...requestBase(active.companyId),
        locationId: location.locationId,
        targetStatus: location.status === "active" ? "inactive" : "active",
      });
      setMessage("وضعیت موقعیت تغییر کرد.");
      await loadDetail(location.warehouseId);
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }
  async function deleteLocation(location: WarehouseLocationDto) {
    if (
      !active.companyId ||
      !confirm(
        `موقعیت «${location.title}» حذف شود؟ موقعیت دارای زیرمجموعه یا وابستگی قابل حذف نیست.`,
      )
    )
      return;
    try {
      const { service } = await buildAdapters();
      await service.deleteLocation(securityContext(actorId), {
        ...requestBase(active.companyId),
        warehouseId: location.warehouseId,
        locationId: location.locationId,
      });
      setMessage("موقعیت حذف شد.");
      await loadDetail(location.warehouseId);
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  async function openMove(location: WarehouseLocationDto) {
    if (!active.companyId) return;
    setMovingLocation(location);
    setMoveDraft({
      warehouseId: location.warehouseId,
      zoneId: location.zoneId,
      parentLocationId: location.parentLocationId ?? "",
    });
    try {
      const { rawReader } = await buildAdapters();
      setMoveWarehouses(
        await rawReader.select({
          companyId: active.companyId,
          statuses: ["active"],
          limit: 100,
        }),
      );
      setMoveZones(
        await rawReader.listZones({
          companyId: active.companyId,
          warehouseId: location.warehouseId,
          statuses: ["active"],
        }),
      );
      setMoveParents(
        (
          await rawReader.listLocations({
            companyId: active.companyId,
            warehouseId: location.warehouseId,
            zoneId: location.zoneId,
            statuses: ["active"],
          })
        ).filter((item) => item.locationId !== location.locationId),
      );
      setMoveFormOpen(true);
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }
  async function updateMoveWarehouse(warehouseId: string) {
    if (!active.companyId) return;
    setMoveDraft({ warehouseId, zoneId: "", parentLocationId: "" });
    setMoveParents([]);
    try {
      const { rawReader } = await buildAdapters();
      setMoveZones(
        await rawReader.listZones({
          companyId: active.companyId,
          warehouseId,
          statuses: ["active"],
        }),
      );
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }
  async function updateMoveZone(zoneId: string) {
    if (!active.companyId) return;
    setMoveDraft((current) => ({ ...current, zoneId, parentLocationId: "" }));
    try {
      const { rawReader } = await buildAdapters();
      const rows = await rawReader.listLocations({
        companyId: active.companyId,
        warehouseId: moveDraft.warehouseId,
        zoneId,
        statuses: ["active"],
      });
      setMoveParents(
        rows.filter((item) => item.locationId !== movingLocation?.locationId),
      );
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }
  async function submitMove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !active.companyId ||
      !movingLocation ||
      !moveDraft.warehouseId ||
      !moveDraft.zoneId
    )
      return setError("انبار و ناحیه مقصد الزامی است.");
    setSaving(true);
    clearFeedback();
    try {
      const { service } = await buildAdapters();
      const moved = await service.moveLocation(securityContext(actorId), {
        ...requestBase(active.companyId),
        locationId: movingLocation.locationId,
        targetWarehouseId: moveDraft.warehouseId,
        targetZoneId: moveDraft.zoneId,
        parentLocationId: nullable(moveDraft.parentLocationId),
      });
      setMoveFormOpen(false);
      setMovingLocation(null);
      setMessage("موقعیت با کنترل وابستگی و ساختار منتقل شد.");
      if (detail) await loadDetail(detail.warehouseId);
      if (moved.warehouseId !== detail?.warehouseId) await reload();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  if (!can(warehousePermissions.view))
    return (
      <Page className="warehouses-page" lang="fa" dir="rtl">
        <Feedback tone="error">شما مجوز مشاهده انبارها را ندارید.</Feedback>
      </Page>
    );

  return (
    <Page className="warehouses-page" lang="fa" dir="rtl">
      <header className="warehouses-page__header">
        <div>
          <p className="warehouses-page__eyebrow">اطلاعات پایه / انبار</p>
          <h1>انبارها و ساختار فیزیکی</h1>
          <p>
            مدیریت انبار، ناحیه و موقعیت با کنترل وابستگی، Tombstone و ساختار
            درختی
          </p>
        </div>
        <button
          className="warehouse-button warehouse-button--primary"
          type="button"
          onClick={openCreate}
          disabled={!active.companyId || !can(warehousePermissions.create)}
        >
          انبار جدید
        </button>
      </header>
      {message ? <Feedback tone="success">{message}</Feedback> : null}
      {error ? <Feedback tone="error">{error}</Feedback> : null}
      <section className="warehouse-toolbar" aria-label="فیلتر انبارها">
        <label className="warehouse-search">
          <span>جستجو</span>
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="کد یا عنوان انبار"
          />
        </label>
        <label>
          <span>نوع</span>
          <select
            value={kindFilter}
            onChange={(e) => {
              setKindFilter(e.target.value as KindFilter);
              setPage(1);
            }}
          >
            <option value="all">همه</option>
            {Object.entries(kindLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>وضعیت</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as StatusFilter);
              setPage(1);
            }}
          >
            <option value="all">همه</option>
            <option value="active">فعال</option>
            <option value="inactive">غیرفعال</option>
            <option value="archived">بایگانی‌شده</option>
          </select>
        </label>
        <span className="warehouse-toolbar__count">
          {totalCount.toLocaleString("fa-IR")} رکورد
        </span>
      </section>
      <div className="warehouse-workspace">
        <section className="warehouse-list-panel" aria-label="فهرست انبارها">
          <div className="warehouse-table-wrap">
            <table className="warehouse-table">
              <thead>
                <tr>
                  <th>کد</th>
                  <th>عنوان</th>
                  <th>نوع</th>
                  <th>محدوده</th>
                  <th>وضعیت</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5}>در حال بارگذاری…</td>
                  </tr>
                ) : null}
                {!loading && items.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      انبار ثبت‌شده‌ای مطابق فیلتر وجود ندارد.
                    </td>
                  </tr>
                ) : null}
                {items.map((item) => (
                  <tr
                    key={item.warehouseId}
                    className={
                      selectedId === item.warehouseId
                        ? "warehouse-row--selected"
                        : undefined
                    }
                    onClick={() => setSelectedId(item.warehouseId)}
                    tabIndex={0}
                  >
                    <td dir="ltr" className="warehouse-code">
                      {item.code}
                    </td>
                    <td>{item.title}</td>
                    <td>{kindLabels[item.kind]}</td>
                    <td>{scopeLabel(item.organizationalScope, branches)}</td>
                    <td>
                      <span
                        className={`warehouse-status warehouse-status--${item.status}`}
                      >
                        {statusLabels[item.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <footer className="warehouse-pagination">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              قبلی
            </button>
            <span>صفحه {page.toLocaleString("fa-IR")}</span>
            <button
              type="button"
              disabled={items.length < 50 || page * 50 >= totalCount}
              onClick={() => setPage((p) => p + 1)}
            >
              بعدی
            </button>
          </footer>
        </section>
        <aside className="warehouse-detail-panel" aria-label="جزئیات انبار">
          {!detail ? (
            <div className="warehouse-empty-detail">
              برای مشاهده جزئیات، یک انبار را انتخاب کنید.
            </div>
          ) : (
            <>
              <div className="warehouse-detail__heading">
                <div>
                  <strong>{detail.title}</strong>
                  <span dir="ltr">{detail.code}</span>
                </div>
                <div className="warehouse-detail__actions">
                  <button
                    type="button"
                    onClick={openEdit}
                    disabled={
                      detail.status === "archived" ||
                      !can(warehousePermissions.update)
                    }
                  >
                    ویرایش
                  </button>
                  {detail.status === "active" ? (
                    <button
                      type="button"
                      onClick={() => void changeStatus("inactive")}
                    >
                      غیرفعال
                    </button>
                  ) : null}
                  {detail.status === "inactive" ? (
                    <button
                      type="button"
                      onClick={() => void changeStatus("active")}
                    >
                      فعال
                    </button>
                  ) : null}
                  {detail.status !== "archived" ? (
                    <button
                      type="button"
                      onClick={() => void changeStatus("archived")}
                    >
                      بایگانی
                    </button>
                  ) : null}
                  <button
                    className="warehouse-button--danger"
                    type="button"
                    onClick={() => void deleteWarehouse()}
                    disabled={!can(warehousePermissions.delete)}
                  >
                    حذف
                  </button>
                </div>
              </div>
              <dl className="warehouse-meta-grid">
                <div>
                  <dt>نوع</dt>
                  <dd>{kindLabels[detail.kind]}</dd>
                </div>
                <div>
                  <dt>وضعیت</dt>
                  <dd>{statusLabels[detail.status]}</dd>
                </div>
                <div>
                  <dt>محدوده</dt>
                  <dd>{scopeLabel(detail.organizationalScope, branches)}</dd>
                </div>
                <div>
                  <dt>نسخه</dt>
                  <dd dir="ltr">{detail.version}</dd>
                </div>
                <div>
                  <dt>آخرین تغییر</dt>
                  <dd>{formatDate(detail.updatedAt)}</dd>
                </div>
                <div>
                  <dt>شناسه‌های خارجی</dt>
                  <dd dir="ltr">{identifiersToText(detail) || "—"}</dd>
                </div>
              </dl>
              {detail.description ? (
                <p className="warehouse-description">{detail.description}</p>
              ) : null}
              <section className="warehouse-structure">
                <div className="warehouse-structure__header">
                  <div className="warehouse-tabs">
                    <button
                      type="button"
                      className={
                        structureTab === "zones" ? "is-active" : undefined
                      }
                      onClick={() => setStructureTab("zones")}
                    >
                      ناحیه‌ها ({zones.length.toLocaleString("fa-IR")})
                    </button>
                    <button
                      type="button"
                      className={
                        structureTab === "locations" ? "is-active" : undefined
                      }
                      onClick={() => setStructureTab("locations")}
                    >
                      موقعیت‌ها ({locations.length.toLocaleString("fa-IR")})
                    </button>
                  </div>
                  {can(warehousePermissions.manageLocations) &&
                  detail.status !== "archived" ? (
                    <button
                      type="button"
                      onClick={() =>
                        structureTab === "zones"
                          ? openZoneCreate()
                          : openLocationCreate()
                      }
                    >
                      {structureTab === "zones" ? "ناحیه جدید" : "موقعیت جدید"}
                    </button>
                  ) : null}
                </div>
                {structureTab === "zones" ? (
                  <div className="warehouse-structure-list">
                    {zones.map((zone) => (
                      <div key={zone.zoneId}>
                        <b dir="ltr">{zone.code}</b>
                        <span>
                          {zone.title}
                          <small> — {physicalStatusLabels[zone.status]}</small>
                        </span>
                        <div className="warehouse-structure-actions">
                          <button
                            type="button"
                            onClick={() => openZoneEdit(zone)}
                          >
                            ویرایش
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggleZone(zone)}
                          >
                            {zone.status === "active" ? "غیرفعال" : "فعال"}
                          </button>
                          <button
                            className="warehouse-button--danger"
                            type="button"
                            onClick={() => void deleteZone(zone)}
                          >
                            حذف
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
                {structureTab === "locations" ? (
                  <div className="warehouse-structure-list">
                    {locations.map((location) => {
                      const zone = zones.find(
                        (item) => item.zoneId === location.zoneId,
                      );
                      const parent = locations.find(
                        (item) => item.locationId === location.parentLocationId,
                      );
                      return (
                        <div key={location.locationId}>
                          <b dir="ltr">{location.code}</b>
                          <span>
                            {location.title}
                            <small>
                              {" "}
                              — {zone?.title ?? location.zoneId} /{" "}
                              {locationKindLabels[location.kind]}
                              {parent ? ` / والد: ${parent.title}` : ""} /{" "}
                              {physicalStatusLabels[location.status]}
                            </small>
                          </span>
                          <div className="warehouse-structure-actions">
                            <button
                              type="button"
                              onClick={() => openLocationEdit(location)}
                            >
                              ویرایش
                            </button>
                            <button
                              type="button"
                              onClick={() => void toggleLocation(location)}
                            >
                              {location.status === "active"
                                ? "غیرفعال"
                                : "فعال"}
                            </button>
                            <button
                              type="button"
                              onClick={() => void openMove(location)}
                            >
                              انتقال
                            </button>
                            <button
                              className="warehouse-button--danger"
                              type="button"
                              onClick={() => void deleteLocation(location)}
                            >
                              حذف
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </section>
            </>
          )}
        </aside>
      </div>

      {warehouseFormOpen ? (
        <Dialog
          title={detail ? "ویرایش انبار" : "انبار جدید"}
          close={() => setWarehouseFormOpen(false)}
        >
          <form onSubmit={submitWarehouse}>
            <div className="warehouse-form-grid">
              <label>
                کد
                <input
                  dir="ltr"
                  value={warehouseDraft.code}
                  onChange={(e) =>
                    setWarehouseDraft((d) => ({ ...d, code: e.target.value }))
                  }
                />
              </label>
              <label>
                عنوان
                <input
                  value={warehouseDraft.title}
                  onChange={(e) =>
                    setWarehouseDraft((d) => ({ ...d, title: e.target.value }))
                  }
                />
              </label>
              <label>
                نوع
                <select
                  disabled={Boolean(detail)}
                  value={warehouseDraft.kind}
                  onChange={(e) =>
                    setWarehouseDraft((d) => ({
                      ...d,
                      kind: e.target.value as WarehouseKind,
                    }))
                  }
                >
                  {Object.entries(kindLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                محدوده
                <select
                  value={warehouseDraft.scopeMode}
                  onChange={(e) =>
                    setWarehouseDraft((d) => ({
                      ...d,
                      scopeMode: e.target.value as "company" | "branch",
                      branchId: "",
                    }))
                  }
                >
                  <option value="company">کل شرکت</option>
                  <option value="branch">شعبه</option>
                </select>
              </label>
              {warehouseDraft.scopeMode === "branch" ? (
                <label>
                  شعبه
                  <select
                    value={warehouseDraft.branchId}
                    onChange={(e) =>
                      setWarehouseDraft((d) => ({
                        ...d,
                        branchId: e.target.value,
                      }))
                    }
                  >
                    <option value="">انتخاب کنید</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.code} — {b.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="warehouse-form-grid__wide">
                شناسه خارجی
                <input
                  dir="ltr"
                  value={warehouseDraft.externalIdentifiers}
                  onChange={(e) =>
                    setWarehouseDraft((d) => ({
                      ...d,
                      externalIdentifiers: e.target.value,
                    }))
                  }
                />
              </label>
              <label className="warehouse-form-grid__wide">
                توضیحات
                <textarea
                  rows={3}
                  value={warehouseDraft.description}
                  onChange={(e) =>
                    setWarehouseDraft((d) => ({
                      ...d,
                      description: e.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <footer>
              <button className="warehouse-button--primary" disabled={saving}>
                ذخیره
              </button>
              <button type="button" onClick={() => setWarehouseFormOpen(false)}>
                انصراف
              </button>
            </footer>
          </form>
        </Dialog>
      ) : null}
      {zoneFormOpen ? (
        <Dialog
          title={zoneDraft.zoneId ? "ویرایش ناحیه" : "ناحیه جدید"}
          close={() => setZoneFormOpen(false)}
          small
        >
          <form onSubmit={submitZone}>
            <div className="warehouse-form-grid">
              <label>
                کد
                <input
                  dir="ltr"
                  value={zoneDraft.code}
                  onChange={(e) =>
                    setZoneDraft((d) => ({ ...d, code: e.target.value }))
                  }
                />
              </label>
              <label>
                عنوان
                <input
                  value={zoneDraft.title}
                  onChange={(e) =>
                    setZoneDraft((d) => ({ ...d, title: e.target.value }))
                  }
                />
              </label>
              <label className="warehouse-form-grid__wide">
                توضیحات
                <textarea
                  rows={3}
                  value={zoneDraft.description}
                  onChange={(e) =>
                    setZoneDraft((d) => ({ ...d, description: e.target.value }))
                  }
                />
              </label>
            </div>
            <footer>
              <button className="warehouse-button--primary">ذخیره</button>
              <button type="button" onClick={() => setZoneFormOpen(false)}>
                انصراف
              </button>
            </footer>
          </form>
        </Dialog>
      ) : null}
      {locationFormOpen ? (
        <Dialog
          title={locationDraft.locationId ? "ویرایش موقعیت" : "موقعیت جدید"}
          close={() => setLocationFormOpen(false)}
          small
        >
          <form onSubmit={submitLocation}>
            <div className="warehouse-form-grid">
              <label>
                ناحیه
                <select
                  disabled={Boolean(locationDraft.locationId)}
                  value={locationDraft.zoneId}
                  onChange={(e) =>
                    setLocationDraft((d) => ({
                      ...d,
                      zoneId: e.target.value,
                      parentLocationId: "",
                    }))
                  }
                >
                  <option value="">انتخاب کنید</option>
                  {zones
                    .filter((z) => z.status === "active")
                    .map((z) => (
                      <option key={z.zoneId} value={z.zoneId}>
                        {z.code} — {z.title}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                والد
                <select
                  value={locationDraft.parentLocationId}
                  onChange={(e) =>
                    setLocationDraft((d) => ({
                      ...d,
                      parentLocationId: e.target.value,
                    }))
                  }
                >
                  <option value="">بدون والد</option>
                  {locations
                    .filter(
                      (l) =>
                        l.zoneId === locationDraft.zoneId &&
                        l.locationId !== locationDraft.locationId,
                    )
                    .map((l) => (
                      <option key={l.locationId} value={l.locationId}>
                        {l.code} — {l.title}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                کد
                <input
                  dir="ltr"
                  value={locationDraft.code}
                  onChange={(e) =>
                    setLocationDraft((d) => ({ ...d, code: e.target.value }))
                  }
                />
              </label>
              <label>
                عنوان
                <input
                  value={locationDraft.title}
                  onChange={(e) =>
                    setLocationDraft((d) => ({ ...d, title: e.target.value }))
                  }
                />
              </label>
              <label>
                نوع
                <select
                  value={locationDraft.kind}
                  onChange={(e) =>
                    setLocationDraft((d) => ({
                      ...d,
                      kind: e.target.value as LocationKind,
                    }))
                  }
                >
                  {Object.entries(locationKindLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="warehouse-form-grid__wide">
                توضیحات
                <textarea
                  rows={3}
                  value={locationDraft.description}
                  onChange={(e) =>
                    setLocationDraft((d) => ({
                      ...d,
                      description: e.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <footer>
              <button className="warehouse-button--primary">ذخیره</button>
              <button type="button" onClick={() => setLocationFormOpen(false)}>
                انصراف
              </button>
            </footer>
          </form>
        </Dialog>
      ) : null}
      {moveFormOpen && movingLocation ? (
        <Dialog
          title={`انتقال موقعیت ${movingLocation.title}`}
          close={() => setMoveFormOpen(false)}
          small
        >
          <form onSubmit={submitMove}>
            <div className="warehouse-form-grid">
              <label>
                انبار مقصد
                <select
                  value={moveDraft.warehouseId}
                  onChange={(e) => void updateMoveWarehouse(e.target.value)}
                >
                  {moveWarehouses.map((w) => (
                    <option key={w.warehouseId} value={w.warehouseId}>
                      {w.code} — {w.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                ناحیه مقصد
                <select
                  value={moveDraft.zoneId}
                  onChange={(e) => void updateMoveZone(e.target.value)}
                >
                  <option value="">انتخاب کنید</option>
                  {moveZones.map((z) => (
                    <option key={z.zoneId} value={z.zoneId}>
                      {z.code} — {z.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="warehouse-form-grid__wide">
                والد جدید
                <select
                  value={moveDraft.parentLocationId}
                  onChange={(e) =>
                    setMoveDraft((d) => ({
                      ...d,
                      parentLocationId: e.target.value,
                    }))
                  }
                >
                  <option value="">بدون والد</option>
                  {moveParents.map((l) => (
                    <option key={l.locationId} value={l.locationId}>
                      {l.code} — {l.title}
                    </option>
                  ))}
                </select>
              </label>
              <p className="warehouse-form-grid__wide warehouse-dialog-note">
                انتقال بین ناحیه/انبار برای موقعیت دارای زیرمجموعه مجاز نیست.
                تغییر والد داخل یک ناحیه با کنترل چرخه انجام می‌شود.
              </p>
            </div>
            <footer>
              <button className="warehouse-button--primary">انتقال</button>
              <button type="button" onClick={() => setMoveFormOpen(false)}>
                انصراف
              </button>
            </footer>
          </form>
        </Dialog>
      ) : null}
    </Page>
  );
}

function Dialog({
  title,
  close,
  small = false,
  children,
}: {
  title: string;
  close: () => void;
  small?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className="warehouse-dialog-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section
        className={`warehouse-dialog${small ? " warehouse-dialog--small" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <h2>{title}</h2>
          <button type="button" onClick={close} aria-label="بستن">
            ×
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
