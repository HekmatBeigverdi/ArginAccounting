import type {
  InventoryBalanceRow,
  InventoryCursorPage,
  InventoryDocumentDetail,
  InventoryDocumentListItem,
  InventoryKardexEntry,
  InventoryPage,
} from "./inventory-dto.ts";
import type {
  GetInventoryDocumentByNumberQuery,
  GetInventoryDocumentQuery,
  InventoryBalanceQuery,
  InventoryKardexQuery,
  ListInventoryDocumentsQuery,
} from "./inventory-queries.ts";

/** Persistence-neutral read model. Implementations may use optimized projections but remain Company-scoped. */
export interface InventoryQueryReader {
  listDocuments(query: ListInventoryDocumentsQuery): Promise<InventoryPage<InventoryDocumentListItem>>;
  getDocument(query: GetInventoryDocumentQuery): Promise<InventoryDocumentDetail | null>;
  getDocumentByNumber(query: GetInventoryDocumentByNumberQuery): Promise<InventoryDocumentDetail | null>;
  readKardex(query: InventoryKardexQuery): Promise<InventoryCursorPage<InventoryKardexEntry>>;
  readBalances(query: InventoryBalanceQuery): Promise<InventoryCursorPage<InventoryBalanceRow>>;
}
