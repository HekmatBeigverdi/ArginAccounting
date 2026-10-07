import type { DatabaseExecutor, DatabaseSession } from "@argin/database";
import { SqliteJournalVoucherRepository } from "@argin/accounting-tauri";
import { SqliteSalesDocumentRepository } from "@argin/sales-tauri";
import {
  calculateSalesDocumentTotals,
  createSalesCommercialSnapshot,
  type SalesCommercialSnapshot,
} from "@argin/sales";
import {
  SALES_POSTING_DOMAIN_ERROR_CODES,
  calculateSalesCommercialPosting,
  calculateSalesCostPosting,
  createSalesAccountsReceivableAccountRule,
  createSalesCogsAccountRule,
  createSalesInventoryAccountRule,
  createSalesOutputVatAccountRule,
  createSalesPosting,
  createSalesPostingJournalDraft,
  createSalesPostingSourceIdentity,
  createSalesRevenueAccountRule,
  resolveSalesAccountsReceivableAccount,
  resolveSalesCogsAccount,
  resolveSalesInventoryAccount,
  resolveSalesOutputVatAccount,
  resolveSalesRevenueAccount,
  salesJournalComponentsFromInvoice,
  type SalesPostingRecoverySnapshot,
  type SalesPostingTraceSnapshot,
} from "@argin/sales-posting";

export interface SalesPostingWorkspaceActor {
  readonly permissions: readonly string[];
  readonly branchIds: readonly string[];
}

export interface SalesPostingWorkspaceServices {
  readonly canView: boolean;
  readonly canExecute: boolean;
  readonly canRecover: boolean;
  readonly canTrace: boolean;
  evaluateAndPost(input: {
    readonly companyId: string;
    readonly branchId: string;
    readonly sourceId: string;
  }): Promise<SalesPostingRecoverySnapshot>;
  getRecovery(input: {
    readonly companyId: string;
    readonly branchId: string;
    readonly sourceId: string;
  }): Promise<SalesPostingRecoverySnapshot | null>;
  getTrace(input: {
    readonly companyId: string;
    readonly branchId: string;
    readonly sourceId: string;
  }): Promise<SalesPostingTraceSnapshot | null>;
}

type AccountRow = {
  id: string;
  company_id: string;
  code: string;
  name: string;
  status: "active" | "inactive";
  posting_allowed: number;
};

type RuleRow = {
  rule_id: string;
  company_id: string;
  branch_id: string | null;
  account_role: "accounts-receivable" | "sales-revenue" | "output-vat" | "cogs" | "inventory-asset";
  line_kind: "stock-product" | "non-stock-product" | "service" | null;
  tax_code: string | null;
  account_id: string;
  priority: number;
  active: number;
};

type IssueRow = {
  id: string;
  company_id: string;
  status: string;
  fiscal_period_id: string;
  version: number;
  updated_at: string;
};

type IssueLineRow = {
  id: string;
  product_id: string;
  source_line_id: string | null;
  warehouse_id: string | null;
};

type MovementValuationRow = {
  movement_id: string;
  line_id: string;
  product_id: string;
  warehouse_id: string;
  business_date: string;
  business_order: number;
  recorded_at: string;
  quantity_delta: string;
  valuation_entry_id: string | null;
  method: "fifo" | "moving_average" | null;
  strategy_version: number | null;
  currency: string | null;
  quantity: string | null;
  unit_cost: string | null;
  total_cost: number | null;
  cost_state: "resolved" | "unresolved" | null;
  unresolved_reason: string | null;
  valued_at: string | null;
  revision: number | null;
};

type PostingRow = {
  posting_id: string;
  company_id: string;
  branch_id: string;
  source_type: "sales-invoice" | "sales-return" | "sales-correction";
  source_document_id: string;
  source_version: number;
  journal_voucher_id: string | null;
  status: "pending" | "ready" | "committed" | "blocked";
  pending_reason: string | null;
  last_error_code: string | null;
  version: number;
};

