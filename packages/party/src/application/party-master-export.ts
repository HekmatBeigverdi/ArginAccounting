import type { PartyAuditSink, PartyAuthorizationPolicy } from "./contracts/party-security.ts";
import { partyPermissions } from "./contracts/party-security.ts";
import type { PartyImportContext } from "./party-bulk-transfer.ts";

export interface PartyMasterExportRow {
  readonly id: string;
  readonly code: string;
  readonly classification: "natural-person" | "legal-entity";
  readonly status: "active" | "inactive";
  readonly firstName: string;
  readonly lastName: string;
  readonly legalName: string;
  readonly tradeName: string;
  readonly nationalCode: string;
  readonly nationalId: string;
  readonly registrationNumber: string;
  readonly economicNumber: string;
  readonly legacyEconomicCode: string;
  readonly taxFileNumber: string;
  readonly roles: string;
  readonly phone: string;
  readonly mobile: string;
  readonly email: string;
  readonly addressLine: string;
  readonly postalCode: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}
export interface PartyMasterExportPage { readonly items: readonly PartyMasterExportRow[]; readonly page: number; readonly pageSize: number; readonly totalItems: number; readonly totalPages: number; }
export interface PartyMasterExportReader { listPage(companyId: string, page: number, pageSize: number): Promise<PartyMasterExportPage>; }
export interface PartyMasterExportSink { write(rows: readonly PartyMasterExportRow[]): Promise<void>; }

export class PartyMasterExportService {
  constructor(private readonly reader: PartyMasterExportReader, private readonly authorization: PartyAuthorizationPolicy, private readonly audit: PartyAuditSink) {}
  async export(context: PartyImportContext, sink: PartyMasterExportSink, pageSize = 500): Promise<number> {
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 2000) throw new RangeError("Party export pageSize must be between 1 and 2000.");
    await this.authorization.require({ actorId: context.actorId, companyId: context.companyId, correlationId: context.correlationId, requestId: context.requestId }, partyPermissions.export);
    let page = 1;
    let exported = 0;
    while (true) {
      const result = await this.reader.listPage(context.companyId, page, pageSize);
      if (result.items.length === 0) break;
      await sink.write(result.items);
      exported += result.items.length;
      if (page >= result.totalPages) break;
      page += 1;
    }
    await this.audit.record(Object.freeze({ action: "party.export", actorId: context.actorId, companyId: context.companyId, partyId: null, correlationId: context.correlationId, requestId: context.requestId, occurredAt: context.occurredAt, metadata: Object.freeze({ exportedCount: exported, pageSize, mode: "master-data" }) }));
    return exported;
  }
}
