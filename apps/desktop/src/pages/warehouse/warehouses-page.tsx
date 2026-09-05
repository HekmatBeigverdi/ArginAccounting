import {
  type FormEvent,
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
  code: string;
  title: string;
  description: string;
}

interface LocationDraft {
  zoneId: string;
  parentLocationId: string;
  code: string;
  title: string;
  kind: "bin" | "rack" | "shelf" | "staging" | "receiving" | "dispatch" | "other";
  description: string;
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

const emptyZoneDraft: ZoneDraft = { code: "", title: "", description: "" };
const emptyLocationDraft: LocationDraft = {
  zoneId: "",
  parentLocationId: "",
  code: "",
  title: "",
  kind: "bin",
  description: "",
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
      if (index <= 0 || index === part.length - 1) {
        throw new Error("شناسه خارجی باید به‌صورت NAMESPACE=VALUE وارد شود.");
      }
      return { namespace: part.slice(0, index), value: part.slice(index + 1) };
    });
}

function identifiersToText(detail: WarehouseDto): string {
  return detail.externalIdentifiers
    .map((item) => `${item.namespace}=${item.value}`)
    .join("|");
}

function scopeLabel(scope: WarehouseOrganizationalScope, branches: readonly BranchOption[]): string {
  if (scope.mode === "company") return "کل شرکت";
  const branch = branches.find((item) => item.id === scope.branchId);
  return branch ? `شعبه ${branch.name}` : `شعبه ${scope.branchId}`;
}

function errorMessage(reason: unknown): string {
  const code = reason instanceof WarehouseApplicationError
    ? reason.code
    : typeof reason === "object" && reason !== null && "code" in reason
      ? String((reason as { code?: unknown }).code ?? "")
      : "";
  const map: Readonly<Record<string, string>> = Object.freeze({
    [WAREHOUSE_APPLICATION_ERROR_CODES.invalidRequest]: "اطلاعات واردشده معتبر نیست.",
    [WAREHOUSE_APPLICATION_ERROR_CODES.notFound]: "انبار موردنظر پیدا نشد.",
    [WAREHOUSE_APPLICATION_ERROR_CODES.duplicateIdentifier]: "کد یا شناسه واردشده قبلاً در این شرکت استفاده شده است.",
    [WAREHOUSE_APPLICATION_ERROR_CODES.concurrencyConflict]: "اطلاعات انبار توسط کاربر یا عملیات دیگری تغییر کرده است. صفحه را تازه‌سازی کنید.",
    [WAREHOUSE_APPLICATION_ERROR_CODES.branchReferenceInvalid]: "شعبه انتخاب‌شده معتبر یا فعال نیست.",
    [WAREHOUSE_APPLICATION_ERROR_CODES.archivedMutationForbidden]: "انبار بایگانی‌شده قابل تغییر نیست.",
    [WAREHOUSE_APPLICATION_ERROR_CODES.unauthorized]: "برای این عملیات مجوز کافی ندارید.",
  });
  if (map[code]) return map[code]!;
  return reason instanceof Error ? reason.message : "عملیات با خطا مواجه شد.";
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
    branchId: detail.organizationalScope.mode === "branch" ? detail.organizationalScope.branchId : "",
    externalIdentifiers: identifiersToText(detail),
  };
}

