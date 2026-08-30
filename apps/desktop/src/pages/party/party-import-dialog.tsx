import { type ChangeEvent, useMemo, useState } from "react";
import {
  PartyBulkTransferService,
  partyImportFields,
  type PartyAuthorizationPolicy,
  type PartyImportColumnMap,
  type PartyImportField,
  type PartyImportPreview,
  type PartyImportResult,
  type PartyTabularRow,
} from "@argin/party";
import {
  PartyTabularCodecError,
  SqlitePartyDuplicateLookup,
  SqlitePartyReader,
  SqlitePartyUnitOfWork,
  parsePartyCsv,
  parsePartyXlsx,
} from "@argin/party-tauri";
import { getDesktopDatabase } from "@argin/database-tauri";

import { Feedback } from "../../components/feedback";
import { createPersistentPartyAuditSink } from "./party-audit-sink";

import "./party-import-dialog.css";

interface PartyImportDialogProps {
  companyId: string;
  actorId: string;
  authorization: PartyAuthorizationPolicy;
  onClose(): void;
  onImported(): Promise<void> | void;
}

const fieldLabels: Record<PartyImportField, string> = {
  classification: "نوع شخص",
  code: "کد شخص",
  firstName: "نام",
  lastName: "نام خانوادگی",
  legalName: "نام حقوقی",
  tradeName: "نام تجاری",
  nationalCode: "کد ملی",
  nationalId: "شناسه ملی",
  registrationNumber: "شماره ثبت",
  economicNumber: "شماره اقتصادی",
  legacyEconomicCode: "کد اقتصادی قدیم",
  taxFileNumber: "پرونده مالیاتی",
  roles: "نقش‌ها",
  phone: "تلفن",
  mobile: "موبایل",
  email: "ایمیل",
  addressLine: "نشانی",
  postalCode: "کدپستی",
};

const aliases: Record<PartyImportField, readonly string[]> = {
  classification: ["classification", "type", "نوع", "نوع شخص"],
  code: ["code", "partycode", "کد", "کد شخص"],
  firstName: ["firstname", "first name", "نام"],
  lastName: ["lastname", "last name", "نام خانوادگی", "نام‌خانوادگی"],
  legalName: ["legalname", "legal name", "نام حقوقی", "نام شرکت"],
  tradeName: ["tradename", "trade name", "نام تجاری"],
  nationalCode: ["nationalcode", "national code", "کد ملی"],
  nationalId: ["nationalid", "national id", "شناسه ملی"],
  registrationNumber: ["registrationnumber", "registration number", "شماره ثبت"],
  economicNumber: ["economicnumber", "economic number", "شماره اقتصادی", "کد اقتصادی"],
  legacyEconomicCode: ["legacyeconomiccode", "legacy economic code", "کد اقتصادی قدیم"],
  taxFileNumber: ["taxfilenumber", "tax file number", "شماره پرونده مالیاتی", "پرونده مالیاتی"],
  roles: ["roles", "role", "نقش", "نقش‌ها"],
  phone: ["phone", "telephone", "تلفن"],
  mobile: ["mobile", "cellphone", "موبایل"],
  email: ["email", "ایمیل", "پست الکترونیک"],
  addressLine: ["addressline", "address", "نشانی", "آدرس"],
  postalCode: ["postalcode", "postal code", "کدپستی", "کد پستی"],
};

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("fa-IR")
    .replace(/[\s_\-‌]/g, "");
}

function autoMap(headers: readonly string[]): PartyImportColumnMap {
  const normalized = new Map(headers.map((header) => [normalizeHeader(header), header]));
  const mapping: Partial<Record<PartyImportField, string>> = {};
  for (const field of partyImportFields) {
    const match = aliases[field]
      .map(normalizeHeader)
      .map((alias) => normalized.get(alias))
      .find((value): value is string => Boolean(value));
    if (match) mapping[field] = match;
  }
  return mapping;
}