const PERMISSIONS = {
  view: "sales.posting.view",
  execute: "sales.posting.execute",
  recover: "sales.posting.recover",
  trace: "sales.posting.trace.view",
} as const;

const postingIdFor = (sourceId: string, sourceVersion: number) =>
  `sales-posting:${sourceId}:v${sourceVersion}`;
const journalIdFor = (sourceId: string, sourceVersion: number) =>
  `sales-journal:${sourceId}:v${sourceVersion}`;

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

function recoveryFromRow(row: PostingRow): SalesPostingRecoverySnapshot {
  const committed = row.status === "committed";
  const blocked = row.status === "blocked";
  const pending = row.status === "pending";
  return Object.freeze({
    status: row.status,
    retryAction: committed ? "replay" : blocked ? "manual-review" : pending ? "wait" : "retry",
    reason: row.pending_reason ?? row.last_error_code,
    waitingLineIds: Object.freeze([]),
    journalVoucherId: row.journal_voucher_id,
    committedPostingVersion: committed ? row.version : null,
  });
}

async function accountSnapshot(session: DatabaseSession, companyId: string, accountId: string) {
  const row = await session.queryOne<AccountRow>(
    "SELECT id,company_id,code,name,status,posting_allowed FROM accounts WHERE company_id=? AND id=?",
    [companyId, accountId],
  );
  return row ? Object.freeze({
    accountId: row.id,
    companyId: row.company_id,
    code: row.code,
    name: row.name,
    status: row.status,
    postingAllowed: row.posting_allowed === 1,
  }) : null;
}

async function findBuiltInAccount(
  session: DatabaseSession,
  companyId: string,
  logicalKeys: readonly string[],
): Promise<string | null> {
  for (const logicalKey of logicalKeys) {
    const row = await session.queryOne<{ id: string }>(
      `SELECT id FROM accounts
        WHERE company_id=? AND status='active' AND posting_allowed=1
          AND source_type='coding_template' AND source_reference_id LIKE ?
        ORDER BY code,id LIMIT 1`,
      [companyId, `%:${logicalKey}`],
    );
    if (row) return row.id;
  }
  return null;
}

