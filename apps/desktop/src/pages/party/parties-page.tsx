import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  PartyApplicationError,
  PartyApplicationService,
  SecuredPartyApplicationService,
  SecuredPartyReader,
  partyPermissions,
  type PartyAddressInput,
  type PartyContactInput,
  type PartyDetailDto,
  type PartyRole,
  type PartySummaryDto,
  type PartyAuthorizationPolicy,
  type PartyAuditSink,
} from "@argin/party";
import {
  SqlitePartyDuplicateLookup,
  SqlitePartyReader,
  SqlitePartyUnitOfWork,
} from "@argin/party-tauri";
import { getDesktopDatabase } from "@argin/database-tauri";

import { useActiveContext } from "../../app/providers/active-context-provider";
import { useAuthSession } from "../../app/providers/auth-session-provider";
import { useAuditServices } from "../../composition/audit";
import { Feedback } from "../../components/feedback";
import { Field, Select } from "../../components/forms";
import { Page } from "../../components/layout";

import "./parties-page.css";

type Classification = "natural-person" | "legal-entity";
type StatusFilter = "all" | "active" | "inactive";
type RoleFilter = "all" | PartyRole;

interface Draft {
  classification: Classification;
  code: string;
  firstName: string;
  lastName: string;
  legalName: string;
  tradeName: string;
  nationalCode: string;
  nationalId: string;
  registrationNumber: string;
  economicNumber: string;
  legacyEconomicCode: string;
  taxFileNumber: string;
  phone: string;
  mobile: string;
  email: string;
  website: string;
  addressLine: string;
  postalCode: string;
  customer: boolean;
  supplier: boolean;
}

const emptyDraft: Draft = {
  classification: "natural-person",
  code: "",
  firstName: "",
  lastName: "",
  legalName: "",
  tradeName: "",
  nationalCode: "",
  nationalId: "",
  registrationNumber: "",
  economicNumber: "",
  legacyEconomicCode: "",
  taxFileNumber: "",
  phone: "",
  mobile: "",
  email: "",
  website: "",
  addressLine: "",
  postalCode: "",
  customer: false,
  supplier: false,
};

function messageFor(error: unknown): string {
  if (error instanceof PartyApplicationError) {
    const messages: Partial<Record<string, string>> = {
      "party.notFound": "شخص موردنظر پیدا نشد.",
      "party.code.conflict": "کد شخص در این شرکت تکراری است.",
      "party.identity.conflict": "شناسه رسمی واردشده قبلاً برای شخص دیگری ثبت شده است.",
      "party.concurrentModification": "اطلاعات توسط کاربر دیگری تغییر کرده است. فهرست را تازه‌سازی کنید.",
      "party.permissionDenied": "مجوز انجام این عملیات را ندارید.",
      "party.classification.mismatch": "نوع شخص در ویرایش قابل تغییر نیست.",
    };
    return messages[error.code] ?? error.message;
  }
  return error instanceof Error ? error.message : "خطای غیرمنتظره‌ای رخ داد.";
}

function rolesFromDraft(draft: Draft): PartyRole[] {
  return [draft.customer ? "customer" : null, draft.supplier ? "supplier" : null].filter(
    (value): value is PartyRole => value !== null,
  );
}

function contactsFromDraft(draft: Draft, partyId: string): PartyContactInput[] {
  const values: Array<["phone" | "mobile" | "email" | "website", string]> = [
    ["phone", draft.phone],
    ["mobile", draft.mobile],
    ["email", draft.email],
    ["website", draft.website],
  ];
  return values
    .filter(([, value]) => value.trim() !== "")
    .map(([type, value]) => ({
      id: `${partyId}:contact:${type}:general`,
      type,
      value,
      purpose: "general",
      isPrimary: true,
      contactPerson: null,
      title: null,
    }));
}