function importErrorMessage(error: unknown): string {
  if (error instanceof PartyTabularCodecError) {
    const messages: Record<string, string> = {
      "party.import.fileTooLarge": "حجم فایل از حد مجاز بیشتر است.",
      "party.import.unreadable": "فایل قابل خواندن نیست.",
      "party.import.rowLimit": "تعداد ردیف‌های فایل از حد مجاز بیشتر است.",
      "party.import.columnLimit": "تعداد ستون‌های فایل از حد مجاز بیشتر است.",
      "party.import.empty": "فایل فاقد داده قابل ورود است.",
    };
    return messages[error.code] ?? error.message;
  }
  return error instanceof Error ? error.message : "خطا در پردازش فایل ورود اشخاص.";
}

export function PartyImportDialog({
  companyId,
  actorId,
  authorization,
  onClose,
  onImported,
}: PartyImportDialogProps) {
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<readonly string[]>([]);
  const [rows, setRows] = useState<readonly PartyTabularRow[]>([]);
  const [mapping, setMapping] = useState<PartyImportColumnMap>({});
  const [preview, setPreview] = useState<PartyImportPreview | null>(null);
  const [result, setResult] = useState<PartyImportResult | null>(null);
  const [atomic, setAtomic] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const mappedCount = useMemo(
    () => Object.values(mapping).filter(Boolean).length,
    [mapping],
  );

  async function createService(): Promise<PartyBulkTransferService> {
    const database = await getDesktopDatabase();
    return new PartyBulkTransferService(
      new SqlitePartyUnitOfWork(database),
      new SqlitePartyDuplicateLookup(database),
      new SqlitePartyReader(database),
      authorization,
      createPersistentPartyAuditSink(database),
      { nextId: () => crypto.randomUUID() },
    );
  }

  function context() {
    return {
      companyId,
      actorId,
      correlationId: crypto.randomUUID(),
      requestId: crypto.randomUUID(),
      occurredAt: new Date().toISOString(),
    } as const;
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError("");
    setPreview(null);
    setResult(null);
    try {
      const extension = file.name.split(".").pop()?.toLocaleLowerCase("en-US");
      const data = extension === "csv"
        ? parsePartyCsv(await file.text())
        : parsePartyXlsx(new Uint8Array(await file.arrayBuffer()));
      setFileName(file.name);
      setHeaders(data.headers);
      setRows(data.rows);
      setMapping(autoMap(data.headers));
    } catch (reason) {
      setFileName("");
      setHeaders([]);
      setRows([]);
      setMapping({});
      setError(importErrorMessage(reason));
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  function changeMapping(field: PartyImportField, column: string): void {
    setPreview(null);
    setResult(null);
    setMapping((current) => {
      const next = { ...current };
      if (column) next[field] = column;
      else delete next[field];
      return next;
    });
  }

  async function previewRows(): Promise<void> {
    if (rows.length === 0) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const service = await createService();
      setPreview(await service.previewImport(rows, mapping, context()));
    } catch (reason) {
      setError(importErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function importRows(): Promise<void> {
    if (rows.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const service = await createService();
      const value = await service.import(rows, mapping, context(), { atomic });
      setResult(value);
      if (value.importedCount > 0) await onImported();
    } catch (reason) {
      setError(importErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="party-dialog-backdrop" role="presentation">
      <section
        className="party-dialog party-import-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="party-import-title"
      >
        <header>
          <div>
            <p className="parties-page__eyebrow">انتقال اطلاعات پایه</p>
            <h2 id="party-import-title">ورود گروهی اشخاص</h2>
            <p>CSV یا XLSX را انتخاب، ستون‌ها را تطبیق و قبل از ثبت پیش‌نمایش کنید.</p>
          </div>
          <button
            className="party-dialog__close"
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="بستن"
          >
            ×
          </button>
        </header>

        <div className="party-import-dialog__body">
          {error && <Feedback tone="error">{error}</Feedback>}
          {result && (
            <Feedback tone={result.failedCount === 0 ? "success" : "warning"}>
              {result.importedCount.toLocaleString("fa-IR")} ردیف وارد شد و {result.failedCount.toLocaleString("fa-IR")} ردیف ناموفق بود.
            </Feedback>
          )}

          <section className="party-import-file">
            <label className="party-button party-button--primary">
              انتخاب فایل CSV / XLSX
              <input
                type="file"
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(event) => void chooseFile(event)}
                disabled={busy}
              />
            </label>
            <div>
              <strong>{fileName || "فایلی انتخاب نشده"}</strong>
              {rows.length > 0 && (
                <span>{rows.length.toLocaleString("fa-IR")} ردیف، {headers.length.toLocaleString("fa-IR")} ستون</span>
              )}
            </div>
          </section>

          {headers.length > 0 && (
            <>
              <section className="party-import-mapping" aria-label="تطبیق ستون‌های فایل">
                <header>
                  <div>
                    <h3>تطبیق ستون‌ها</h3>
                    <span>{mappedCount.toLocaleString("fa-IR")} فیلد تطبیق داده شده است.</span>
                  </div>
                  <small>«نوع شخص» و «کد شخص» برای همه ردیف‌ها ضروری هستند؛ نام‌های لازم بر اساس حقیقی/حقوقی بودن اعتبارسنجی می‌شوند.</small>
                </header>
                <div className="party-import-mapping__grid">
                  {partyImportFields.map((field) => (
                    <label key={field}>
                      <span>{fieldLabels[field]}</span>
                      <select
                        value={mapping[field] ?? ""}
                        onChange={(event) => changeMapping(field, event.target.value)}
                      >
                        <option value="">— بدون ستون —</option>
                        {headers.map((header) => (
                          <option key={header} value={header}>{header}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </section>

              <section className="party-import-actions">
                <label>
                  <input
                    type="checkbox"
                    checked={atomic}
                    onChange={(event) => setAtomic(event.target.checked)}
                  />
                  ورود اتمیک؛ در صورت وجود ردیف نامعتبر هیچ داده‌ای ثبت نشود
                </label>
                <button
                  type="button"
                  className="party-button"
                  onClick={() => void previewRows()}
                  disabled={busy || rows.length === 0}
                >
                  {busy ? "در حال بررسی…" : "پیش‌نمایش و اعتبارسنجی"}
                </button>
                <button
                  type="button"
                  className="party-button party-button--primary"
                  onClick={() => void importRows()}
                  disabled={
                    busy ||
                    preview === null ||
                    preview.validRows === 0 ||
                    (atomic && preview.invalidRows > 0)
                  }
                >
                  اجرای ورود
                </button>
              </section>
            </>
          )}

          {preview && (
            <section className="party-import-preview" aria-live="polite">
              <header>
                <strong>پیش‌نمایش</strong>
                <span>کل: {preview.totalRows.toLocaleString("fa-IR")}</span>
                <span className="party-import-preview__valid">معتبر: {preview.validRows.toLocaleString("fa-IR")}</span>
                <span className="party-import-preview__invalid">نامعتبر: {preview.invalidRows.toLocaleString("fa-IR")}</span>
              </header>
              <div className="party-table-wrap">
                <table className="party-table">
                  <thead>
                    <tr>
                      <th>ردیف</th>
                      <th>کد</th>
                      <th>نام / عنوان</th>
                      <th>نتیجه</th>
                      <th>تشخیص</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.slice(0, 100).map((row) => (
                      <tr key={row.rowNumber}>
                        <td>{row.rowNumber.toLocaleString("fa-IR")}</td>
                        <td>{row.code ?? "—"}</td>
                        <td>{row.displayName ?? "—"}</td>
                        <td>{row.valid ? "معتبر" : "نامعتبر"}</td>
                        <td className="party-import-preview__issues">
                          {row.issues.length > 0
                            ? row.issues.map((issue) => issue.message).join("؛ ")
                            : row.hardDuplicatePartyIds.length > 0
                              ? "تکرار قطعی"
                              : row.advisoryDuplicatePartyIds.length > 0
                                ? `${row.advisoryDuplicatePartyIds.length.toLocaleString("fa-IR")} مورد مشابه`
                                : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.rows.length > 100 && (
                <small>برای حفظ کارایی، فقط ۱۰۰ ردیف نخست در جدول پیش‌نمایش نمایش داده می‌شود؛ اعتبارسنجی روی کل فایل انجام شده است.</small>
              )}
            </section>
          )}
        </div>

        <footer className="party-dialog__footer">
          <button className="party-button" type="button" onClick={onClose} disabled={busy}>
            بستن
          </button>
        </footer>
      </section>
    </div>
  );
}