async function ensureRule(session: DatabaseSession, args: {
  companyId: string;
  role: RuleRow["account_role"];
  lineKind?: RuleRow["line_kind"];
  taxCode?: string | null;
  logicalKeys: readonly string[];
  now: string;
}): Promise<void> {
  const existing = await session.queryOne<{ rule_id: string }>(
    `SELECT rule_id FROM sales_posting_rules
      WHERE company_id=? AND account_role=? AND active=1
        AND branch_id IS NULL
        AND ((line_kind IS NULL AND ? IS NULL) OR line_kind=?)
        AND ((tax_code IS NULL AND ? IS NULL) OR tax_code=?)
      ORDER BY priority DESC,rule_id LIMIT 1`,
    [
      args.companyId, args.role,
      args.lineKind ?? null, args.lineKind ?? null,
      args.taxCode ?? null, args.taxCode ?? null,
    ],
  );
  if (existing) return;

  const accountId = await findBuiltInAccount(session, args.companyId, args.logicalKeys);
  if (!accountId) return;

  await session.execute(
    `INSERT INTO sales_posting_rules(
       rule_id,company_id,branch_id,account_role,line_kind,tax_code,account_id,
       priority,active,version,created_at,updated_at
     ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      `auto:${args.companyId}:${args.role}:${args.lineKind ?? "all"}:${args.taxCode ?? "all"}`,
      args.companyId, null, args.role, args.lineKind ?? null,
      args.taxCode ?? null, accountId, 100, 1, 1, args.now, args.now,
    ],
  );
}

async function bootstrapRules(
  session: DatabaseSession,
  companyId: string,
  snapshots: readonly SalesCommercialSnapshot[],
  now: string,
): Promise<void> {
  await ensureRule(session, {
    companyId,
    role: "accounts-receivable",
    logicalKeys: ["assets.current.receivables"],
    now,
  });
  for (const snapshot of snapshots) {
    await ensureRule(session, {
      companyId,
      role: "sales-revenue",
      lineKind: snapshot.lineKind,
      logicalKeys: snapshot.lineKind === "service"
        ? ["revenue.operating.services", "revenue.operating.goods", "revenue.operating.products"]
        : ["revenue.operating.goods", "revenue.operating.products", "revenue.operating.services"],
      now,
    });
    for (const tax of snapshot.terms.taxes) {
      await ensureRule(session, {
        companyId,
        role: "output-vat",
        taxCode: tax.taxCode?.toUpperCase() ?? null,
        logicalKeys: ["liabilities.current.taxes"],
        now,
      });
    }
  }
  if (snapshots.some(snapshot => snapshot.lineKind === "stock-product")) {
    await ensureRule(session, {
      companyId,
      role: "cogs",
      logicalKeys: ["costs.merchandise.sold", "costs.manufacturing.goods-sold"],
      now,
    });
    await ensureRule(session, {
      companyId,
      role: "inventory-asset",
      logicalKeys: ["assets.current.inventory", "assets.current.finished-goods", "assets.current.raw-materials"],
      now,
    });
  }
}

async function listRules(session: DatabaseSession, companyId: string): Promise<RuleRow[]> {
  return session.query<RuleRow>(
    `SELECT rule_id,company_id,branch_id,account_role,line_kind,tax_code,account_id,priority,active
       FROM sales_posting_rules
      WHERE company_id=? AND active=1
      ORDER BY priority DESC,rule_id`,
    [companyId],
  );
}

async function upsertPostingStatus(session: DatabaseSession, args: {
  postingId: string;
  companyId: string;
  branchId: string;
  sourceId: string;
  sourceVersion: number;
  status: PostingRow["status"];
  reason?: string | null;
  errorCode?: string | null;
  now: string;
}): Promise<void> {
  const existing = await session.queryOne<{ posting_id: string }>(
    "SELECT posting_id FROM sales_postings WHERE posting_id=?",
    [args.postingId],
  );
  if (!existing) {
    await session.execute(
      `INSERT INTO sales_postings(
        posting_id,company_id,branch_id,source_type,source_document_id,source_version,
        journal_voucher_id,status,pending_reason,last_error_code,version,
        created_at,updated_at,sync_origin,sync_changed_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        args.postingId,args.companyId,args.branchId,"sales-invoice",args.sourceId,args.sourceVersion,
        null,args.status,args.reason ?? null,args.errorCode ?? null,1,
        args.now,args.now,"local",args.now,
      ],
    );
  } else {
    await session.execute(
      `UPDATE sales_postings SET status=?,pending_reason=?,last_error_code=?,
         updated_at=?,sync_changed_at=?
       WHERE posting_id=? AND status<>'committed'`,
      [args.status,args.reason ?? null,args.errorCode ?? null,args.now,args.now,args.postingId],
    );
  }
}

