import type { CreateInventoryDocumentInput, InventoryDocumentSnapshot } from "../domain/inventory-document.ts";
import { InventoryDraftService } from "./inventory-draft-service.ts";

export interface PreparedInventoryImportDocument {
  readonly importKey: string;
  readonly document: Omit<CreateInventoryDocumentInput, "documentId">;
}

export interface InventoryDraftImportIdentityFactory {
  documentId(batchId: string, importKey: string): string;
}

export interface InventoryDraftImportFailure {
  readonly importKey: string;
  readonly message: string;
}

export interface InventoryDraftImportResult {
  readonly imported: readonly InventoryDocumentSnapshot[];
  readonly replayedCount: number;
  readonly failures: readonly InventoryDraftImportFailure[];
}

const normalize = (value: string, field: string): string => {
  const result = value.trim();
  if (!result) throw new Error(`inventory.import.${field}.required`);
  return result;
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Readonly<Record<string, unknown>>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

/** createdAt is generated presentation/persistence metadata, not import business identity. */
function stableFingerprint(document: CreateInventoryDocumentInput): string {
  const { createdAt: _createdAt, ...businessPayload } = document;
  return JSON.stringify(canonicalize(businessPayload));
}

/**
 * Persists only Draft Inventory documents. Preview/master-data validation happens before this boundary.
 * Identities and request keys are deterministic per file batch + logical document key, so retry after
 * interruption converges on the same Draft rather than duplicating stock documents.
 */
export class InventoryDraftImportService {
  constructor(
    private readonly drafts: InventoryDraftService,
    private readonly identities: InventoryDraftImportIdentityFactory,
  ) {}

  async import(input: {
    readonly companyId: string;
    readonly batchId: string;
    readonly documents: readonly PreparedInventoryImportDocument[];
  }): Promise<InventoryDraftImportResult> {
    const companyId = normalize(input.companyId, "companyId");
    const batchId = normalize(input.batchId, "batchId");
    const seen = new Set<string>();
    const imported: InventoryDocumentSnapshot[] = [];
    const failures: InventoryDraftImportFailure[] = [];
    let replayedCount = 0;

    for (const prepared of input.documents) {
      const importKey = normalize(prepared.importKey, "documentKey");
      if (seen.has(importKey)) {
        failures.push(Object.freeze({ importKey, message: "inventory.import.document-key-duplicate" }));
        continue;
      }
      seen.add(importKey);
      const documentId = this.identities.documentId(batchId, importKey);
      const document: CreateInventoryDocumentInput = Object.freeze({
        ...prepared.document,
        documentId,
        companyId,
      });
      try {
        const result = await this.drafts.create({
          companyId,
          requestKey: `inventory-import:${batchId}:${importKey}`,
          payloadFingerprint: stableFingerprint(document),
          document,
        });
        imported.push(result.document);
        if (result.replayed) replayedCount += 1;
      } catch (error) {
        failures.push(Object.freeze({
          importKey,
          message: error instanceof Error ? error.message : "inventory.import.failed",
        }));
      }
    }

    return Object.freeze({
      imported: Object.freeze(imported),
      replayedCount,
      failures: Object.freeze(failures),
    });
  }
}