export function WarehousesPage() {
  const { session } = useAuthSession();
  const active = useActiveContext();
  const actorId = session?.user.id ?? "desktop-local-user";
  const permissionSet = useMemo(() => new Set(session?.user.permissions ?? []), [session]);
  const can = useCallback(
    (permission: string) => permissionSet.has("system.full-access") || permissionSet.has(permission),
    [permissionSet],
  );

  const [items, setItems] = useState<readonly WarehouseListItemDto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<WarehouseDto | null>(null);
  const [branches, setBranches] = useState<readonly BranchOption[]>([]);
  const [zones, setZones] = useState<readonly WarehouseZoneDto[]>([]);
  const [locations, setLocations] = useState<readonly WarehouseLocationDto[]>([]);
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
  const [warehouseDraft, setWarehouseDraft] = useState<WarehouseDraft>(emptyWarehouseDraft);
  const [zoneDraft, setZoneDraft] = useState<ZoneDraft>(emptyZoneDraft);
  const [locationDraft, setLocationDraft] = useState<LocationDraft>(emptyLocationDraft);
  const [structureTab, setStructureTab] = useState<StructureTab>("zones");

  const authorization = useMemo<WarehouseAuthorizationPolicy>(() => ({
    require: async (_context, permission) => {
      if (!can(permission)) {
        throw new WarehouseApplicationError(WAREHOUSE_APPLICATION_ERROR_CODES.unauthorized);
      }
    },
  }), [can]);

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
      database,
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
    if (!active.companyId) {
      setBranches([]);
      return;
    }
    try {
      const database = await getDesktopDatabase();
      const rows = await database.query<BranchOption>(
        `SELECT id, code, name FROM branches WHERE company_id = ? AND status = 'active' ORDER BY is_head_office DESC, code COLLATE NOCASE ASC`,
        [active.companyId],
      );
      setBranches(rows);
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
    setSelectedId(null);
    setDetail(null);
    setPage(1);
    void loadBranches();
  }, [active.companyId, loadBranches]);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => { void loadDetail(selectedId); }, [loadDetail, selectedId]);

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
    if (!active.companyId) return;
    if (!warehouseDraft.code.trim() || !warehouseDraft.title.trim()) {
      setError("کد و عنوان انبار الزامی است.");
      return;
    }
    if (warehouseDraft.scopeMode === "branch" && !warehouseDraft.branchId) {
      setError("برای انبار شعبه‌ای، انتخاب شعبه الزامی است.");
      return;
    }
    setSaving(true);
    clearFeedback();
    try {
      const { service } = await buildAdapters();
      const scope: WarehouseOrganizationalScope = warehouseDraft.scopeMode === "company"
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
          externalIdentifiers: parseExternalIdentifiers(warehouseDraft.externalIdentifiers),
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
          externalIdentifiers: parseExternalIdentifiers(warehouseDraft.externalIdentifiers),
          expectedVersion: detail.version,
        });
        const scopeChanged = current.organizationalScope.mode !== scope.mode ||
          (scope.mode === "branch" && current.organizationalScope.mode === "branch" && current.organizationalScope.branchId !== scope.branchId);
        if (scopeChanged) {
          current = await service.changeScope(securityContext(actorId), {
            ...requestBase(active.companyId),
            warehouseId: current.warehouseId,
            organizationalScope: scope,
            expectedVersion: current.version,
          });
        }
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

  async function submitZone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || !active.companyId) return;
    if (!zoneDraft.code.trim() || !zoneDraft.title.trim()) {
      setError("کد و عنوان ناحیه الزامی است.");
      return;
    }
    setSaving(true);
    clearFeedback();
    try {
      const { service } = await buildAdapters();
      await service.createZone(securityContext(actorId), {
        ...requestBase(active.companyId),
        zoneId: crypto.randomUUID(),
        warehouseId: detail.warehouseId,
        code: zoneDraft.code,
        title: zoneDraft.title,
        description: nullable(zoneDraft.description),
      });
      setZoneFormOpen(false);
      setZoneDraft(emptyZoneDraft);
      setMessage("ناحیه انبار ایجاد شد.");
      await loadDetail(detail.warehouseId);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  async function submitLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || !active.companyId) return;
    if (!locationDraft.zoneId || !locationDraft.code.trim() || !locationDraft.title.trim()) {
      setError("ناحیه، کد و عنوان موقعیت الزامی است.");
      return;
    }
    setSaving(true);
    clearFeedback();
    try {
      const { service } = await buildAdapters();
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
      setLocationFormOpen(false);
      setLocationDraft(emptyLocationDraft);
      setMessage("موقعیت فیزیکی ایجاد شد.");
      await loadDetail(detail.warehouseId);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  if (!can(warehousePermissions.view)) {
    return (
      <Page className="warehouses-page" lang="fa" dir="rtl">
        <Feedback tone="error">شما مجوز مشاهده انبارها را ندارید.</Feedback>
      </Page>
    );
  }

  return (
    <Page className="warehouses-page" lang="fa" dir="rtl">
      <header className="warehouses-page__header">
        <div>
          <p className="warehouses-page__eyebrow">اطلاعات پایه / انبار</p>
          <h1>انبارها و ساختار فیزیکی</h1>
          <p>تعریف انبار، محدوده سازمانی و ساختار ناحیه / موقعیت بدون ورود به موجودی و گردش کالا</p>
        </div>
        <button className="warehouse-button warehouse-button--primary" type="button" onClick={openCreate} disabled={!active.companyId || !can(warehousePermissions.create)}>
          انبار جدید
        </button>
      </header>

      {message ? <Feedback tone="success">{message}</Feedback> : null}
      {error ? <Feedback tone="error">{error}</Feedback> : null}

      <section className="warehouse-toolbar" aria-label="فیلتر انبارها">
        <label className="warehouse-search">
          <span>جستجو</span>
          <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="کد یا عنوان انبار" />
        </label>
        <label>
          <span>نوع</span>
          <select value={kindFilter} onChange={(event) => { setKindFilter(event.target.value as KindFilter); setPage(1); }}>
            <option value="all">همه</option>
            {Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          <span>وضعیت</span>
          <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as StatusFilter); setPage(1); }}>
            <option value="all">همه</option>
            <option value="active">فعال</option>
            <option value="inactive">غیرفعال</option>
            <option value="archived">بایگانی‌شده</option>
          </select>
        </label>
        <span className="warehouse-toolbar__count">{totalCount.toLocaleString("fa-IR")} رکورد</span>
      </section>

      <div className="warehouse-workspace">
        <section className="warehouse-list-panel" aria-label="فهرست انبارها">
          <div className="warehouse-table-wrap">
            <table className="warehouse-table">
              <thead><tr><th>کد</th><th>عنوان</th><th>نوع</th><th>محدوده</th><th>وضعیت</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={5}>در حال بارگذاری…</td></tr> : null}
                {!loading && items.length === 0 ? <tr><td colSpan={5}>انبار ثبت‌شده‌ای مطابق فیلتر وجود ندارد.</td></tr> : null}
                {items.map((item) => (
                  <tr key={item.warehouseId} className={selectedId === item.warehouseId ? "warehouse-row--selected" : undefined} onClick={() => setSelectedId(item.warehouseId)} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedId(item.warehouseId); }}>
                    <td dir="ltr" className="warehouse-code">{item.code}</td>
                    <td>{item.title}</td>
                    <td>{kindLabels[item.kind]}</td>
                    <td>{scopeLabel(item.organizationalScope, branches)}</td>
                    <td><span className={`warehouse-status warehouse-status--${item.status}`}>{statusLabels[item.status]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <footer className="warehouse-pagination">
            <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>قبلی</button>
            <span>صفحه {page.toLocaleString("fa-IR")}</span>
            <button type="button" disabled={items.length < 50 || page * 50 >= totalCount} onClick={() => setPage((current) => current + 1)}>بعدی</button>
          </footer>
        </section>

        <aside className="warehouse-detail-panel" aria-label="جزئیات انبار">
          {!detail ? <div className="warehouse-empty-detail">برای مشاهده جزئیات، یک انبار را انتخاب کنید.</div> : (
            <>
              <div className="warehouse-detail__heading">
                <div><strong>{detail.title}</strong><span dir="ltr">{detail.code}</span></div>
                <div className="warehouse-detail__actions">
                  <button type="button" onClick={openEdit} disabled={detail.status === "archived" || !can(warehousePermissions.update)}>ویرایش</button>
                  {detail.status === "active" ? <button type="button" onClick={() => void changeStatus("inactive")} disabled={saving || !can(warehousePermissions.changeStatus)}>غیرفعال</button> : null}
                  {detail.status === "inactive" ? <button type="button" onClick={() => void changeStatus("active")} disabled={saving || !can(warehousePermissions.changeStatus)}>فعال</button> : null}
                  {detail.status !== "archived" ? <button className="warehouse-button--danger" type="button" onClick={() => void changeStatus("archived")} disabled={saving || !can(warehousePermissions.changeStatus)}>بایگانی</button> : null}
                </div>
              </div>

              <dl className="warehouse-meta-grid">
                <div><dt>نوع</dt><dd>{kindLabels[detail.kind]}</dd></div>
                <div><dt>وضعیت</dt><dd>{statusLabels[detail.status]}</dd></div>
                <div><dt>محدوده</dt><dd>{scopeLabel(detail.organizationalScope, branches)}</dd></div>
                <div><dt>نسخه</dt><dd dir="ltr">{detail.version}</dd></div>
                <div><dt>آخرین تغییر</dt><dd>{formatDate(detail.updatedAt)}</dd></div>
                <div><dt>شناسه‌های خارجی</dt><dd dir="ltr">{identifiersToText(detail) || "—"}</dd></div>
              </dl>
              {detail.description ? <p className="warehouse-description">{detail.description}</p> : null}

              <section className="warehouse-structure">
                <div className="warehouse-structure__header">
                  <div className="warehouse-tabs" role="tablist">
                    <button type="button" className={structureTab === "zones" ? "is-active" : undefined} onClick={() => setStructureTab("zones")}>ناحیه‌ها ({zones.length.toLocaleString("fa-IR")})</button>
                    <button type="button" className={structureTab === "locations" ? "is-active" : undefined} onClick={() => setStructureTab("locations")}>موقعیت‌ها ({locations.length.toLocaleString("fa-IR")})</button>
                  </div>
                  {can(warehousePermissions.manageLocations) && detail.status !== "archived" ? (
                    <button type="button" onClick={() => structureTab === "zones" ? setZoneFormOpen(true) : setLocationFormOpen(true)}>
                      {structureTab === "zones" ? "ناحیه جدید" : "موقعیت جدید"}
                    </button>
                  ) : null}
                </div>
                {structureTab === "zones" ? (
                  <div className="warehouse-structure-list">
                    {zones.length === 0 ? <span>ناحیه‌ای تعریف نشده است.</span> : zones.map((zone) => <div key={zone.zoneId}><b dir="ltr">{zone.code}</b><span>{zone.title}</span><small>{zone.status === "active" ? "فعال" : "غیرفعال"}</small></div>)}
                  </div>
                ) : (
                  <div className="warehouse-structure-list">
                    {locations.length === 0 ? <span>موقعیتی تعریف نشده است.</span> : locations.map((location) => <div key={location.locationId}><b dir="ltr">{location.code}</b><span>{location.title}</span><small>{location.kind}</small></div>)}
                  </div>
                )}
              </section>
            </>
          )}
        </aside>
      </div>

      {warehouseFormOpen ? (
        <div className="warehouse-dialog-backdrop" role="presentation" onMouseDown={() => !saving && setWarehouseFormOpen(false)}>
          <section className="warehouse-dialog" role="dialog" aria-modal="true" aria-labelledby="warehouse-form-title" onMouseDown={(event) => event.stopPropagation()}>
            <header><h2 id="warehouse-form-title">{detail ? "ویرایش انبار" : "انبار جدید"}</h2><button type="button" onClick={() => setWarehouseFormOpen(false)} aria-label="بستن">×</button></header>
            <form onSubmit={submitWarehouse}>
              <div className="warehouse-form-grid">
                <label><span>کد *</span><input dir="ltr" autoFocus value={warehouseDraft.code} onChange={(event) => setWarehouseDraft((current) => ({ ...current, code: event.target.value }))} /></label>
                <label><span>عنوان *</span><input value={warehouseDraft.title} onChange={(event) => setWarehouseDraft((current) => ({ ...current, title: event.target.value }))} /></label>
                <label><span>نوع</span><select value={warehouseDraft.kind} disabled={Boolean(detail)} onChange={(event) => setWarehouseDraft((current) => ({ ...current, kind: event.target.value as WarehouseKind }))}>{Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label><span>محدوده سازمانی</span><select value={warehouseDraft.scopeMode} onChange={(event) => setWarehouseDraft((current) => ({ ...current, scopeMode: event.target.value as "company" | "branch", branchId: "" }))}><option value="company">کل شرکت</option><option value="branch">شعبه</option></select></label>
                {warehouseDraft.scopeMode === "branch" ? <label className="warehouse-form-grid__wide"><span>شعبه *</span><select value={warehouseDraft.branchId} onChange={(event) => setWarehouseDraft((current) => ({ ...current, branchId: event.target.value }))}><option value="">انتخاب شعبه</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.code} — {branch.name}</option>)}</select></label> : null}
                <label className="warehouse-form-grid__wide"><span>شناسه‌های خارجی</span><input dir="ltr" value={warehouseDraft.externalIdentifiers} onChange={(event) => setWarehouseDraft((current) => ({ ...current, externalIdentifiers: event.target.value }))} placeholder="ERP=123|LEGACY=WH-01" /></label>
                <label className="warehouse-form-grid__wide"><span>شرح</span><textarea rows={3} value={warehouseDraft.description} onChange={(event) => setWarehouseDraft((current) => ({ ...current, description: event.target.value }))} /></label>
              </div>
              <footer><button type="button" onClick={() => setWarehouseFormOpen(false)} disabled={saving}>انصراف</button><button className="warehouse-button--primary" type="submit" disabled={saving}>{saving ? "در حال ذخیره…" : "ذخیره"}</button></footer>
            </form>
          </section>
        </div>
      ) : null}

      {zoneFormOpen ? (
        <div className="warehouse-dialog-backdrop" role="presentation" onMouseDown={() => !saving && setZoneFormOpen(false)}>
          <section className="warehouse-dialog warehouse-dialog--small" role="dialog" aria-modal="true" aria-labelledby="zone-form-title" onMouseDown={(event) => event.stopPropagation()}>
            <header><h2 id="zone-form-title">ناحیه جدید</h2><button type="button" onClick={() => setZoneFormOpen(false)}>×</button></header>
            <form onSubmit={submitZone}><div className="warehouse-form-grid"><label><span>کد *</span><input dir="ltr" value={zoneDraft.code} onChange={(event) => setZoneDraft((current) => ({ ...current, code: event.target.value }))} /></label><label><span>عنوان *</span><input value={zoneDraft.title} onChange={(event) => setZoneDraft((current) => ({ ...current, title: event.target.value }))} /></label><label className="warehouse-form-grid__wide"><span>شرح</span><textarea rows={3} value={zoneDraft.description} onChange={(event) => setZoneDraft((current) => ({ ...current, description: event.target.value }))} /></label></div><footer><button type="button" onClick={() => setZoneFormOpen(false)}>انصراف</button><button className="warehouse-button--primary" type="submit" disabled={saving}>ثبت ناحیه</button></footer></form>
          </section>
        </div>
      ) : null}

      {locationFormOpen ? (
        <div className="warehouse-dialog-backdrop" role="presentation" onMouseDown={() => !saving && setLocationFormOpen(false)}>
          <section className="warehouse-dialog" role="dialog" aria-modal="true" aria-labelledby="location-form-title" onMouseDown={(event) => event.stopPropagation()}>
            <header><h2 id="location-form-title">موقعیت جدید</h2><button type="button" onClick={() => setLocationFormOpen(false)}>×</button></header>
            <form onSubmit={submitLocation}><div className="warehouse-form-grid"><label><span>ناحیه *</span><select value={locationDraft.zoneId} onChange={(event) => setLocationDraft((current) => ({ ...current, zoneId: event.target.value, parentLocationId: "" }))}><option value="">انتخاب ناحیه</option>{zones.map((zone) => <option key={zone.zoneId} value={zone.zoneId}>{zone.code} — {zone.title}</option>)}</select></label><label><span>نوع</span><select value={locationDraft.kind} onChange={(event) => setLocationDraft((current) => ({ ...current, kind: event.target.value as LocationDraft["kind"] }))}><option value="bin">Bin</option><option value="rack">Rack</option><option value="shelf">Shelf</option><option value="staging">Staging</option><option value="receiving">Receiving</option><option value="dispatch">Dispatch</option><option value="other">Other</option></select></label><label><span>کد *</span><input dir="ltr" value={locationDraft.code} onChange={(event) => setLocationDraft((current) => ({ ...current, code: event.target.value }))} /></label><label><span>عنوان *</span><input value={locationDraft.title} onChange={(event) => setLocationDraft((current) => ({ ...current, title: event.target.value }))} /></label><label className="warehouse-form-grid__wide"><span>موقعیت والد</span><select value={locationDraft.parentLocationId} onChange={(event) => setLocationDraft((current) => ({ ...current, parentLocationId: event.target.value }))}><option value="">بدون والد</option>{locations.filter((item) => item.zoneId === locationDraft.zoneId).map((item) => <option key={item.locationId} value={item.locationId}>{item.code} — {item.title}</option>)}</select></label><label className="warehouse-form-grid__wide"><span>شرح</span><textarea rows={3} value={locationDraft.description} onChange={(event) => setLocationDraft((current) => ({ ...current, description: event.target.value }))} /></label></div><footer><button type="button" onClick={() => setLocationFormOpen(false)}>انصراف</button><button className="warehouse-button--primary" type="submit" disabled={saving}>ثبت موقعیت</button></footer></form>
          </section>
        </div>
      ) : null}
    </Page>
  );
}
