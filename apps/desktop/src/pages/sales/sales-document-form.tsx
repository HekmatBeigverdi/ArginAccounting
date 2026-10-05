import { useEffect, useRef, useState, type FormEvent } from "react";
import { getDesktopDatabase } from "@argin/database-tauri";
import type { PartySelectorDto } from "@argin/party";
import type { ProductSelectorItemDto } from "@argin/product";
import { SalesDomainError, type SalesDocumentSnapshot, type SalesDocumentType } from "@argin/sales";
import { FiscalValidationError } from "@argin/fiscal";
import { createSalesWorkspaceServices, type SalesWorkspaceServices } from "../../composition/sales/create-sales-workspace-services";
import type { SalesDesktopActor, SalesDraftInput } from "../../composition/sales/create-sales-draft";
import { Feedback } from "../../components/feedback";
import { PersianDatePicker } from "../../components/forms/persian-date-picker";
import { SearchableDropdown } from "../../components/forms/searchable-dropdown";
import "../../components/forms/searchable-dropdown.css";
import { gregorianToJalali } from "../inventory/inventory-persian-date";
import "./sales-document-form.css";

interface Props {
  actor: SalesDesktopActor;
  companyId: string;
  branchId: string;
  fiscalYearId: string;
  initialDocument?: SalesDocumentSnapshot;
  expectedVersion?: number;
  onClose(): void;
  onCreated(document: SalesDocumentSnapshot): void;
}

interface DraftLine {
  id: string;
  productId: string;
  sourceLineId?: string;
  lineId?: string;
  preserveAdjustments?: boolean;
  title: string;
  quantity: string;
  unitPrice: string;
  discountPercent: string;
  taxPercent: string;
}

const emptyLine = (): DraftLine => ({
  id: crypto.randomUUID(), productId: "", title: "", quantity: "1", unitPrice: "",
  discountPercent: "0", taxPercent: "0",
});
const numberValue = (value: string) => Number(value.trim()
  .replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
  .replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
  .replace(/٫/g, "."));

function errorMessage(error: unknown) {
  if (error instanceof FiscalValidationError) return error.issues.map(issue => issue.message).join(" ");
  if (error instanceof SalesDomainError) {
    if (error.code === "sales.concurrency_conflict") return "سند هم‌زمان تغییر کرده است؛ فرم را ببندید و نسخهٔ جدید را دوباره باز کنید.";
    if (error.code === "sales.idempotency_conflict") return "این درخواست قبلاً با اطلاعات دیگری ثبت شده است؛ فرم را دوباره باز کنید.";
    return "اطلاعات سند معتبر نیست؛ تاریخ، تعداد، قیمت و درصدهای تخفیف و مالیات را بررسی کنید.";
  }
  return error instanceof Error ? error.message : "ثبت سند فروش ناموفق بود؛ دوباره تلاش کنید.";
}