export function createSalesPostingWorkspaceServices(input: {
  readonly database: DatabaseExecutor;
  readonly actor: SalesPostingWorkspaceActor;
}): SalesPostingWorkspaceServices {
  const permissions = new Set(input.actor.permissions);
  const branchIds = new Set(input.actor.branchIds);
  const can = (permission: string) =>
    permissions.has("system.full-access") || permissions.has(permission);
  const requireBranch = (branchId: string) => {
    if (!permissions.has("system.full-access") && !branchIds.has(branchId)) {
      throw new Error("برای ثبت حسابداری فروش این شعبه مجوز ندارید.");
    }
  };

  const getPostingRow = async (companyId: string, sourceId: string) =>
    input.database.queryOne<PostingRow>(
      `SELECT posting_id,company_id,branch_id,source_type,source_document_id,source_version,
              journal_voucher_id,status,pending_reason,last_error_code,version
         FROM sales_postings
        WHERE company_id=? AND source_document_id=?
        ORDER BY source_version DESC LIMIT 1`,
      [companyId, sourceId],
    );

  return Object.freeze({
    canView: can(PERMISSIONS.view),
    canExecute: can(PERMISSIONS.execute),
    canRecover: can(PERMISSIONS.recover),
    canTrace: can(PERMISSIONS.trace),

    async getRecovery({ companyId, branchId, sourceId }) {
      if (!can(PERMISSIONS.view)) return null;
      requireBranch(branchId);
      const row = await getPostingRow(companyId, sourceId);
      if (!row || row.branch_id !== branchId) return null;
      return recoveryFromRow(row);
    },

    async getTrace({ companyId, branchId, sourceId }) {
      if (!can(PERMISSIONS.trace)) return null;
      requireBranch(branchId);
      const row = await getPostingRow(companyId, sourceId);
      if (!row || row.branch_id !== branchId) return null;
      return Object.freeze({
        companyId,
        branchId,
        postingId: row.posting_id,
        postingVersion: row.version,
        source: createSalesPostingSourceIdentity({
          sourceSystem: "sales",
          sourceType: row.source_type,
          sourceDocumentId: row.source_document_id,
          sourceVersion: row.source_version,
          externalReference: null,
        }),
        journalVoucherId: row.journal_voucher_id,
        requestId: `sales-post:${row.source_document_id}:v${row.source_version}`,
        operationId: `sales-post:${row.source_document_id}:v${row.source_version}:operation`,
        correlationId: row.posting_id,
        causationId: null,
        recovery: recoveryFromRow(row),
      });
    },

    async evaluateAndPost({ companyId, branchId, sourceId }) {
      if (!can(PERMISSIONS.execute)) {
        throw new Error("برای ایجاد ثبت حسابداری فروش مجوز ندارید.");
      }
      requireBranch(branchId);

      try {
        return await input.database.transaction(async session => {
          const salesRepository = new SqliteSalesDocumentRepository(session);
          const persisted = await salesRepository.findById(companyId, sourceId);
          if (!persisted || persisted.document.scope.branchId !== branchId) {
            throw new Error("فاکتور فروش در شعبه فعال یافت نشد.");
          }
          if (
            persisted.document.documentType !== "sales-invoice"
            || persisted.lifecycle.status !== "finalized"
          ) {
            throw new Error("ثبت حسابداری خودکار فقط برای فاکتور فروش قطعی اجرا می‌شود.");
          }

          const source = createSalesPostingSourceIdentity({
            sourceSystem: "sales",
            sourceType: "sales-invoice",
            sourceDocumentId: sourceId,
            sourceVersion: persisted.version,
            externalReference: null,
          });
          const postingId = postingIdFor(sourceId, persisted.version);
          const existing = await session.queryOne<PostingRow>(
            `SELECT posting_id,company_id,branch_id,source_type,source_document_id,source_version,
                    journal_voucher_id,status,pending_reason,last_error_code,version
               FROM sales_postings WHERE posting_id=?`,
            [postingId],
          );
          if (existing?.status === "committed") return recoveryFromRow(existing);

          const snapshots = persisted.document.lines.map(line =>
            createSalesCommercialSnapshot({
              snapshotId: `${sourceId}:${line.lineId}:commercial:v${persisted.version}`,
              line,
              capturedAt: persisted.updatedAt,
            }),
          );
          const documentTotals = calculateSalesDocumentTotals(snapshots.map(item => item.totals));
          const commercial = {
            source,
            companyId,
            branchId,
            fiscalYearId: persisted.document.scope.fiscalYearId,
            customerPartyId: persisted.document.customer.partyId,
            businessDate: persisted.document.businessDate,
            currency: documentTotals.currency,
            documentTotals,
            lines: snapshots.map(snapshot => ({
              snapshotId: snapshot.snapshotId,
              lineId: snapshot.lineId,
              productId: snapshot.productId,
              lineKind: snapshot.lineKind,
              capturedAt: snapshot.capturedAt,
              terms: snapshot.terms,
              totals: snapshot.totals,
            })),
          } as const;

          const now = new Date().toISOString();
          const stockLines = commercial.lines.filter(line => line.lineKind === "stock-product");
          let fiscalPeriodId = await session.queryOne<{ id: string }>(
            `SELECT id FROM fiscal_periods
              WHERE fiscal_year_id=? AND start_date<=? AND end_date>=?
              ORDER BY sequence LIMIT 1`,
            [commercial.fiscalYearId,commercial.businessDate,commercial.businessDate],
          ).then(row => row?.id ?? null);

          const valuationLines: Array<{
            salesLineId: string; productId: string; movementId: string;
            valuationEntryId: string; method: "fifo" | "moving_average";
            strategyVersion: number; currency: string; quantity: string;
            unitCost: string; totalCost: number; valuedAt: string; revision: number;
            warehouseId: string;
          }> = [];

          if (stockLines.length > 0) {
            const issue = await session.queryOne<IssueRow>(
              `SELECT id,company_id,status,fiscal_period_id,version,updated_at
                 FROM inventory_documents
                WHERE company_id=? AND source_system='sales'
                  AND source_document_type='sales-invoice'
                  AND source_document_id=? AND document_type='issue'
                  AND deleted_at IS NULL
                ORDER BY created_at DESC LIMIT 1`,
              [companyId, sourceId],
            );
            if (!issue) {
              await upsertPostingStatus(session,{postingId,companyId,branchId,sourceId,sourceVersion:persisted.version,status:"pending",reason:"waiting-for-issue",now});
              return Object.freeze({status:"pending",retryAction:"wait",reason:"waiting-for-issue",waitingLineIds:Object.freeze(stockLines.map(x=>x.lineId)),journalVoucherId:null,committedPostingVersion:null});
            }
            if (issue.status !== "confirmed") {
              await upsertPostingStatus(session,{postingId,companyId,branchId,sourceId,sourceVersion:persisted.version,status:"pending",reason:"waiting-for-confirmation",now});
              return Object.freeze({status:"pending",retryAction:"wait",reason:"waiting-for-confirmation",waitingLineIds:Object.freeze(stockLines.map(x=>x.lineId)),journalVoucherId:null,committedPostingVersion:null});
            }
            fiscalPeriodId = issue.fiscal_period_id;
            const issueLines = await session.query<IssueLineRow>(
              `SELECT id,product_id,source_line_id,warehouse_id
                 FROM inventory_document_lines
                WHERE company_id=? AND document_id=?`,
              [companyId,issue.id],
            );
            for (const salesLine of stockLines) {
              const issueLine = issueLines.find(line => line.source_line_id === salesLine.lineId);
              if (!issueLine) {
                await upsertPostingStatus(session,{postingId,companyId,branchId,sourceId,sourceVersion:persisted.version,status:"pending",reason:"waiting-for-movement",now});
                return Object.freeze({status:"pending",retryAction:"wait",reason:"waiting-for-movement",waitingLineIds:Object.freeze([salesLine.lineId]),journalVoucherId:null,committedPostingVersion:null});
              }
              const mv = await session.queryOne<MovementValuationRow>(
                `SELECT m.movement_id,m.line_id,m.product_id,m.warehouse_id,m.business_date,
                        m.business_order,m.recorded_at,m.quantity_delta,
                        v.valuation_entry_id,v.method,v.strategy_version,v.currency,v.quantity,
                        v.unit_cost,v.total_cost,v.cost_state,v.unresolved_reason,v.valued_at,v.revision
                   FROM inventory_stock_movements m
                   LEFT JOIN inventory_valuation_entries v
                     ON v.company_id=m.company_id AND v.movement_id=m.movement_id
                  WHERE m.company_id=? AND m.document_id=? AND m.line_id=?
                  ORDER BY m.business_order,m.movement_id LIMIT 1`,
                [companyId,issue.id,issueLine.id],
              );
              if (!mv) {
                await upsertPostingStatus(session,{postingId,companyId,branchId,sourceId,sourceVersion:persisted.version,status:"pending",reason:"waiting-for-movement",now});
                return Object.freeze({status:"pending",retryAction:"wait",reason:"waiting-for-movement",waitingLineIds:Object.freeze([salesLine.lineId]),journalVoucherId:null,committedPostingVersion:null});
              }
              if (
                !mv.valuation_entry_id || mv.cost_state !== "resolved" ||
                mv.total_cost === null || mv.unit_cost === null ||
                mv.method === null || mv.strategy_version === null ||
                mv.currency === null || mv.quantity === null ||
                mv.valued_at === null || mv.revision === null
              ) {
                await upsertPostingStatus(session,{postingId,companyId,branchId,sourceId,sourceVersion:persisted.version,status:"pending",reason:"waiting-for-valuation",now});
                return Object.freeze({status:"pending",retryAction:"wait",reason:"waiting-for-valuation",waitingLineIds:Object.freeze([salesLine.lineId]),journalVoucherId:null,committedPostingVersion:null});
              }
              if (!mv.quantity_delta.startsWith("-") || mv.total_cost > 0) {
                throw new Error("حرکت یا ارزش‌گذاری خروج فروش معتبر نیست.");
              }
              valuationLines.push({
                salesLineId:salesLine.lineId,
                productId:salesLine.productId,
                movementId:mv.movement_id,
                valuationEntryId:mv.valuation_entry_id,
                method:mv.method,
                strategyVersion:mv.strategy_version,
                currency:mv.currency,
                quantity:mv.quantity,
                unitCost:mv.unit_cost,
                totalCost:mv.total_cost,
                valuedAt:mv.valued_at,
                revision:mv.revision,
                warehouseId:mv.warehouse_id,
              });
            }
          }

          if (!fiscalPeriodId) throw new Error("برای تاریخ فاکتور، دوره مالی معتبر یافت نشد.");

          await bootstrapRules(session,companyId,snapshots,now);
          const rules = await listRules(session,companyId);
          const accounts = { findById: (targetCompanyId:string, accountId:string) => accountSnapshot(session,targetCompanyId,accountId) };

          const arRules = rules.filter(r=>r.account_role==="accounts-receivable").map(r=>createSalesAccountsReceivableAccountRule({
            ruleId:r.rule_id,companyId:r.company_id,branchId:r.branch_id,accountRole:"accounts-receivable",accountId:r.account_id,priority:r.priority,active:r.active===1,
          }));
          const ar = await resolveSalesAccountsReceivableAccount(arRules,{
            companyId,branchId,customerPartyId:commercial.customerPartyId,accountRole:"accounts-receivable",
          },accounts);

          const revenueByLine = [];
          const outputVatByLine = [];
          for (const line of commercial.lines) {
            const revenueRules = rules.filter(r=>r.account_role==="sales-revenue").map(r=>createSalesRevenueAccountRule({
              ruleId:r.rule_id,companyId:r.company_id,branchId:r.branch_id,lineKind:r.line_kind,accountRole:"sales-revenue",accountId:r.account_id,priority:r.priority,active:r.active===1,
            }));
            revenueByLine.push({
              lineId:line.lineId,
              resolution:await resolveSalesRevenueAccount(revenueRules,{companyId,branchId,lineKind:line.lineKind,accountRole:"sales-revenue"},accounts),
            });
            for (const tax of line.terms.taxes) {
              const vatRules = rules.filter(r=>r.account_role==="output-vat").map(r=>createSalesOutputVatAccountRule({
                ruleId:r.rule_id,companyId:r.company_id,branchId:r.branch_id,taxCode:r.tax_code,accountRole:"output-vat",accountId:r.account_id,priority:r.priority,active:r.active===1,
              }));
              outputVatByLine.push({
                lineId:line.lineId,
                resolution:await resolveSalesOutputVatAccount(vatRules,{
                  companyId,branchId,taxId:tax.taxId,taxCode:tax.taxCode ?? null,rateBasisPoints:tax.rateBasisPoints,accountRole:"output-vat",
                },accounts),
              });
            }
          }
          const commercialPosting = calculateSalesCommercialPosting({
            commercial,accountsReceivable:ar,revenueByLine,outputVatByLine,
          });

          let costPosting = null;
          if (valuationLines.length > 0) {
            const cogsRules = rules.filter(r=>r.account_role==="cogs").map(r=>createSalesCogsAccountRule({
              ruleId:r.rule_id,companyId:r.company_id,branchId:r.branch_id,accountRole:"cogs",accountId:r.account_id,priority:r.priority,active:r.active===1,
            }));
            const inventoryRules = rules.filter(r=>r.account_role==="inventory-asset").map(r=>createSalesInventoryAccountRule({
              ruleId:r.rule_id,companyId:r.company_id,branchId:r.branch_id,accountRole:"inventory-asset",accountId:r.account_id,priority:r.priority,active:r.active===1,
            }));
            const cogsByLine = [];
            const inventoryByLine = [];
            for (const valuation of valuationLines) {
              cogsByLine.push({lineId:valuation.salesLineId,resolution:await resolveSalesCogsAccount(cogsRules,{
                companyId,branchId,salesLineId:valuation.salesLineId,productId:valuation.productId,valuationEntryId:valuation.valuationEntryId,accountRole:"cogs",
              },accounts)});
              inventoryByLine.push({lineId:valuation.salesLineId,resolution:await resolveSalesInventoryAccount(inventoryRules,{
                companyId,branchId,salesLineId:valuation.salesLineId,productId:valuation.productId,movementId:valuation.movementId,valuationEntryId:valuation.valuationEntryId,warehouseId:valuation.warehouseId,accountRole:"inventory-asset",
              },accounts)});
            }
            costPosting = calculateSalesCostPosting({
              valuation:{sourceDocumentId:sourceId,companyId,ready:true,lines:valuationLines.map(({warehouseId,...line})=>line)},
              cogsByLine,inventoryByLine,
            });
          }

          const components = salesJournalComponentsFromInvoice({commercial:commercialPosting,cost:costPosting});
          const journalId = journalIdFor(sourceId,persisted.version);
          const requestId = `sales-post:${sourceId}:v${persisted.version}`;
          const fingerprint = await sha256Hex(JSON.stringify({
            source,
            commercial:commercial.documentTotals,
            valuations:valuationLines.map(v=>[v.valuationEntryId,v.totalCost,v.revision]),
          }));

          const already = await session.queryOne<{ journal_voucher_id:string }>(
            "SELECT journal_voucher_id FROM sales_posting_idempotency WHERE company_id=? AND source_document_id=? AND source_version=? AND purpose='accounting-recognition'",
            [companyId,sourceId,persisted.version],
          );
          if (already) {
            const row = await session.queryOne<PostingRow>(
              `SELECT posting_id,company_id,branch_id,source_type,source_document_id,source_version,
                      journal_voucher_id,status,pending_reason,last_error_code,version
                 FROM sales_postings WHERE posting_id=?`,
              [postingId],
            );
            if (row) return recoveryFromRow(row);
          }

          const draft = createSalesPostingJournalDraft({
            journalVoucherId:journalId,
            journalNumber:`SAL-${persisted.document.documentNumber ?? sourceId}-V${persisted.version}`.slice(0,50),
            postingId,
            source,
            companyId,
            branchId,
            voucherDate:commercial.businessDate,
            fiscalYearId:commercial.fiscalYearId,
            fiscalPeriodId,
            createdAtUtc:now,
            components,
            requestId,
            causationId:null,
          });

          const postingAggregate = createSalesPosting({
            postingId,companyId,branchId,source,createdAtUtc:now,
          });
          await upsertPostingStatus(session,{postingId,companyId,branchId,sourceId,sourceVersion:persisted.version,status:"ready",now});

          const journalRepository = new SqliteJournalVoucherRepository(session);
          const journalExisting = await journalRepository.findById(journalId);
          if (!journalExisting) await journalRepository.create(draft.journal);

          for (const line of draft.provenance.lineProvenance) {
            await session.execute(
              `INSERT OR IGNORE INTO sales_posting_journal_provenance(
                 journal_voucher_id,journal_line_id,posting_id,component_id,role,provenance_json,created_at_utc
               ) VALUES(?,?,?,?,?,?,?)`,
              [journalId,line.journalLineId,postingId,line.componentId,line.role,JSON.stringify(line),now],
            );
          }

          const currentPosting = await session.queryOne<{ version:number }>(
            "SELECT version FROM sales_postings WHERE posting_id=?",
            [postingId],
          );
          const nextVersion = Math.max(2,(currentPosting?.version ?? postingAggregate.version)+1);
          await session.execute(
            `UPDATE sales_postings
                SET journal_voucher_id=?,status='committed',pending_reason=NULL,last_error_code=NULL,
                    version=?,updated_at=?,sync_changed_at=?
              WHERE posting_id=? AND status<>'committed'`,
            [journalId,nextVersion,now,now,postingId],
          );

          const idempotencyKey = `sales:sales-invoice:${encodeURIComponent(sourceId)}:v${persisted.version}:purpose:accounting-recognition`;
          await session.execute(
            `INSERT INTO sales_posting_idempotency(
              idempotency_key,company_id,source_type,source_document_id,source_version,purpose,
              payload_fingerprint,posting_id,journal_voucher_id,committed_posting_version,committed_at_utc
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
            [idempotencyKey,companyId,"sales-invoice",sourceId,persisted.version,"accounting-recognition",fingerprint,postingId,journalId,nextVersion,now],
          );

          const eventId = `sales-posting-committed:${postingId}`;
          await session.execute(
            `INSERT OR IGNORE INTO sales_posting_outbox(
              event_id,company_id,posting_id,event_type,payload_json,occurred_at_utc,delivered_at_utc
            ) VALUES(?,?,?,?,?,?,NULL)`,
            [eventId,companyId,postingId,"sales-posting.accounting-recognition.committed",JSON.stringify({
              postingId,journalVoucherId:journalId,sourceDocumentId:sourceId,sourceVersion:persisted.version,postingVersion:nextVersion,
            }),now],
          );

          return Object.freeze({
            status:"committed" as const,
            retryAction:"replay" as const,
            reason:null,
            waitingLineIds:Object.freeze([]),
            journalVoucherId:journalId,
            committedPostingVersion:nextVersion,
          });
        });
      } catch (error) {
        const code =
          error && typeof error === "object" && "code" in error
            ? String((error as {code:unknown}).code)
            : null;
        if (
          code === SALES_POSTING_DOMAIN_ERROR_CODES.accountMappingMissing ||
          code === SALES_POSTING_DOMAIN_ERROR_CODES.accountNotPostable ||
          code === SALES_POSTING_DOMAIN_ERROR_CODES.postingRuleAmbiguous
        ) {
          const now = new Date().toISOString();
          const persisted = await input.database.transaction(session =>
            new SqliteSalesDocumentRepository(session).findById(companyId,sourceId)
          );
          if (persisted) {
            await input.database.transaction(session =>
              upsertPostingStatus(session,{
                postingId:postingIdFor(sourceId,persisted.version),companyId,branchId,sourceId,
                sourceVersion:persisted.version,status:"blocked",errorCode:code,now,
              })
            );
          }
        }
        throw error;
      }
    },
  });
}
