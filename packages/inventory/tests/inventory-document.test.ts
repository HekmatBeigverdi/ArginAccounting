import assert from "node:assert/strict";
import test from "node:test";
import {
  INVENTORY_DOCUMENT_TYPES,
  INVENTORY_DOMAIN_ERROR_CODES as codes,
  InventoryDomainError,
  createInventoryDocument,
  createInventoryDocumentLine,
  createInventorySourceReference,
  rehydrateInventoryDocument,
} from "../src/index.ts";
import type {
  CreateInventoryDocumentInput,
  CreateInventoryDocumentLineInput,
  InventoryDomainErrorCode,
} from "../src/index.ts";

const base: CreateInventoryDocumentInput = {
  documentId: "doc-01",
  companyId: "company-01",
  documentType: "receipt",
  businessDate: "2026-09-01",
  createdAt: "2026-09-06T12:34:56Z",
};
const line: CreateInventoryDocumentLineInput = { lineId: "line-01", position: 1, productId: "product-01" };
const source = { companyId: "company-01", sourceSystem: "purchases", documentType: "goods-receipt", documentId: "purchase-01", lineId: "purchase-line-01" };

function rejects(action: () => unknown, code: InventoryDomainErrorCode): void {
  assert.throws(action, (error: unknown) => error instanceof InventoryDomainError && error.code === code);
}

test("creates every fixed document type as a draft without allocating a number", () => {
  assert.deepEqual(INVENTORY_DOCUMENT_TYPES, ["receipt", "issue", "opening", "transfer", "adjustment"]);
  for (const documentType of INVENTORY_DOCUMENT_TYPES) {
    const document = createInventoryDocument({ ...base, documentType });
    assert.equal(document.documentType, documentType);
    assert.equal(document.status, "draft");
    assert.equal(document.version, 1);
    assert.equal(document.documentNumber, null);
    assert.deepEqual(document.lines, []);
    assert.equal(document.sourceReference, null);
    assert.equal(document.description, null);
  }
});

test("preserves durable identity separately from business numbering and source identity", () => {
  const document = createInventoryDocument({ ...base, documentId: " AbC-001 ", documentNumber: " 00012 ", sourceReference: source });
  assert.equal(document.documentId, "AbC-001");
  assert.equal(document.documentNumber, "00012");
  assert.equal(document.sourceReference?.documentId, "purchase-01");
  assert.equal(document.sourceReference?.lineId, "purchase-line-01");
});

test("keeps business date independent of recording time and canonicalizes UTC", () => {
  const document = createInventoryDocument(base);
  assert.equal(document.businessDate, "2026-09-01");
  assert.equal(document.createdAt, "2026-09-06T12:34:56.000Z");
  assert.equal(document.updatedAt, document.createdAt);
  assert.equal(createInventoryDocument({ ...base, createdAt: "2026-09-06T12:34:56.1Z" }).createdAt, "2026-09-06T12:34:56.100Z");
});

test("validates Gregorian calendar days, including century leap-year rules", () => {
  for (const businessDate of ["2024-02-29", "2000-02-29", "2026-12-31"]) {
    assert.equal(createInventoryDocument({ ...base, businessDate }).businessDate, businessDate);
  }
  for (const businessDate of ["2026-02-29", "1900-02-29", "2026-04-31", "2026-13-01", "2026-00-01", "2026-01-00", "0000-01-01", "2026-9-1", "۱۴۰۵/۰۶/۱۰", "2026-09-01T00:00:00Z"]) {
    rejects(() => createInventoryDocument({ ...base, businessDate }), codes.businessDateInvalid);
  }
});

test("rejects invalid or timezone-ambiguous recording timestamps", () => {
  for (const createdAt of ["invalid", "2026-09-01", "2026-09-01T00:00:00", "2026-09-01T00:00:00+03:30", "2026-02-30T00:00:00Z", "2026-09-01T24:00:00Z", "2026-09-01T00:60:00Z", "2026-09-01T00:00:60Z"]) {
    rejects(() => createInventoryDocument({ ...base, createdAt }), codes.timestampInvalid);
  }
});