function addressesFromDraft(draft: Draft, partyId: string): PartyAddressInput[] {
  if (draft.addressLine.trim() === "" && draft.postalCode.trim() === "") return [];
  return [{
    id: `${partyId}:address:registered`,
    purpose: "registered",
    province: null,
    city: null,
    district: null,
    addressLine: draft.addressLine,
    postalCode: draft.postalCode || null,
    isPrimary: true,
  }];
}

function draftFromDetail(detail: PartyDetailDto): Draft {
  const contact = (type: string) => detail.contacts.find((item) => item.type === type && item.isPrimary)?.value ?? "";
  const address = detail.addresses.find((item) => item.isPrimary) ?? detail.addresses[0];
  return {
    classification: detail.classification,
    code: detail.code,
    firstName: detail.firstName ?? "",
    lastName: detail.lastName ?? "",
    legalName: detail.legalName ?? "",
    tradeName: detail.tradeName ?? "",
    nationalCode: detail.identity.nationalCode ?? "",
    nationalId: detail.identity.nationalId ?? "",
    registrationNumber: detail.identity.registrationNumber ?? "",
    economicNumber: detail.identity.economicNumber ?? "",
    legacyEconomicCode: detail.identity.legacyEconomicCode ?? "",
    taxFileNumber: detail.identity.taxFileNumber ?? "",
    phone: contact("phone"),
    mobile: contact("mobile"),
    email: contact("email"),
    website: contact("website"),
    addressLine: address?.addressLine ?? "",
    postalCode: address?.postalCode ?? "",
    customer: detail.roles.includes("customer"),
    supplier: detail.roles.includes("supplier"),
  };
}

