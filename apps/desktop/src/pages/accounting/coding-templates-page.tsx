import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { codingTemplatePermissions, type CodingTemplate, type CodingTemplateApplicationHistory, type CodingTemplatePreviewPlan, type CodingTemplateUpgradePlan, type CodingTemplateVersionRecord, type CodingTemplateWorkbookImportPreview } from "@argin/accounting";
import type { Company } from "@argin/company";
import { SqliteCompanyRepository } from "@argin/company-tauri";
import { getDesktopDatabase } from "@argin/database-tauri";
import { useAuthSession } from "../../app/providers/auth-session-provider";
import { useAccountingServices } from "../../composition/accounting/accounting-provider";
import { codingTemplateErrorMessage, codingTemplateLabel, formatJalaliDate } from "../../features/accounting/coding-templates-presenter";
import { CodingTemplatePreviewTree } from "./coding-template-preview-tree";
import "./coding-templates-page.css";

type Tab = "catalog" | "preview" | "upgrade" | "import" | "history";

export function CodingTemplatesPage() {
  const { codingTemplates } = useAccountingServices();
  const { session } = useAuthSession();
  const [companies, setCompanies] = useState<readonly Company[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [templates, setTemplates] = useState<readonly CodingTemplate[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [versions, setVersions] = useState<readonly CodingTemplateVersionRecord[]>([]);
  const [versionId, setVersionId] = useState("");
  const [history, setHistory] = useState<readonly CodingTemplateApplicationHistory[]>([]);
  const [preview, setPreview] = useState<CodingTemplatePreviewPlan | null>(null);
  const [upgrade, setUpgrade] = useState<CodingTemplateUpgradePlan | null>(null);
  const [workbook, setWorkbook] = useState<{ file: File; preview: CodingTemplateWorkbookImportPreview } | null>(null);
  const [tab, setTab] = useState<Tab>("catalog");
  const [search, setSearch] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const permissions = useMemo(() => new Set(session?.user.permissions ?? []), [session]);
  const can = useCallback((permission: string) => permissions.has("system.full-access") || permissions.has(permission), [permissions]);
  const company = companies.find((item) => item.id === companyId) ?? null;
  const selected = templates.find((item) => String(item.id) === selectedId) ?? null;
  const selectedVersion = versions.find((item) => String(item.version.id) === versionId) ?? null;

  const load = useCallback(async () => {
    if (!can(codingTemplatePermissions.view)) return;
    const values = await codingTemplates.searchTemplates(search);
    setTemplates(values);
    setSelectedId((current) => values.some((item) => String(item.id) === current) ? current : String(values[0]?.id ?? ""));
    if (companyId && can(codingTemplatePermissions.history)) setHistory(await codingTemplates.history(companyId));
  }, [can, codingTemplates, companyId, search]);

  useEffect(() => { void getDesktopDatabase().then((db) => new SqliteCompanyRepository(db).findAll()).then((values) => { setCompanies(values); setCompanyId((id) => id || values[0]?.id || ""); }).catch((reason) => setError(codingTemplateErrorMessage(reason))); }, []);
  useEffect(() => { void load().catch((reason) => setError(codingTemplateErrorMessage(reason))); }, [load]);
  useEffect(() => { setPreview(null); setUpgrade(null); setConfirmed(false); if (!selectedId) { setVersions([]); return; } void codingTemplates.searchVersions(selectedId).then((items) => { setVersions(items); setVersionId(String(items[0]?.version.id ?? "")); }).catch((reason) => setError(codingTemplateErrorMessage(reason))); }, [codingTemplates, selectedId]);

  async function run(action: () => Promise<void>, success?: string) { setBusy(true); setError(""); setMessage(""); try { await action(); if (success) setMessage(success); } catch (reason) { setError(codingTemplateErrorMessage(reason)); } finally { setBusy(false); } }
  async function createPreview() { await run(async () => { const value = await codingTemplates.preview(companyId, versionId); setPreview(value); setConfirmed(false); setTab("preview"); }); }
  async function apply() { if (!preview || !selected || !confirmed) return; await run(async () => { await codingTemplates.apply({ companyId, templateId: String(selected.id), versionId, baselineFingerprint: preview.baselineFingerprint }); setPreview(null); setConfirmed(false); await load(); }, "الگوی کدینگ با موفقیت روی شرکت اعمال شد."); }
  async function inspectWorkbook(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (!file) return; await run(async () => setWorkbook({ file, preview: await codingTemplates.previewWorkbook(file) })); }
  async function importWorkbook() { if (!workbook || !confirmed) return; await run(async () => { await codingTemplates.importWorkbook(workbook.file, workbook.preview.fileFingerprint); setWorkbook(null); setConfirmed(false); await load(); }, "الگوی Excel اعتبارسنجی و منتشر شد."); }
  async function compareUpgrade() { const application = history.find((item) => item.templateId === selectedId && item.status === "applied"); if (!application) return; await run(async () => { setUpgrade(await codingTemplates.previewUpgrade(companyId, application.id, versionId)); setTab("upgrade"); }); }

  if (!can(codingTemplatePermissions.view)) return <main className="coding-templates" dir="rtl"><div className="coding-templates__notice" role="alert">برای مشاهده الگوهای کدینگ مجوز کافی ندارید.</div></main>;
  const recommendations = company ? templates.filter((item) => item.lifecycle === "published" && item.activityType === company.activityType) : [];

  return <main className="coding-templates" dir="rtl">
    <header><div><p className="coding-templates__eyebrow">حسابداری · الگوهای کدینگ</p><h1>انتخاب و استقرار کدینگ شرکت</h1><p>ابتدا الگو و نسخه را بررسی کنید؛ اعمال اطلاعات فقط پس از پیش‌نمایش بدون تعارض و تأیید شما انجام می‌شود.</p></div><div className="coding-templates__company"><label htmlFor="template-company">شرکت فعال</label><select id="template-company" value={companyId} onChange={(event) => setCompanyId(event.target.value)}>{companies.map((item) => <option key={item.id} value={item.id}>{item.legalName} — {codingTemplateLabel(item.activityType)}</option>)}</select><small>واحد پول: ریال · تقویم: هجری شمسی</small></div></header>
    {error && <div className="coding-templates__notice coding-templates__notice--error" role="alert">{error}</div>}{message && <div className="coding-templates__notice" role="status">{message}</div>}
    <nav className="coding-templates__tabs" aria-label="بخش‌های الگوی کدینگ">{([["catalog","کاتالوگ"],["preview","پیش‌نمایش"],["upgrade","ارتقا"],["import","ورود Excel"],["history","تاریخچه"]] as const).map(([id,label]) => <button key={id} className={tab === id ? "is-active" : ""} onClick={() => setTab(id)}>{label}</button>)}</nav>
    {tab === "catalog" && <section className="coding-templates__layout"><aside><label htmlFor="template-search">جست‌وجوی الگو</label><input id="template-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="نام یا کد الگو"/><h2>پیشنهاد برای این شرکت</h2>{recommendations.length === 0 && <p className="muted">برای نوع فعالیت این شرکت پیشنهادی منتشر نشده است.</p>}{templates.map((item) => <button key={String(item.id)} className={`template-card ${selectedId === String(item.id) ? "is-selected" : ""}`} onClick={() => setSelectedId(String(item.id))}><strong>{item.persianName}</strong><span>{item.code} · {codingTemplateLabel(item.activityType)}</span>{recommendations.includes(item) && <em>پیشنهاد مناسب</em>}</button>)}</aside><article>{selected ? <><div className="coding-templates__badges"><span>{codingTemplateLabel(selected.lifecycle)}</span><span>{codingTemplateLabel(selected.ownership)}</span></div><h2>{selected.persianName}</h2><p>آخرین تغییر: {formatJalaliDate(selected.updatedAt)}</p><label htmlFor="template-version">نسخه منتشرشده</label><select id="template-version" value={versionId} onChange={(e) => setVersionId(e.target.value)}>{versions.map((item) => <option key={String(item.version.id)} value={String(item.version.id)}>نسخه {Number(item.version.versionNumber)} — {formatJalaliDate(item.version.publishedAt)}</option>)}</select><div className="coding-templates__actions"><button disabled={busy || !companyId || !versionId || !can(codingTemplatePermissions.preview)} onClick={() => void createPreview()}>پیش‌نمایش روی شرکت</button><button className="secondary" disabled={busy || !can(codingTemplatePermissions.upgrade)} onClick={() => void compareUpgrade()}>مقایسه ارتقا</button>{selected.lifecycle === "published" && <button className="danger" disabled={busy || !can(codingTemplatePermissions.retire)} onClick={() => void run(async () => { await codingTemplates.retire(selected); await load(); }, "الگو بازنشسته شد.")}>بازنشسته‌کردن</button>}</div></> : <p>یک الگو را انتخاب کنید.</p>}</article></section>}
    {tab === "preview" && <section className="coding-templates__panel"><h2>نتیجه پیش‌نمایش</h2>{preview && selectedVersion ? <><div className="coding-templates__summary"><span>ایجاد <b>{preview.summary.create}</b></span><span>سازگار <b>{preview.summary.compatibleExisting}</b></span><span>تعارض <b>{preview.summary.conflict}</b></span><span>نامعتبر <b>{preview.summary.invalid}</b></span></div><CodingTemplatePreviewTree content={selectedVersion.content} preview={preview}/>{preview.canApply && <label className="coding-templates__confirm"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)}/> ساختار درختی را بررسی کردم و اعمال این نسخه را تأیید می‌کنم.</label>}<button disabled={busy || !preview.canApply || !confirmed || !can(codingTemplatePermissions.apply)} onClick={() => void apply()}>{preview.canApply ? "اعمال اتمیک الگو" : "اعمال الگو تا رفع تعارض غیرفعال است"}</button></> : <p className="muted">برای شروع، از کاتالوگ یک نسخه را پیش‌نمایش کنید.</p>}</section>}
    {tab === "upgrade" && <section className="coding-templates__panel"><h2>مقایسه ارتقای کدینگ</h2>{upgrade ? <><div className="coding-templates__summary"><span>بدون تغییر <b>{upgrade.summary.unchanged}</b></span><span>تغییر محلی <b>{upgrade.summary.locallyModified}</b></span><span>جدید <b>{upgrade.summary.newlyAvailable}</b></span><span>متعارض <b>{upgrade.summary.conflicting}</b></span></div><p>{upgrade.canApply ? "ارتقای افزایشی قابل بررسی است؛ تغییرات محلی بازنویسی نمی‌شوند." : "برای این ارتقا تعارض یا تصمیم حل‌نشده وجود دارد."}</p></> : <p className="muted">شرکت باید قبلاً نسخه‌ای از همین الگو را اعمال کرده باشد.</p>}</section>}
    {tab === "import" && <section className="coding-templates__panel"><h2>ورود الگوی کدینگ از Excel</h2><p>فقط فایل منطبق با قرارداد رسمی Workbook نسخه ۱ پذیرفته می‌شود.</p><input type="file" accept=".xlsx" onChange={(event) => void inspectWorkbook(event)}/>{workbook && <><div className="coding-templates__summary"><span>حساب‌ها <b>{workbook.preview.summary.accountCount}</b></span><span>ابعاد <b>{workbook.preview.summary.dimensionTypeCount}</b></span><span>خطاها <b>{workbook.preview.summary.errorCount}</b></span></div><label className="coding-templates__confirm"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)}/> نتیجه اعتبارسنجی را بررسی و انتشار الگو را تأیید می‌کنم.</label><button disabled={busy || !workbook.preview.canImport || !confirmed || !can(codingTemplatePermissions.import)} onClick={() => void importWorkbook()}>اعتبارسنجی و انتشار</button></>}</section>}
    {tab === "history" && <section className="coding-templates__panel"><h2>تاریخچه استقرار</h2><div className="coding-templates__table"><table><thead><tr><th>وضعیت</th><th>الگو</th><th>نسخه</th><th>تاریخ شمسی</th></tr></thead><tbody>{history.map((item) => <tr key={item.id}><td>{codingTemplateLabel(item.status)}</td><td>{item.templateId}</td><td>{item.templateVersionId}</td><td>{formatJalaliDate(item.appliedAt ?? item.createdAt)}</td></tr>)}</tbody></table></div>{history.length === 0 && <p className="muted">هنوز الگویی روی این شرکت اعمال نشده است.</p>}</section>}
  </main>;
}