test("rejects empty durable header and line identities with typed field errors", () => {
  for (const field of ["documentId", "companyId"] as const) {
    assert.throws(() => createInventoryDocument({ ...base, [field]: " " }), (error: unknown) => error instanceof InventoryDomainError && error.code === codes.identityRequired && error.field === field);
  }
  rejects(() => createInventoryDocumentLine({ ...line, lineId: " " }), codes.identityRequired);
  rejects(() => createInventoryDocumentLine({ ...line, productId: " " }), codes.identityRequired);
});

test("rejects unknown document types instead of silently treating them as receipts", () => {
  rejects(() => createInventoryDocument({ ...base, documentType: "purchase" as never }), codes.documentTypeInvalid);
});

test("sorts line display positions without deriving or changing durable line IDs", () => {
  const inputs = [{ ...line, lineId: "first", position: 20 }, { ...line, lineId: "second", position: 10 }];
  const document = createInventoryDocument({ ...base, lines: inputs });
  assert.deepEqual(document.lines.map((item) => item.lineId), ["second", "first"]);
  assert.deepEqual(inputs.map((item) => item.lineId), ["first", "second"]);
  assert.deepEqual(document.lines.map((item) => item.position), [10, 20]);
});

test("allows repeated products on separate durable lines", () => {
  const document = createInventoryDocument({ ...base, lines: [line, { ...line, lineId: "line-02", position: 2 }] });
  assert.equal(document.lines.length, 2);
  assert.equal(document.lines[0]?.productId, document.lines[1]?.productId);
});

test("rejects duplicate normalized line IDs and duplicate display positions", () => {
  rejects(() => createInventoryDocument({ ...base, lines: [line, { ...line, lineId: " line-01 ", position: 2 }] }), codes.duplicateLineId);
  rejects(() => createInventoryDocument({ ...base, lines: [line, { ...line, lineId: "line-02" }] }), codes.duplicateLinePosition);
});

test("rejects invalid line positions", () => {
  for (const position of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    rejects(() => createInventoryDocumentLine({ ...line, position }), codes.linePositionInvalid);
  }
});

test("copies and freezes all nested caller-owned structures", () => {
  const sourceInput = { ...source };
  const lineInput = { ...line, sourceReference: sourceInput };
  const linesInput = [lineInput];
  const document = createInventoryDocument({ ...base, lines: linesInput, sourceReference: sourceInput });
  sourceInput.documentId = "changed-source";
  lineInput.productId = "changed-product";
  linesInput.length = 0;
  assert.equal(document.sourceReference?.documentId, "purchase-01");
  assert.equal(document.lines[0]?.productId, "product-01");
  assert.equal(document.lines[0]?.sourceReference?.documentId, "purchase-01");
  for (const value of [document, document.lines, document.lines[0], document.sourceReference, document.lines[0]?.sourceReference]) {
    assert.equal(Object.isFrozen(value), true);
  }
  assert.equal(Reflect.set(document.lines[0]!, "productId", "other"), false);
});

test("source factory supports document-level references and rejects partial identities", () => {
  assert.deepEqual(createInventorySourceReference({ ...source, lineId: null }), { ...source, lineId: null });
  const { lineId: ignored, ...headerSource } = source;
  assert.equal(createInventorySourceReference(headerSource).lineId, null);
  for (const field of ["companyId", "sourceSystem", "documentType", "documentId", "lineId"] as const) {
    rejects(() => createInventorySourceReference({ ...source, [field]: " " }), codes.identityRequired);
  }
});

test("rejects cross-company source references on both header and lines", () => {
  const foreignSource = { ...source, companyId: "another-company" };
  rejects(() => createInventoryDocument({ ...base, sourceReference: foreignSource }), codes.sourceCompanyMismatch);
  rejects(() => createInventoryDocument({ ...base, lines: [{ ...line, sourceReference: foreignSource }] }), codes.sourceCompanyMismatch);
});

