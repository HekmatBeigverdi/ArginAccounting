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
import { InventoryWarehouseDependencyGuard } from "@argin/inventory-tauri";
import { getDesktopDatabase } from "@argin/database-tauri";
import { SqliteBranchRepository } from "@argin/company-tauri";

import { useActiveContext } from "../../app/providers/active-context-provider";
import { useAuthSession } from "../../app/providers/auth-session-provider";
import { Feedback } from "../../components/feedback";
import { Page } from "../../components/layout";
import { createPersistentWarehouseAuditSink } from "./warehouse-audit-sink";

import {
  WarehouseConfirmationDialog,
  type WarehouseConfirmation,
} from "./warehouse-confirmation-dialog";

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
    ["warehouse.restore.requires-archived"]:
      "فقط انبار بایگانی‌شده قابل بازگردانی است؛ فهرست را تازه‌سازی کنید.",
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
  const [locations, setLocations] = useState<readonly WarehouseLocationDto[]>([]);
  const [moveWarehouses, setMoveWarehouses] = useState<readonly WarehouseListItemDto[]>([]);
  const [moveZones, setMoveZones] = useState<readonly WarehouseZoneDto[]>([]);
  const [moveParents, setMoveParents] = useState<readonly WarehouseLocationDto[]>([]);
  const [movingLocation, setMovingLocation] = useState<WarehouseLocationDto | null>(null);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmation, setConfirmation] = useState<WarehouseConfirmation | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [warehouseFormOpen, setWarehouseFormOpen] = useState(false);
  const [zoneFormOpen, setZoneFormOpen] = useState(false);
  const [locationFormOpen, setLocationFormOpen] = useState(false);
  const [moveFormOpen, setMoveFormOpen] = useState(false);
  const [warehouseDraft, setWarehouseDraft] = useState<WarehouseDraft>(emptyWarehouseDraft);
  const [zoneDraft, setZoneDraft] = useState<ZoneDraft>(emptyZoneDraft);
  const [locationDraft, setLocationDraft] = useState<LocationDraft>(emptyLocationDraft);
  const [moveDraft, setMoveDraft] = useState<MoveDraft>(emptyMoveDraft);
  const [structureTab, setStructureTab] = useState<StructureTab>("zones");

  const authorization = useMemo<WarehouseAuthorizationPolicy>(
    () => ({
      require: async (_context, permission) => {
        if (!can(permission))
          throw new WarehouseApplicationError(WAREHOUSE_APPLICATION_ERROR_CODES.unauthorized);
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
      dependencyGuard: new InventoryWarehouseDependencyGuard(database),
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
      const companyBranches = await new SqliteBranchRepository(database).findByCompanyId(active.companyId);
      setBranches(
        companyBranches
          .filter((branch) => branch.status === "active")
          .sort((left, right) => Number(right.isHeadOffice) - Number(left.isHeadOffice) || left.code.localeCompare(right.code, "en", { sensitivity: "accent" })),
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
  }, [active.companyId, buildAdapters, can, deferredSearch, kindFilter, page, statusFilter]);

  const loadDetail = useCallback(async (warehouseId: string | null) => {
    if (!warehouseId || !active.companyId) {
      setDetail(null);
      setZones([]);
      setLocations([]);
      return;
    }
    try {
      const { reader, rawReader } = await buildAdapters();
      const current = await reader.getById({ companyId: active.companyId, warehouseId });
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
  }, [active.companyId, buildAdapters]);

  useEffect(() => {
    setConfirmation(null);
    setSelectedId(null);
    setDetail(null);
    setPage(1);
    void loadBranches();
  }, [active.companyId, loadBranches]);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => { void loadDetail(selectedId); }, [loadDetail, selectedId]);

  function clearFeedback() { setMessage(""); setError(""); }
  function openCreate() {
    clearFeedback(); setDetail(null); setSelectedId(null); setWarehouseDraft(emptyWarehouseDraft); setWarehouseFormOpen(true);
  }
  function openEdit() {
    if (!detail) return;
    clearFeedback(); setWarehouseDraft(draftFrom(detail)); setWarehouseFormOpen(true);
  }

  async function submitWarehouse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!active.companyId || !warehouseDraft.code.trim() || !warehouseDraft.title.trim()) return setError("کد و عنوان انبار الزامی است.");
    if (warehouseDraft.scopeMode === "branch" && !warehouseDraft.branchId) return setError("برای انبار شعبه‌ای، انتخاب شعبه الزامی است.");
    setSaving(true); clearFeedback();
    try {
      const { service } = await buildAdapters();
      const scope: WarehouseOrganizationalScope = warehouseDraft.scopeMode === "company" ? { mode: "company" } : { mode: "branch", branchId: warehouseDraft.branchId };
      if (!detail) {
        const created = await service.create(securityContext(actorId), {
          ...requestBase(active.companyId), warehouseId: crypto.randomUUID(), code: warehouseDraft.code, title: warehouseDraft.title,
          description: nullable(warehouseDraft.description), kind: warehouseDraft.kind, organizationalScope: scope,
          externalIdentifiers: parseExternalIdentifiers(warehouseDraft.externalIdentifiers),
        });
        setSelectedId(created.warehouseId); setDetail(created); setMessage("انبار با موفقیت ایجاد شد.");
      } else {
        let current = await service.update(securityContext(actorId), {
          ...requestBase(active.companyId), warehouseId: detail.warehouseId, code: warehouseDraft.code, title: warehouseDraft.title,
          description: nullable(warehouseDraft.description), externalIdentifiers: parseExternalIdentifiers(warehouseDraft.externalIdentifiers), expectedVersion: detail.version,
        });
        const scopeChanged = current.organizationalScope.mode !== scope.mode || (scope.mode === "branch" && current.organizationalScope.mode === "branch" && current.organizationalScope.branchId !== scope.branchId);
        if (scopeChanged) current = await service.changeScope(securityContext(actorId), { ...requestBase(active.companyId), warehouseId: current.warehouseId, organizationalScope: scope, expectedVersion: current.version });
        if (current.kind !== warehouseDraft.kind) current = await service.changeKind(securityContext(actorId), { ...requestBase(active.companyId), warehouseId: current.warehouseId, kind: warehouseDraft.kind, expectedVersion: current.version });
        setDetail(current); setMessage("تغییرات انبار ذخیره شد.");
      }
      setWarehouseFormOpen(false); await reload();
    } catch (reason) { setError(errorMessage(reason)); } finally { setSaving(false); }
  }

  async function runWarehouseStatus(status: WarehouseStatus) {
    if (!detail || !active.companyId) return;
    setSaving(true); clearFeedback();
    try {
      const { service } = await buildAdapters();
      const next = await service.changeStatus(securityContext(actorId), { ...requestBase(active.companyId), warehouseId: detail.warehouseId, status, expectedVersion: detail.version });
      setDetail(next); setMessage(`وضعیت انبار به «${statusLabels[next.status]}» تغییر کرد.`); await reload();
    } catch (reason) { setError(errorMessage(reason)); } finally { setSaving(false); }
  }

  async function runWarehouseDelete() {
    if (!detail || !active.companyId) return;
    setSaving(true); clearFeedback();
    try {
      const { service } = await buildAdapters();
      await service.delete(securityContext(actorId), { ...requestBase(active.companyId), warehouseId: detail.warehouseId, expectedVersion: detail.version });
      setSelectedId(null); setDetail(null); setMessage("انبار حذف شد."); await reload();
    } catch (reason) { setError(errorMessage(reason)); } finally { setSaving(false); }
  }

  async function runWarehouseRestore() {
    if (!detail || !active.companyId) return;
    setSaving(true); clearFeedback();
    try {
      const { service } = await buildAdapters();
      const restored = await service.restore(securityContext(actorId), { ...requestBase(active.companyId), warehouseId: detail.warehouseId, expectedVersion: detail.version });
      setDetail(restored); setMessage("انبار بازیابی شد."); await reload();
    } catch (reason) { setError(errorMessage(reason)); } finally { setSaving(false); }
  }

  async function submitZone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || !active.companyId || !zoneDraft.code.trim() || !zoneDraft.title.trim()) return setError("کد و عنوان ناحیه الزامی است.");
    setSaving(true); clearFeedback();
    try {
      const { service } = await buildAdapters();
      if (zoneDraft.zoneId) await service.updateZone(securityContext(actorId), { ...requestBase(active.companyId), warehouseId: detail.warehouseId, zoneId: zoneDraft.zoneId, code: zoneDraft.code, title: zoneDraft.title, description: nullable(zoneDraft.description) });
      else await service.createZone(securityContext(actorId), { ...requestBase(active.companyId), warehouseId: detail.warehouseId, zoneId: crypto.randomUUID(), code: zoneDraft.code, title: zoneDraft.title, description: nullable(zoneDraft.description) });
      setZoneFormOpen(false); await loadDetail(detail.warehouseId); setMessage("ناحیه ذخیره شد.");
    } catch (reason) { setError(errorMessage(reason)); } finally { setSaving(false); }
  }

  async function runZoneStatus(zone: WarehouseZoneDto, status: "active" | "inactive") {
    if (!detail || !active.companyId) return;
    setSaving(true); clearFeedback();
    try {
      const { service } = await buildAdapters();
      await service.changeZoneStatus(securityContext(actorId), { ...requestBase(active.companyId), warehouseId: detail.warehouseId, zoneId: zone.zoneId, status });
      await loadDetail(detail.warehouseId); setMessage(`وضعیت ناحیه به «${physicalStatusLabels[status]}» تغییر کرد.`);
    } catch (reason) { setError(errorMessage(reason)); } finally { setSaving(false); }
  }

  async function runZoneDelete(zone: WarehouseZoneDto) {
    if (!detail || !active.companyId) return;
    setSaving(true); clearFeedback();
    try {
      const { service } = await buildAdapters();
      await service.deleteZone(securityContext(actorId), { ...requestBase(active.companyId), warehouseId: detail.warehouseId, zoneId: zone.zoneId });
      await loadDetail(detail.warehouseId); setMessage("ناحیه حذف شد.");
    } catch (reason) { setError(errorMessage(reason)); } finally { setSaving(false); }
  }

  async function submitLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || !active.companyId || !locationDraft.zoneId || !locationDraft.code.trim() || !locationDraft.title.trim()) return setError("ناحیه، کد و عنوان موقعیت الزامی است.");
    setSaving(true); clearFeedback();
    try {
      const { service } = await buildAdapters();
      if (locationDraft.locationId) await service.updateLocation(securityContext(actorId), { ...requestBase(active.companyId), warehouseId: detail.warehouseId, zoneId: locationDraft.zoneId, locationId: locationDraft.locationId, code: locationDraft.code, title: locationDraft.title, description: nullable(locationDraft.description) });
      else await service.createLocation(securityContext(actorId), { ...requestBase(active.companyId), warehouseId: detail.warehouseId, zoneId: locationDraft.zoneId, locationId: crypto.randomUUID(), parentLocationId: nullable(locationDraft.parentLocationId), code: locationDraft.code, title: locationDraft.title, kind: locationDraft.kind, description: nullable(locationDraft.description) });
      setLocationFormOpen(false); await loadDetail(detail.warehouseId); setMessage("موقعیت ذخیره شد.");
    } catch (reason) { setError(errorMessage(reason)); } finally { setSaving(false); }
  }

  async function runLocationStatus(location: WarehouseLocationDto, status: "active" | "inactive") {
    if (!detail || !active.companyId) return;
    setSaving(true); clearFeedback();
    try {
      const { service } = await buildAdapters();
      await service.changeLocationStatus(securityContext(actorId), { ...requestBase(active.companyId), warehouseId: detail.warehouseId, zoneId: location.zoneId, locationId: location.locationId, status });
      await loadDetail(detail.warehouseId); setMessage(`وضعیت موقعیت به «${physicalStatusLabels[status]}» تغییر کرد.`);
    } catch (reason) { setError(errorMessage(reason)); } finally { setSaving(false); }
  }

  async function runLocationDelete(location: WarehouseLocationDto) {
    if (!detail || !active.companyId) return;
    setSaving(true); clearFeedback();
    try {
      const { service } = await buildAdapters();
      await service.deleteLocation(securityContext(actorId), { ...requestBase(active.companyId), warehouseId: detail.warehouseId, zoneId: location.zoneId, locationId: location.locationId });
      await loadDetail(detail.warehouseId); setMessage("موقعیت حذف شد.");
    } catch (reason) { setError(errorMessage(reason)); } finally { setSaving(false); }
  }

  async function submitMoveLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || !active.companyId || !movingLocation || !moveDraft.warehouseId || !moveDraft.zoneId) return setError("انبار و ناحیه مقصد الزامی است.");
    setSaving(true); clearFeedback();
    try {
      const { service } = await buildAdapters();
      await service.moveLocation(securityContext(actorId), {
        ...requestBase(active.companyId), warehouseId: detail.warehouseId, zoneId: movingLocation.zoneId, locationId: movingLocation.locationId,
        destinationWarehouseId: moveDraft.warehouseId, destinationZoneId: moveDraft.zoneId, destinationParentLocationId: nullable(moveDraft.parentLocationId),
      });
      setMoveFormOpen(false); setMovingLocation(null); await loadDetail(detail.warehouseId); setMessage("موقعیت جابه‌جا شد.");
    } catch (reason) { setError(errorMessage(reason)); } finally { setSaving(false); }
  }

  async function openMoveLocation(location: WarehouseLocationDto) {
    if (!active.companyId) return;
    clearFeedback();
    try {
      const { rawReader } = await buildAdapters();
      const warehouseOptions = await rawReader.select({ companyId: active.companyId, statuses: ["active"], limit: 100 });
      setMoveWarehouses(warehouseOptions); setMovingLocation(location);
      setMoveDraft({ warehouseId: detail?.warehouseId ?? "", zoneId: location.zoneId, parentLocationId: location.parentLocationId ?? "" });
      const zoneOptions = await rawReader.listZones({ companyId: active.companyId, warehouseId: detail?.warehouseId ?? "", statuses: ["active"] });
      setMoveZones(zoneOptions);
      const parentOptions = await rawReader.listLocations({ companyId: active.companyId, warehouseId: detail?.warehouseId ?? "", zoneId: location.zoneId, statuses: ["active"] });
      setMoveParents(parentOptions.filter((item) => item.locationId !== location.locationId));
      setMoveFormOpen(true);
    } catch (reason) { setError(errorMessage(reason)); }
  }

  // Existing dense Persian RTL render surface is intentionally retained below; Step 20 changes composition only.
  return (
    <Page title="انبارها" subtitle="مدیریت انبار، ناحیه و موقعیت فیزیکی">
      {error ? <Feedback tone="error">{error}</Feedback> : null}
      {message ? <Feedback tone="success">{message}</Feedback> : null}
      <div className="warehouse-page" dir="rtl">
        <section className="warehouse-toolbar">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="جست‌وجوی انبار" />
          <select value={kindFilter} onChange={(event) => setKindFilter(event.target.value as KindFilter)}><option value="all">همه انواع</option>{Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}><option value="all">همه وضعیت‌ها</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <button type="button" onClick={openCreate} disabled={!can(warehousePermissions.create)}>انبار جدید</button>
        </section>
        <div className="warehouse-layout">
          <aside><strong>انبارها ({totalCount})</strong>{loading ? <p>در حال بارگذاری…</p> : items.map((item) => <button type="button" key={item.warehouseId} onClick={() => setSelectedId(item.warehouseId)} className={selectedId === item.warehouseId ? "is-selected" : ""}><span dir="ltr">{item.code}</span> — {item.title}</button>)}</aside>
          <main>
            {!detail ? <p>یک انبار را انتخاب کنید.</p> : <>
              <header><h2><span dir="ltr">{detail.code}</span> — {detail.title}</h2><p>{scopeLabel(detail.organizationalScope, branches)} · {statusLabels[detail.status]} · {kindLabels[detail.kind]}</p><small>آخرین تغییر: {formatDate(detail.updatedAt)}</small></header>
              <div className="warehouse-actions">
                <button type="button" onClick={openEdit} disabled={!can(warehousePermissions.edit)}>ویرایش</button>
                {detail.status === "active" ? <button type="button" onClick={() => void runWarehouseStatus("inactive")}>غیرفعال</button> : null}
                {detail.status === "inactive" ? <button type="button" onClick={() => void runWarehouseStatus("active")}>فعال</button> : null}
                {detail.status !== "archived" ? <button type="button" onClick={() => void runWarehouseStatus("archived")}>بایگانی</button> : <button type="button" onClick={() => void runWarehouseRestore()}>بازگردانی</button>}
                <button type="button" onClick={() => void runWarehouseDelete()}>حذف</button>
              </div>
              <nav><button type="button" onClick={() => setStructureTab("zones")}>ناحیه‌ها</button><button type="button" onClick={() => setStructureTab("locations")}>موقعیت‌ها</button></nav>
              {structureTab === "zones" ? <section><button type="button" onClick={() => { setZoneDraft(emptyZoneDraft); setZoneFormOpen(true); }}>ناحیه جدید</button>{zones.map((zone) => <article key={zone.zoneId}><b><span dir="ltr">{zone.code}</span> — {zone.title}</b><button type="button" onClick={() => { setZoneDraft({ zoneId: zone.zoneId, code: zone.code, title: zone.title, description: zone.description ?? "" }); setZoneFormOpen(true); }}>ویرایش</button><button type="button" onClick={() => void runZoneStatus(zone, zone.status === "active" ? "inactive" : "active")}>{zone.status === "active" ? "غیرفعال" : "فعال"}</button><button type="button" onClick={() => void runZoneDelete(zone)}>حذف</button></article>)}</section> : <section><button type="button" onClick={() => { setLocationDraft(emptyLocationDraft); setLocationFormOpen(true); }}>موقعیت جدید</button>{locations.map((location) => <article key={location.locationId}><b><span dir="ltr">{location.code}</span> — {location.title}</b><button type="button" onClick={() => { setLocationDraft({ locationId: location.locationId, zoneId: location.zoneId, parentLocationId: location.parentLocationId ?? "", code: location.code, title: location.title, kind: location.kind, description: location.description ?? "" }); setLocationFormOpen(true); }}>ویرایش</button><button type="button" onClick={() => void runLocationStatus(location, location.status === "active" ? "inactive" : "active")}>{location.status === "active" ? "غیرفعال" : "فعال"}</button><button type="button" onClick={() => void openMoveLocation(location)}>جابه‌جایی</button><button type="button" onClick={() => void runLocationDelete(location)}>حذف</button></article>)}</section>}
            </>}
          </main>
        </div>
      </div>
      {warehouseFormOpen ? <Modal title={detail ? "ویرایش انبار" : "انبار جدید"} onClose={() => setWarehouseFormOpen(false)}><form onSubmit={submitWarehouse}><label>کد<input dir="ltr" value={warehouseDraft.code} onChange={(e) => setWarehouseDraft({ ...warehouseDraft, code: e.target.value })}/></label><label>عنوان<input value={warehouseDraft.title} onChange={(e) => setWarehouseDraft({ ...warehouseDraft, title: e.target.value })}/></label><label>شرح<input value={warehouseDraft.description} onChange={(e) => setWarehouseDraft({ ...warehouseDraft, description: e.target.value })}/></label><label>نوع<select value={warehouseDraft.kind} onChange={(e) => setWarehouseDraft({ ...warehouseDraft, kind: e.target.value as WarehouseKind })}>{Object.entries(kindLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><button disabled={saving}>ذخیره</button></form></Modal> : null}
      {zoneFormOpen ? <Modal title="ناحیه" onClose={() => setZoneFormOpen(false)}><form onSubmit={submitZone}><input dir="ltr" value={zoneDraft.code} onChange={(e)=>setZoneDraft({...zoneDraft,code:e.target.value})}/><input value={zoneDraft.title} onChange={(e)=>setZoneDraft({...zoneDraft,title:e.target.value})}/><button disabled={saving}>ذخیره</button></form></Modal> : null}
      {locationFormOpen ? <Modal title="موقعیت" onClose={() => setLocationFormOpen(false)}><form onSubmit={submitLocation}><select value={locationDraft.zoneId} onChange={(e)=>setLocationDraft({...locationDraft,zoneId:e.target.value})}><option value="">ناحیه</option>{zones.map(z=><option key={z.zoneId} value={z.zoneId}>{z.code} — {z.title}</option>)}</select><input dir="ltr" value={locationDraft.code} onChange={(e)=>setLocationDraft({...locationDraft,code:e.target.value})}/><input value={locationDraft.title} onChange={(e)=>setLocationDraft({...locationDraft,title:e.target.value})}/><button disabled={saving}>ذخیره</button></form></Modal> : null}
      {moveFormOpen && movingLocation ? <Modal title="جابه‌جایی موقعیت" onClose={() => setMoveFormOpen(false)}><form onSubmit={submitMoveLocation}><select value={moveDraft.warehouseId} onChange={async(e)=>{const warehouseId=e.target.value; setMoveDraft({...moveDraft,warehouseId,zoneId:"",parentLocationId:""}); if(active.companyId){const {rawReader}=await buildAdapters(); setMoveZones(await rawReader.listZones({companyId:active.companyId,warehouseId,statuses:["active"]}));}}>{moveWarehouses.map(w=><option key={w.warehouseId} value={w.warehouseId}>{w.code} — {w.title}</option>)}</select><select value={moveDraft.zoneId} onChange={async(e)=>{const zoneId=e.target.value; setMoveDraft({...moveDraft,zoneId,parentLocationId:""}); if(active.companyId){const {rawReader}=await buildAdapters(); setMoveParents((await rawReader.listLocations({companyId:active.companyId,warehouseId:moveDraft.warehouseId,zoneId,statuses:["active"]})).filter(i=>i.locationId!==movingLocation.locationId));}}>{moveZones.map(z=><option key={z.zoneId} value={z.zoneId}>{z.code} — {z.title}</option>)}</select><select value={moveDraft.parentLocationId} onChange={(e)=>setMoveDraft({...moveDraft,parentLocationId:e.target.value})}><option value="">بدون والد</option>{moveParents.map(p=><option key={p.locationId} value={p.locationId}>{p.code} — {p.title}</option>)}</select><button disabled={saving}>جابه‌جایی</button></form></Modal> : null}
      <WarehouseConfirmationDialog confirmation={confirmation} onCancel={() => setConfirmation(null)} onConfirm={() => setConfirmation(null)} />
    </Page>
  );
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose(): void }) {
  return <div className="warehouse-modal" role="dialog" aria-modal="true" aria-label={title}><div><header><strong>{title}</strong><button type="button" onClick={onClose}>بستن</button></header>{children}</div></div>;
}