export function PartiesPage() {
  const { session } = useAuthSession();
  const active = useActiveContext();
  const audit = useAuditServices();
  const [items, setItems] = useState<readonly PartySummaryDto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PartyDetailDto | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [role, setRole] = useState<RoleFilter>("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const permissionSet = useMemo(() => new Set(session?.user.permissions ?? []), [session]);
  const can = useCallback(
    (permission: string) => permissionSet.has("system.full-access") || permissionSet.has(permission),
    [permissionSet],
  );
  const actorId = session?.user.id ?? "desktop-local-user";

  const services = useMemo(() => {
    const authorization: PartyAuthorizationPolicy = {
      require: async (_context, permission) => {
        if (!can(permission)) {
          throw new PartyApplicationError("party.permissionDenied", "Permission denied.");
        }
      },
    };
    const auditSink: PartyAuditSink = {
      record: async (event) => {
        const action = event.action === "party.create" ? "create"
          : event.action === "party.update" ? "update"
          : event.action === "party.change-status" ? "status-change"
          : event.action === "party.export" ? "export"
          : event.action === "party.import" ? "import"
          : "update";
        await audit.recordAuditEntry({
          action,
          source: "desktop",
          actor: { type: "user", id: event.actorId, displayName: session?.user.displayName ?? event.actorId },
          scope: { companyId: event.companyId },
          target: { entityType: "party", entityId: event.partyId, entityDisplayName: null },
          correlationId: event.correlationId,
          metadata: event.metadata,
        });
      },
    };
    return { authorization, auditSink };
  }, [audit, can, session?.user.displayName]);

  const buildAdapters = useCallback(async () => {
    const database = await getDesktopDatabase();
    const reader = new SqlitePartyReader(database);
    const securedReader = new SecuredPartyReader(reader, services.authorization, {
      actorId,
      correlationId: crypto.randomUUID(),
    });
    const application = new PartyApplicationService(
      new SqlitePartyUnitOfWork(database),
      new SqlitePartyDuplicateLookup(database),
    );
    const securedApplication = new SecuredPartyApplicationService(
      application,
      services.authorization,
      services.auditSink,
    );
    return { securedReader, securedApplication };
  }, [actorId, services]);

  const reload = useCallback(async () => {
    if (!active.companyId || !can(partyPermissions.view)) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { securedReader } = await buildAdapters();
      const result = await securedReader.list({
        filter: {
          companyId: active.companyId,
          ...(search.trim() ? { search: search.trim() } : {}),
          ...(status !== "all" ? { statuses: [status] } : {}),
          ...(role !== "all" ? { roles: [role] } : {}),
        },
        page: { page, pageSize: 40 },
        sort: { field: "displayName", direction: "asc" },
      });
      setItems(result.items);
      setTotalPages(result.totalPages);
      if (page > result.totalPages && result.totalPages > 0) setPage(result.totalPages);
    } catch (reason) {
      setError(messageFor(reason));
    } finally {
      setLoading(false);
    }
  }, [active.companyId, buildAdapters, can, page, role, search, status]);

  useEffect(() => { void reload(); }, [reload]);

  useEffect(() => {
    if (!selectedId || !active.companyId) {
      setDetail(null);
      return;
    }
    void buildAdapters()
      .then(({ securedReader }) => securedReader.getById({ companyId: active.companyId, partyId: selectedId }))
      .then((value) => setDetail(value))
      .catch((reason: unknown) => setError(messageFor(reason)));
  }, [active.companyId, buildAdapters, selectedId]);

  function startCreate(): void {
    setSelectedId(null);
    setDetail(null);
    setDraft(emptyDraft);
    setMessage("");
    setError("");
    setFormOpen(true);
  }

  function startEdit(): void {
    if (!detail) return;
    setDraft(draftFromDetail(detail));
    setMessage("");
    setError("");
    setFormOpen(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!active.companyId) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const { securedApplication } = await buildAdapters();
      const occurredAt = new Date().toISOString();
      const context = {
        companyId: active.companyId,
        actorId,
        correlationId: crypto.randomUUID(),
        requestId: crypto.randomUUID(),
        occurredAt,
      };
      if (detail === null) {
        const partyId = crypto.randomUUID();
        const shared = {
          partyId,
          code: draft.code,
          roles: rolesFromDraft(draft),
          contacts: contactsFromDraft(draft, partyId),
          addresses: addressesFromDraft(draft, partyId),
          context,
        };
        const result = draft.classification === "natural-person"
          ? await securedApplication.create({
              classification: "natural-person",
              ...shared,
              firstName: draft.firstName,
              lastName: draft.lastName,
              identity: {
                nationalCode: draft.nationalCode || null,
                economicNumber: draft.economicNumber || null,
                taxFileNumber: draft.taxFileNumber || null,
              },
            })
          : await securedApplication.create({
              classification: "legal-entity",
              ...shared,
              legalName: draft.legalName,
              tradeName: draft.tradeName || null,
              identity: {
                nationalId: draft.nationalId || null,
                registrationNumber: draft.registrationNumber || null,
                economicNumber: draft.economicNumber || null,
                legacyEconomicCode: draft.legacyEconomicCode || null,
                taxFileNumber: draft.taxFileNumber || null,
              },
            });
        setSelectedId(result.party.id);
        setMessage(result.advisoryMatches.length > 0
          ? `شخص ثبت شد؛ ${result.advisoryMatches.length} مورد مشابه برای بررسی یافت شد.`
          : "شخص با موفقیت ثبت شد.");
      } else {
        const partyId = detail.id;
        const shared = {
          partyId,
          contacts: contactsFromDraft(draft, partyId),
          addresses: addressesFromDraft(draft, partyId),
          context,
        };
        const result = detail.classification === "natural-person"
          ? await securedApplication.update({
              classification: "natural-person",
              ...shared,
              firstName: draft.firstName,
              lastName: draft.lastName,
              identity: {
                nationalCode: draft.nationalCode || null,
                economicNumber: draft.economicNumber || null,
                taxFileNumber: draft.taxFileNumber || null,
              },
            })
          : await securedApplication.update({
              classification: "legal-entity",
              ...shared,
              legalName: draft.legalName,
              tradeName: draft.tradeName || null,
              identity: {
                nationalId: draft.nationalId || null,
                registrationNumber: draft.registrationNumber || null,
                economicNumber: draft.economicNumber || null,
                legacyEconomicCode: draft.legacyEconomicCode || null,
                taxFileNumber: draft.taxFileNumber || null,
              },
            });
        setMessage(result.advisoryMatches.length > 0
          ? `تغییرات ذخیره شد؛ ${result.advisoryMatches.length} مورد مشابه برای بررسی یافت شد.`
          : "تغییرات ذخیره شد.");
      }
      setFormOpen(false);
      await reload();
    } catch (reason) {
      setError(messageFor(reason));
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(): Promise<void> {
    if (!detail || !active.companyId) return;
    setSaving(true);
    setError("");
    try {
      const { securedApplication } = await buildAdapters();
      await securedApplication.setStatus({
        partyId: detail.id,
        status: detail.status === "active" ? "inactive" : "active",
        context: {
          companyId: active.companyId,
          actorId,
          correlationId: crypto.randomUUID(),
          requestId: crypto.randomUUID(),
          occurredAt: new Date().toISOString(),
        },
      });
      setMessage(detail.status === "active" ? "شخص غیرفعال شد." : "شخص فعال شد.");
      await reload();
      setSelectedId(detail.id);
    } catch (reason) {
      setError(messageFor(reason));
    } finally {
      setSaving(false);
    }
  }

  if (!can(partyPermissions.view)) {
    return <Page className="parties-page" lang="fa" dir="rtl"><Feedback tone="error">شما مجوز مشاهده اشخاص را ندارید.</Feedback></Page>;
  }

  return (
    <Page className="parties-page" lang="fa" dir="rtl">
      <header className="parties-page__header">
        <div>
          <p className="parties-page__eyebrow">اطلاعات پایه / طرف حساب‌ها</p>
          <h1>اشخاص</h1>
          <p>مدیریت یکپارچه اشخاص حقیقی و حقوقی با نقش مشتری و تأمین‌کننده</p>
        </div>
        <button className="party-button party-button--primary" type="button" onClick={startCreate} disabled={!active.companyId || !can(partyPermissions.create)}>شخص جدید</button>
      </header>

      {!active.companyId && <Feedback tone="warning">برای مدیریت اشخاص ابتدا شرکت فعال را انتخاب کنید.</Feedback>}
      {error && <Feedback tone="error">{error}</Feedback>}
      {message && <Feedback tone="success">{message}</Feedback>}

      <section className="party-toolbar" aria-label="جستجو و فیلتر اشخاص">
        <label className="party-search"><span>جستجو</span><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="کد، نام یا شناسه..." /></label>
        <label><span>وضعیت</span><select value={status} onChange={(event) => { setStatus(event.target.value as StatusFilter); setPage(1); }}><option value="all">همه</option><option value="active">فعال</option><option value="inactive">غیرفعال</option></select></label>
        <label><span>نقش</span><select value={role} onChange={(event) => { setRole(event.target.value as RoleFilter); setPage(1); }}><option value="all">همه</option><option value="customer">مشتری</option><option value="supplier">تأمین‌کننده</option></select></label>
        <button className="party-button" type="button" onClick={() => void reload()} disabled={loading}>تازه‌سازی</button>
      </section>

      <div className="parties-layout">
        <section className="party-list-panel" aria-busy={loading}>
          {loading ? <div className="party-state" role="status">در حال دریافت اشخاص…</div> : items.length === 0 ? <div className="party-state"><strong>شخصی یافت نشد.</strong><span>فیلترها را تغییر دهید یا یک شخص جدید بسازید.</span></div> : (
            <div className="party-table-wrap">
              <table className="party-table">
                <thead><tr><th>کد</th><th>نام / عنوان</th><th>نوع</th><th>نقش</th><th>تماس</th><th>وضعیت</th></tr></thead>
                <tbody>{items.map((item) => <tr key={item.id} className={selectedId === item.id ? "party-table__row--selected" : ""} tabIndex={0} onClick={() => setSelectedId(item.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(item.id); } }}><td>{item.code}</td><td><strong>{item.displayName}</strong></td><td>{item.classification === "natural-person" ? "حقیقی" : "حقوقی"}</td><td>{item.roles.map((value) => value === "customer" ? "مشتری" : "تأمین‌کننده").join("، ") || "—"}</td><td dir="ltr">{item.primaryMobile ?? item.primaryPhone ?? item.primaryEmail ?? "—"}</td><td><span className={`party-status party-status--${item.status}`}>{item.status === "active" ? "فعال" : "غیرفعال"}</span></td></tr>)}</tbody>
              </table>
            </div>
          )}
          <footer className="party-pagination"><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1}>قبلی</button><span>صفحه {page} از {Math.max(totalPages, 1)}</span><button type="button" onClick={() => setPage((value) => Math.min(Math.max(totalPages, 1), value + 1))} disabled={totalPages === 0 || page >= totalPages}>بعدی</button></footer>
        </section>

        <aside className="party-detail-panel" aria-label="جزئیات شخص">
          {!detail ? <div className="party-state"><strong>یک شخص را انتخاب کنید.</strong><span>جزئیات، اطلاعات هویتی و تماس در این بخش نمایش داده می‌شود.</span></div> : <>
            <div className="party-detail-panel__title"><div><span className="party-code">{detail.code}</span><h2>{detail.displayName}</h2></div><div className="party-detail-panel__actions"><button type="button" className="party-button" onClick={startEdit} disabled={!can(partyPermissions.update)}>ویرایش</button><button type="button" className="party-button" onClick={() => void toggleStatus()} disabled={saving || !can(partyPermissions.changeStatus)}>{detail.status === "active" ? "غیرفعال‌کردن" : "فعال‌کردن"}</button></div></div>
            <dl className="party-detail-grid"><div><dt>نوع</dt><dd>{detail.classification === "natural-person" ? "شخص حقیقی" : "شخص حقوقی"}</dd></div><div><dt>نقش‌ها</dt><dd>{detail.roles.map((value) => value === "customer" ? "مشتری" : "تأمین‌کننده").join("، ") || "بدون نقش"}</dd></div><div><dt>کد ملی / شناسه ملی</dt><dd dir="ltr">{detail.identity.nationalCode ?? detail.identity.nationalId ?? "—"}</dd></div><div><dt>شماره اقتصادی</dt><dd dir="ltr">{detail.identity.economicNumber ?? "—"}</dd></div><div><dt>موبایل</dt><dd dir="ltr">{detail.primaryMobile ?? "—"}</dd></div><div><dt>ایمیل</dt><dd dir="ltr">{detail.primaryEmail ?? "—"}</dd></div></dl>
            {detail.addresses[0] && <div className="party-address-summary"><strong>نشانی</strong><span>{detail.addresses[0].addressLine}</span>{detail.addresses[0].postalCode && <small dir="ltr">کدپستی: {detail.addresses[0].postalCode}</small>}</div>}
          </>}
        </aside>
      </div>

      {formOpen && <div className="party-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setFormOpen(false); }}><section className="party-dialog" role="dialog" aria-modal="true" aria-labelledby="party-form-title"><header><div><p className="parties-page__eyebrow">اطلاعات پایه</p><h2 id="party-form-title">{detail ? "ویرایش شخص" : "شخص جدید"}</h2></div><button className="party-dialog__close" type="button" onClick={() => setFormOpen(false)} disabled={saving} aria-label="بستن">×</button></header><form onSubmit={(event) => void submit(event)}>
        <div className="party-form-grid"><Field label="نوع شخص"><Select value={draft.classification} disabled={detail !== null} onChange={(event) => setDraft((value) => ({ ...value, classification: event.target.value as Classification }))}><option value="natural-person">حقیقی</option><option value="legal-entity">حقوقی</option></Select></Field><Field label="کد شخص"><input value={draft.code} required disabled={detail !== null} onChange={(event) => setDraft((value) => ({ ...value, code: event.target.value }))} /></Field>
        {draft.classification === "natural-person" ? <><Field label="نام"><input required value={draft.firstName} onChange={(event) => setDraft((value) => ({ ...value, firstName: event.target.value }))} /></Field><Field label="نام خانوادگی"><input required value={draft.lastName} onChange={(event) => setDraft((value) => ({ ...value, lastName: event.target.value }))} /></Field><Field label="کد ملی"><input inputMode="numeric" dir="ltr" value={draft.nationalCode} onChange={(event) => setDraft((value) => ({ ...value, nationalCode: event.target.value }))} /></Field></> : <><Field label="نام حقوقی"><input required value={draft.legalName} onChange={(event) => setDraft((value) => ({ ...value, legalName: event.target.value }))} /></Field><Field label="نام تجاری"><input value={draft.tradeName} onChange={(event) => setDraft((value) => ({ ...value, tradeName: event.target.value }))} /></Field><Field label="شناسه ملی"><input inputMode="numeric" dir="ltr" value={draft.nationalId} onChange={(event) => setDraft((value) => ({ ...value, nationalId: event.target.value }))} /></Field><Field label="شماره ثبت"><input dir="ltr" value={draft.registrationNumber} onChange={(event) => setDraft((value) => ({ ...value, registrationNumber: event.target.value }))} /></Field><Field label="کد اقتصادی قدیم"><input dir="ltr" value={draft.legacyEconomicCode} onChange={(event) => setDraft((value) => ({ ...value, legacyEconomicCode: event.target.value }))} /></Field></>}
        <Field label="شماره اقتصادی"><input dir="ltr" value={draft.economicNumber} onChange={(event) => setDraft((value) => ({ ...value, economicNumber: event.target.value }))} /></Field><Field label="شماره پرونده مالیاتی"><input dir="ltr" value={draft.taxFileNumber} onChange={(event) => setDraft((value) => ({ ...value, taxFileNumber: event.target.value }))} /></Field><Field label="تلفن"><input dir="ltr" value={draft.phone} onChange={(event) => setDraft((value) => ({ ...value, phone: event.target.value }))} /></Field><Field label="موبایل"><input dir="ltr" value={draft.mobile} onChange={(event) => setDraft((value) => ({ ...value, mobile: event.target.value }))} /></Field><Field label="ایمیل"><input dir="ltr" type="email" value={draft.email} onChange={(event) => setDraft((value) => ({ ...value, email: event.target.value }))} /></Field><Field label="وب‌سایت"><input dir="ltr" value={draft.website} onChange={(event) => setDraft((value) => ({ ...value, website: event.target.value }))} /></Field><Field label="کدپستی"><input dir="ltr" value={draft.postalCode} onChange={(event) => setDraft((value) => ({ ...value, postalCode: event.target.value }))} /></Field><label className="party-form-address"><span>نشانی</span><textarea rows={2} value={draft.addressLine} onChange={(event) => setDraft((value) => ({ ...value, addressLine: event.target.value }))} /></label></div>
        <fieldset className="party-role-fieldset"><legend>نقش‌های تجاری</legend><label><input type="checkbox" checked={draft.customer} onChange={(event) => setDraft((value) => ({ ...value, customer: event.target.checked }))} /> مشتری</label><label><input type="checkbox" checked={draft.supplier} onChange={(event) => setDraft((value) => ({ ...value, supplier: event.target.checked }))} /> تأمین‌کننده</label></fieldset>
        <footer className="party-dialog__footer"><button type="button" className="party-button" onClick={() => setFormOpen(false)} disabled={saving}>انصراف</button><button type="submit" className="party-button party-button--primary" disabled={saving}>{saving ? "در حال ذخیره…" : "ذخیره"}</button></footer>
      </form></section></div>}
    </Page>
  );
}
