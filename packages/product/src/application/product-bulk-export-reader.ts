import type {
  ProductBulkExportReader,
} from "./product-bulk-transfer.ts";
import type {
  ProductDto,
  ProductPageDto,
} from "./contracts/product-dto.ts";
import type { ProductReader } from "./contracts/product-reader.ts";

/**
 * Reuses the canonical bounded ProductReader instead of introducing a parallel
 * persistence API for bulk export. Each page is limited by the caller and full
 * Product DTOs are hydrated only for the identifiers in that page.
 */
export class ProductReaderBulkExportAdapter implements ProductBulkExportReader {
  constructor(private readonly reader: ProductReader) {}

  async readPage(
    companyId: string,
    page: number,
    pageSize: number,
  ): Promise<ProductPageDto<ProductDto>> {
    const summaryPage = await this.reader.list({
      filter: { companyId },
      page: { page, pageSize },
      sort: { field: "code", direction: "asc" },
    });

    const products = await Promise.all(
      summaryPage.items.map(async (summary) => {
        const product = await this.reader.getById({
          companyId,
          productId: summary.productId,
        });
        if (!product) {
          throw new Error(`product.export.not-found:${summary.productId}`);
        }
        return product;
      }),
    );

    return Object.freeze({
      items: Object.freeze(products),
      page: summaryPage.page,
      pageSize: summaryPage.pageSize,
      totalItems: summaryPage.totalItems,
      totalPages: summaryPage.totalPages,
    });
  }
}