export function SalesDocumentForm({ actor, companyId, branchId, fiscalYearId, onClose, onCreated, initialDocument, expectedVersion }: Props) {
  const editing = Boolean(initialDocument);
  const dialog = useRef<HTMLDialogElement>(null);
  const mounted = useRef(true);
  const submitting = useRef(false);
  const submission = useRef({ fingerprint: "", id: "" });
  const [services, setServices] = useState<SalesWorkspaceServices | null>(null);
  const [loadRevision, setLoadRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [customerSearch, setCustomerSearch] = useState(() => initialDocument ? `${initialDocument.customer.code} — ${initialDocument.customer.displayName}` : "");
  const [itemSearch, setItemSearch] = useState("");
  const [lineSearch, setLineSearch] = useState<Record<string,string>>({});
  const [customers, setCustomers] = useState<readonly PartySelectorDto[]>([]);
  const [items, setItems] = useState<readonly ProductSelectorItemDto[]>([]);
  const [customer, setCustomer] = useState<Pick<PartySelectorDto, "id" | "code" | "displayName"> | null>(() => initialDocument ? { id: initialDocument.customer.partyId, code: initialDocument.customer.code, displayName: initialDocument.customer.displayName } : null);
  const [documentType, setDocumentType] = useState<SalesDocumentType>(initialDocument?.documentType ?? "sales-invoice");
  const [businessDate, setBusinessDate] = useState(() =>
    initialDocument?.businessDate ?? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())
  );
  const [description, setDescription] = useState(initialDocument?.description ?? "");
  const [relatedDocumentId, setRelatedDocumentId] = useState(initialDocument?.relatedDocumentReference?.documentId ?? "");
  const [originals, setOriginals] = useState<Awaited<ReturnType<SalesWorkspaceServices["selectOriginals"]>>>([]);
  const [originalDocument, setOriginalDocument] = useState<SalesDocumentSnapshot | null>(null);
  const [originalLoading, setOriginalLoading] = useState(false);
  const [lines, setLines] = useState<DraftLine[]>(() => initialDocument ? initialDocument.lines.map(line => {
    const terms = line.commercialTerms;
    return {
      ...emptyLine(), id: line.lineId, lineId: line.lineId,
      productId: line.item.productId, sourceLineId: line.sourceReference?.sourceLineId ?? undefined,
      title: line.description ?? line.item.productId,
      quantity: String(terms?.quantity ?? 1), unitPrice: String(terms?.unitPrice ?? ""),
      discountPercent: String((terms?.discounts[0]?.value ?? 0) / 100),
      taxPercent: String((terms?.taxes[0]?.rateBasisPoints ?? 0) / 100),
      preserveAdjustments: Boolean(terms && (terms.discounts.length > 1 || terms.discounts.some(value => value.mode !== "percent") || terms.taxes.length > 1)),
    };
  }) : [emptyLine()]);
  const needsReference = documentType === "sales-return" || documentType === "sales-correction";

  useEffect(() => {
    mounted.current = true;
    dialog.current?.showModal();
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void getDesktopDatabase().then(async database => {
      const service = createSalesWorkspaceServices(database, actor);
      const [customerOptions, itemOptions] = await Promise.all([
        service.selectCustomers(companyId, branchId, "", editing), service.selectItems(companyId, branchId, "", editing),
      ]);
      if (cancelled) return;
      setServices(service);
      setCustomers(customerOptions);
      setItems(itemOptions);
    }).catch(error => { if (!cancelled) setError(errorMessage(error)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [actor, companyId, branchId, loadRevision]);

  useEffect(() => {
    if (!services) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void services.selectCustomers(companyId, branchId, customerSearch, editing)
        .then(values => { if (!cancelled) setCustomers(values); })
        .catch(error => { if (!cancelled) setError(errorMessage(error)); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [services, companyId, branchId, customerSearch]);

  useEffect(() => {
    if (!services) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void services.selectItems(companyId, branchId, itemSearch, editing)
        .then(values => { if (!cancelled) setItems(values); })
        .catch(error => { if (!cancelled) setError(errorMessage(error)); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [services, companyId, branchId, itemSearch]);

  useEffect(() => {
    setOriginals([]);
    if (!editing) setRelatedDocumentId("");
    if (!services || !customer || !needsReference) return;
    let cancelled = false;
    void services.selectOriginals(companyId, branchId, customer.id, editing)
      .then(values => { if (!cancelled) setOriginals(values); })
      .catch(error => { if (!cancelled) setError(errorMessage(error)); });
    return () => { cancelled = true; };
  }, [services, companyId, branchId, customer, needsReference]);

  useEffect(() => {
    setOriginalDocument(null);
    if (!needsReference || !services || !relatedDocumentId) {
      setOriginalLoading(false);
      return;
    }
    let cancelled = false;
    setOriginalLoading(true);
    void services.getOriginal(companyId, branchId, relatedDocumentId, editing)
      .then(document => {
        if (cancelled) return;
        setOriginalDocument(document);
        if (!editing) setLines(document.lines.map(line => ({
          ...emptyLine(), productId: line.item.productId, sourceLineId: line.lineId,
          title: line.description ?? line.item.productId,
          quantity: String(line.commercialTerms?.quantity ?? 1),
          unitPrice: String(line.commercialTerms?.unitPrice ?? ""),
        })));
      })
      .catch(error => { if (!cancelled) setError(errorMessage(error)); })
      .finally(() => { if (!cancelled) setOriginalLoading(false); });
    return () => { cancelled = true; };
  }, [services, companyId, branchId, relatedDocumentId, needsReference]);

  function updateLine(id: string, changes: Partial<DraftLine>) {
    setLines(current => current.map(line => line.id === id ? { ...line, ...changes } : line));
  }

  function originalAdjustments(line: DraftLine, kind: "discounts" | "charges" | "taxes") {
    const terms = (needsReference ? originalDocument?.lines.find(source => source.lineId === line.sourceLineId) : initialDocument?.lines.find(source => source.lineId === line.lineId))?.commercialTerms;
    if (!terms) return "—";
    if (kind === "taxes") return terms.taxes.map(tax => `${tax.rateBasisPoints / 100}٪`).join(" + ") || "۰";
    return terms[kind].map(value => value.mode === "percent" ? `${value.value / 100}٪` : `${value.value} ریال`).join(" + ") || "۰";
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (submitting.current || !services) return;
    setError("");
    try {
      if (!customer) throw new Error("مشتری را انتخاب کنید.");
      if (!lines.length || lines.some(line => !line.productId || !line.quantity.trim() || !line.unitPrice.trim())) {
        throw new Error("حداقل یک ردیف کامل شامل کالا، تعداد و قیمت واحد وارد کنید.");
      }
      const draft: Omit<SalesDraftInput, "submissionId"> = {
        companyId, branchId, fiscalYearId, documentType, customerId: customer.id,
        businessDate, description,
        relatedDocumentId: needsReference ? relatedDocumentId : "",
        lines: lines.map(line => ({
          lineId: line.lineId, preserveAdjustments: line.preserveAdjustments,
          productId: line.productId, sourceLineId: needsReference ? line.sourceLineId : undefined, quantity: numberValue(line.quantity), unitPrice: numberValue(line.unitPrice),
          discountRateBasisPoints: Math.round(numberValue(line.discountPercent) * 100),
          taxRateBasisPoints: Math.round(numberValue(line.taxPercent) * 100),
        })),
      };
      const fingerprint = JSON.stringify(draft);
      if (submission.current.fingerprint !== fingerprint) submission.current = { fingerprint, id: crypto.randomUUID() };
      submitting.current = true;
      setSaving(true);
      const request = { ...draft, submissionId: submission.current.id };
      const created = initialDocument && expectedVersion
        ? (await services.edit({ ...request, documentId: initialDocument.documentId, expectedVersion })).document
        : await services.create(request);
      if (mounted.current) onCreated(created);
    } catch (error) {
      if (mounted.current) setError(errorMessage(error));
    } finally {
      submitting.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  return (
    <dialog ref={dialog} className="sales-document-form" dir="rtl" aria-labelledby="sales-form-title"
      onCancel={event => { event.preventDefault(); if (!submitting.current) onClose(); }}>
      <form onSubmit={save}>
        <h2 id="sales-form-title">{editing ? "ویرایش سند فروش" : "سند فروش جدید"}</h2>
        {error && <div role="alert"><Feedback tone="error">{error}</Feedback></div>}
        {loading && <p role="status">در حال بارگذاری مشتریان و کالاها…</p>}
        {!loading && !services && <button type="button" onClick={() => setLoadRevision(value => value + 1)}>تلاش دوباره</button>}
        <fieldset disabled={loading || saving || !services}>
          <div className="sales-document-form__header">
            <label>نوع سند
              <select disabled={editing} value={documentType} onChange={event => { setDocumentType(event.target.value as SalesDocumentType); setLines([emptyLine()]); setRelatedDocumentId(""); }}>
                <option value="sales-invoice">فاکتور فروش</option>
                <option value="sales-order">سفارش فروش</option>
                <option value="sales-return">برگشت از فروش</option>
                <option value="sales-correction">اصلاح فروش</option>
              </select>
            </label>
            <label>تاریخ سند (شمسی)
              <PersianDatePicker value={businessDate} onChange={setBusinessDate} disabled={saving} ariaLabel="تاریخ سند فروش" />
            </label>
            <SearchableDropdown
              label="مشتری"
              placeholder="نام یا کد مشتری را جست‌وجو کنید…"
              emptyText="مشتری فعالی یافت نشد."
              disabled={editing && needsReference}
              required
              value={customer ? { id: customer.id, label: `${customer.code} — ${customer.displayName}`, meta: customer.displayName } : null}
              search={customerSearch}
              options={customers.map(value => ({ id: value.id, label: `${value.code} — ${value.displayName}`, meta: value.displayName }))}
              onSearchChange={setCustomerSearch}
              onChange={option => {
                const selected = option ? customers.find(value => value.id === option.id) : null;
                setCustomer(selected ? { id: selected.id, code: selected.code, displayName: selected.displayName } : null);
                setRelatedDocumentId("");
                if (needsReference) setLines([emptyLine()]);
              }}
            />
          </div>
          {!loading && services && !customer && !customerSearch.trim() && customers.length === 0 && <p>مشتری فعالی پیدا نشد؛ در بخش اشخاص، نقش «مشتری» را بررسی کنید.</p>}
          {needsReference && <label>فاکتور اصلی (قطعی)
            <select disabled={editing} value={relatedDocumentId} onChange={event => setRelatedDocumentId(event.target.value)} required>
              <option value="">انتخاب فاکتور همین مشتری</option>
              {originals.map(value => <option key={value.id} value={value.id}>{value.document_number ?? "بدون شماره"} — {gregorianToJalali(value.business_date)}</option>)}
            </select>
          </label>}
          <label>{needsReference ? "علت برگشت یا اصلاح" : "توضیحات"}
            <textarea value={description} onChange={event => setDescription(event.target.value)} required={needsReference} rows={2} />
          </label>
                    {!needsReference && !loading && services && !itemSearch.trim() && items.length === 0 && <p>کالا یا خدمت فعال و قابل فروش پیدا نشد؛ اطلاعات کالا را بررسی کنید.</p>}
          {needsReference && <p>تخفیف، هزینه و مالیات هر ردیف از فاکتور اصلی حفظ می‌شود.</p>}
          {originalLoading && <p role="status">در حال بارگذاری اقلام فاکتور اصلی…</p>}
          <div className="sales-document-form__lines">
            <table>
              <thead><tr><th>کالا / خدمت</th><th>تعداد (واحد پایه)</th><th>قیمت واحد (ریال)</th><th>{needsReference ? "تخفیف فاکتور اصلی" : "تخفیف ٪"}</th><th>{needsReference ? "مالیات فاکتور اصلی" : "مالیات ٪"}</th><th>عملیات</th></tr></thead>
              <tbody>{lines.map((line, index) => <tr key={line.id}>
                <td>{needsReference ? <select aria-label={`ردیف فاکتور اصلی ${index + 1}`} value={line.sourceLineId ?? ""} required disabled={originalLoading} onChange={event => {
                  const source = originalDocument?.lines.find(value => value.lineId === event.target.value);
                  updateLine(line.id, { sourceLineId: source?.lineId, productId: source?.item.productId ?? "", title: source?.description ?? "", unitPrice: String(source?.commercialTerms?.unitPrice ?? "") });
                }}>
                  <option value="">انتخاب ردیف فاکتور اصلی</option>
                  {originalDocument?.lines.map(source => <option key={source.lineId} value={source.lineId}>{source.position} — {source.description ?? source.item.productId}</option>)}
                </select> : <SearchableDropdown
                  label={`کالا یا خدمت ردیف ${index + 1}`}
                  placeholder="نام یا کد کالا / خدمت…"
                  required
                  value={line.productId ? { id: line.productId, label: line.title || line.productId } : null}
                  search={line.productId ? line.title : (lineSearch[line.id] ?? "")}
                  options={items.map(item => ({ id: item.productId, label: `${item.code} — ${item.title}`, meta: item.kind === "service" ? "خدمت" : "کالا" }))}
                  onSearchChange={value => {
                    setItemSearch(value);
                    setLineSearch(current => ({ ...current, [line.id]: value }));
                    if (line.productId && value !== line.title) updateLine(line.id, { productId: "", title: "" });
                  }}
                  onChange={option => {
                    const item = option ? items.find(value => value.productId === option.id) : null;
                    const title = item ? `${item.code} — ${item.title}` : "";
                    updateLine(line.id, { productId: item?.productId ?? "", title, preserveAdjustments: false });
                    setLineSearch(current => ({ ...current, [line.id]: title }));
                  }}
                />}
                {(needsReference || editing) && <small>هزینه: {originalAdjustments(line, "charges")}</small>}</td>
                <td><input aria-label={`تعداد ردیف ${index + 1}`} dir="ltr" inputMode="decimal" required value={line.quantity} onChange={event => updateLine(line.id, { quantity: event.target.value })} /></td>
                <td><input aria-label={`قیمت واحد ردیف ${index + 1}`} dir="ltr" inputMode="numeric" required value={line.unitPrice} onChange={event => updateLine(line.id, { unitPrice: event.target.value })} /></td>
                <td>{needsReference || line.preserveAdjustments ? originalAdjustments(line, "discounts") : <input aria-label={`درصد تخفیف ردیف ${index + 1}`} dir="ltr" inputMode="decimal" required value={line.discountPercent} onChange={event => updateLine(line.id, { discountPercent: event.target.value })} />}</td>
                <td>{needsReference || line.preserveAdjustments ? originalAdjustments(line, "taxes") : <input aria-label={`درصد مالیات ردیف ${index + 1}`} dir="ltr" inputMode="decimal" required value={line.taxPercent} onChange={event => updateLine(line.id, { taxPercent: event.target.value })} />}</td>
                <td><button type="button" aria-label={`حذف ردیف ${index + 1}`} onClick={() => setLines(current => current.filter(value => value.id !== line.id))}>حذف</button></td>
              </tr>)}</tbody>
            </table>
          </div>
          <button type="button" onClick={() => setLines(current => [...current, emptyLine()])}>افزودن ردیف</button>
        </fieldset>
        <footer>
          <button type="submit" className="primary" disabled={saving || loading || originalLoading || !services}>{saving ? "در حال ذخیره…" : editing ? "ذخیره تغییرات" : "ذخیره پیش‌نویس"}</button>
          <button type="button" disabled={saving} onClick={onClose}>انصراف</button>
        </footer>
      </form>
    </dialog>
  );
}
