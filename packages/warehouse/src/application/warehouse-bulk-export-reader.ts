import type { WarehouseBulkExportReader } from "./warehouse-bulk-transfer.ts";
import type { WarehouseDto, WarehousePageDto } from "./contracts/warehouse-dto.ts";
import type { WarehouseReader } from "./contracts/warehouse-reader.ts";

export class WarehouseReaderBulkExportAdapter implements WarehouseBulkExportReader {
  constructor(private readonly reader: WarehouseReader) {}

  async readPage(
    companyId: string,
    page: number,
    pageSize: number,
  ): Promise<WarehousePageDto<WarehouseDto>> {
    const listed = await this.reader.list({
      filter: { companyId },
      page: { page, pageSize },
      sort: { field: "code", direction: "asc" },
    });

    const details = await Promise.all(
      listed.items.map((item) => this.reader.getById({ companyId, warehouseId: item.warehouseId })),
    );

    const items = Object.freeze(
      details.filter((item): item is WarehouseDto => item !== null),
    );

    return Object.freeze({
      items,
      page: listed.page,
      pageSize: listed.pageSize,
      totalCount: listed.totalCount,
    });
  }
}