test("rejects self-sourcing within Inventory but keeps different source namespaces distinct", () => {
  const self = { ...source, sourceSystem: "inventory", documentType: "receipt", documentId: base.documentId };
  rejects(() => createInventoryDocument({ ...base, sourceReference: self }), codes.sourceSelfReference);
  rejects(() => createInventoryDocument({ ...base, lines: [{ ...line, sourceReference: self }] }), codes.sourceSelfReference);
  assert.equal(createInventoryDocument({ ...base, sourceReference: { ...self, sourceSystem: "purchases" } }).sourceReference?.documentId, base.documentId);
});

test("rehydrates a serialized draft without replacing IDs or resetting version/timestamps", () => {
  const document = createInventoryDocument({ ...base, lines: [{ ...line, sourceReference: source }], sourceReference: source });
  const persisted = { ...document, version: 7, updatedAt: "2026-09-07T00:00:00.000Z" };
  const restored = rehydrateInventoryDocument(JSON.parse(JSON.stringify(persisted)));
  assert.deepEqual(restored, persisted);
  assert.notEqual(restored.lines, persisted.lines);
  assert.equal(Object.isFrozen(restored.lines[0]?.sourceReference), true);
});

test("rehydration rejects invalid version, timestamp order and unsupported lifecycle states", () => {
  const document = createInventoryDocument(base);
  for (const version of [0, -1, 1.1, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) {
    rejects(() => rehydrateInventoryDocument({ ...document, version }), codes.versionInvalid);
  }
  rejects(() => rehydrateInventoryDocument({ ...document, updatedAt: "2026-09-05T00:00:00Z" }), codes.timestampOrderInvalid);
  rejects(() => rehydrateInventoryDocument({ ...document, updatedAt: "invalid" }), codes.timestampInvalid);
  for (const status of ["confirmed", "approved", "deleted"]) {
    rejects(() => rehydrateInventoryDocument({ ...document, status: status as never }), codes.statusInvalid);
  }
});

test("rehydration applies line and source invariants to persisted data", () => {
  const document = createInventoryDocument({ ...base, lines: [line] });
  rejects(() => rehydrateInventoryDocument({ ...document, lines: [document.lines[0]!, document.lines[0]!] }), codes.duplicateLineId);
  rejects(() => rehydrateInventoryDocument({ ...document, sourceReference: { ...source, companyId: "other" } }), codes.sourceCompanyMismatch);
});

test("malformed runtime input produces domain errors rather than accidental TypeErrors", () => {
  rejects(() => createInventoryDocument(null as never), codes.inputInvalid);
  rejects(() => createInventoryDocumentLine(null as never), codes.inputInvalid);
  rejects(() => createInventorySourceReference(null as never), codes.inputInvalid);
  rejects(() => createInventoryDocument({ ...base, documentId: 42 as never }), codes.identityRequired);
  rejects(() => createInventoryDocument({ ...base, description: 42 as never }), codes.inputInvalid);
  rejects(() => createInventoryDocument({ ...base, lines: null as never }), codes.linesInvalid);
  rejects(() => createInventoryDocument({ ...base, lines: [null as never] }), codes.inputInvalid);
  rejects(() => createInventoryDocument({ ...base, lines: Array(1) }), codes.inputInvalid);
  rejects(() => rehydrateInventoryDocument({ ...createInventoryDocument(base), lines: undefined as never }), codes.linesInvalid);
});

test("normalizes optional text without accepting display numbers as numeric identities", () => {
  const document = createInventoryDocument({ ...base, description: "  ", documentNumber: " " });
  assert.equal(document.description, null);
  assert.equal(document.documentNumber, null);
  assert.equal(createInventoryDocumentLine({ ...line, description: " note " }).description, "note");
  rejects(() => createInventoryDocument({ ...base, documentNumber: 12 as never }), codes.inputInvalid);
});
