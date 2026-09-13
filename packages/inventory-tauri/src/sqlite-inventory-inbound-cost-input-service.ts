import type { DatabaseExecutor, DatabaseSession, DatabaseValue } from "@argin/database";

export interface InventoryInboundCostCandidate {
  readonly movementId: string;
  readonly documentId: string;
  readonly lineId: string;
  readonly productId: string;
  readonly warehouseId: string;
  readonly businessDate: string;
  readonly businessOrder: number;
  readonly quantity: string;
  readonly method: "fifo" | "moving_average";
  readonly strategyVersion: number;
  readonly currency: string;
}

export interface SetManualInventoryInboundCostInput {
  readonly companyId: string;
  readonly movementId: string;
  readonly unitCost: string;
  readonly actorId: string;
  readonly requestId: string;
  readonly occurredAt: string;
}

export interface SetManualInventoryInboundCostResult {
  readonly basisLineId: string;
  readonly movementId: string;
  readonly quantity: string;
  readonly unitCost: string;
  readonly totalCost: number;
  readonly currency: string;
  readonly method: "fifo" | "moving_average";
}

type CandidateRow = {
  movement_id: string;
  document_id: string;
  line_id: string;
  product_id: string;
  warehouse_id: string;
  business_date: string;
  business_order: number;
  quantity_delta: string;
  method: "fifo" | "moving_average";
  strategy_version: number;
  currency: string;
};

type ExistingCostRow = { basis_line_id: string };
type ExistingEntryRow = {
  valuation_entry_id: string;
  cost_state: "resolved" | "unresolved";
  revision: number;
};

type Decimal = { coefficient: bigint; scale: number };

function required(value: string, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`VALUATION_COST_INPUT_INVALID:${field}`);
  return value.trim();
}

function parseUnsignedDecimal(value: string, field: string, allowZero = false): Decimal {
  const normalized = required(value, field);
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(normalized)) throw new Error(`VALUATION_COST_INPUT_INVALID:${field}`);
  const [whole = "0", fraction = ""] = normalized.split(".");
  const coefficient = BigInt(`${whole}${fraction}`);
  if (!allowZero && coefficient === 0n) throw new Error(`VALUATION_COST_INPUT_INVALID:${field}`);
  return { coefficient, scale: fraction.length };
}

function canonicalDecimal(value: string, field: string): string {
  const decimal = parseUnsignedDecimal(value, field, true);
  let coefficient = decimal.coefficient;
  let scale = decimal.scale;
  while (scale > 0 && coefficient % 10n === 0n) {
    coefficient /= 10n;
    scale -= 1;
  }
  const digits = coefficient.toString();
  if (scale === 0) return digits;
  if (digits.length <= scale) return `0.${"0".repeat(scale - digits.length)}${digits}`;
  return `${digits.slice(0, digits.length - scale)}.${digits.slice(digits.length - scale)}`;
}

function roundedTotal(quantity: string, unitCost: string): number {
  const q = parseUnsignedDecimal(quantity, "quantity");
  const u = parseUnsignedDecimal(unitCost, "unitCost", true);
  const coefficient = q.coefficient * u.coefficient;
  const scale = q.scale + u.scale;
  const denominator = 10n ** BigInt(scale);
  const quotient = coefficient / denominator;
  const remainder = coefficient % denominator;
  const rounded = remainder * 2n >= denominator ? quotient + 1n : quotient;
  if (rounded > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("VALUATION_COST_INPUT_INVALID:totalCost");
  return Number(rounded);
}

function inboundQuantity(quantityDelta: string): string {
  const normalized = required(quantityDelta, "quantity");
  if (normalized.startsWith("-") || Number(normalized) <= 0) throw new Error("VALUATION_COST_INPUT_NOT_INBOUND");
  return canonicalDecimal(normalized, "quantity");
}

function candidateFromRow(row: CandidateRow): InventoryInboundCostCandidate {
  return Object.freeze({
    movementId: row.movement_id,
    documentId: row.document_id,
    lineId: row.line_id,
    productId: row.product_id,
    warehouseId: row.warehouse_id,
    businessDate: row.business_date,
    businessOrder: row.business_order,
    quantity: inboundQuantity(row.quantity_delta),
    method: row.method,
    strategyVersion: row.strategy_version,
    currency: row.currency,
  });
}

const candidateSql = `
  SELECT
    m.movement_id,m.document_id,m.line_id,m.product_id,m.warehouse_id,
    m.business_date,m.business_order,m.quantity_delta,
    p.method,p.strategy_version,p.currency
  FROM inventory_all_stock_movements m
  JOIN warehouses w
    ON w.company_id=m.company_id AND w.id=m.warehouse_id AND w.deleted_at IS NULL
  JOIN inventory_valuation_policies p
    ON p.policy_id=(
      SELECT p2.policy_id
      FROM inventory_valuation_policies p2
      WHERE p2.company_id=m.company_id AND p2.effective_from<=m.business_date
      ORDER BY p2.effective_from DESC,p2.revision DESC
      LIMIT 1
    )
  LEFT JOIN inventory_valuation_cost_inputs c
    ON c.company_id=m.company_id AND c.movement_id=m.movement_id
  WHERE m.company_id=?
    AND CAST(m.quantity_delta AS REAL)>0
    AND c.basis_line_id IS NULL`;

export class SqliteInventoryInboundCostInputService {
  constructor(private readonly db: DatabaseExecutor) {}

  async listCandidates(input: {
    companyId: string;
    branchId: string | null;
    productId?: string | null;
    warehouseId?: string | null;
    fromBusinessDate?: string | null;
    limit?: number;
  }): Promise<readonly InventoryInboundCostCandidate[]> {
    const companyId = required(input.companyId, "companyId");
    const clauses: string[] = [];
    const params: DatabaseValue[] = [companyId];
    if (input.branchId) {
      clauses.push("(w.organizational_scope='company' OR w.branch_id=?)");
      params.push(input.branchId);
    }
    if (input.productId) {
      clauses.push("m.product_id=?");
      params.push(input.productId);
    }
    if (input.warehouseId) {
      clauses.push("m.warehouse_id=?");
      params.push(input.warehouseId);
    }
    if (input.fromBusinessDate) {
      clauses.push("m.business_date>=?");
      params.push(input.fromBusinessDate);
    }
    const limit = Math.max(1, Math.min(input.limit ?? 100, 500));
    params.push(limit);
    const suffix = clauses.length ? ` AND ${clauses.join(" AND ")}` : "";
    const rows = await this.db.query<CandidateRow>(
      `${candidateSql}${suffix} ORDER BY m.business_date,m.business_order,m.document_id,m.line_id,m.movement_id LIMIT ?`,
      params,
    );
    return Object.freeze(rows.map(candidateFromRow));
  }

  async setManualCost(input: SetManualInventoryInboundCostInput): Promise<SetManualInventoryInboundCostResult> {
    const companyId = required(input.companyId, "companyId");
    const movementId = required(input.movementId, "movementId");
    required(input.actorId, "actorId");
    required(input.requestId, "requestId");
    const occurredAt = new Date(input.occurredAt);
    if (!Number.isFinite(occurredAt.getTime())) throw new Error("VALUATION_COST_INPUT_INVALID:occurredAt");
    const unitCost = canonicalDecimal(input.unitCost, "unitCost");

    const row = await this.db.queryOne<CandidateRow>(
      `${candidateSql} AND m.movement_id=? LIMIT 1`,
      [companyId, movementId],
    );
    if (!row) {
      const existing = await this.db.queryOne<ExistingCostRow>(
        `SELECT basis_line_id FROM inventory_valuation_cost_inputs WHERE company_id=? AND movement_id=?`,
        [companyId, movementId],
      );
      if (existing) throw new Error("VALUATION_COST_INPUT_ALREADY_RESOLVED");
      throw new Error("VALUATION_COST_INPUT_MOVEMENT_NOT_ELIGIBLE");
    }

    const candidate = candidateFromRow(row);
    const totalCost = roundedTotal(candidate.quantity, unitCost);
    const basisLineId = `manual-cost:${movementId}`;
    const valuationEntryId = `valuation:${movementId}`;
    const costLayerId = `fifo-layer:${movementId}`;
    const valuedAt = occurredAt.toISOString();

    await this.db.transaction(async (session: DatabaseSession) => {
      const existingCost = await session.queryOne<ExistingCostRow>(
        `SELECT basis_line_id FROM inventory_valuation_cost_inputs WHERE company_id=? AND movement_id=?`,
        [companyId, movementId],
      );
      if (existingCost) throw new Error("VALUATION_COST_INPUT_ALREADY_RESOLVED");

      await session.execute(
        `INSERT INTO inventory_valuation_cost_inputs(
          basis_line_id,company_id,movement_id,product_id,warehouse_id,quantity,currency,
          base_cost,landed_cost,total_cost,unit_cost,allocations_json,revision
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,1)`,
        [
          basisLineId,companyId,movementId,candidate.productId,candidate.warehouseId,candidate.quantity,
          candidate.currency,totalCost,0,totalCost,unitCost,"[]",
        ],
      );

      const existingEntry = await session.queryOne<ExistingEntryRow>(
        `SELECT valuation_entry_id,cost_state,revision FROM inventory_valuation_entries WHERE company_id=? AND movement_id=?`,
        [companyId,movementId],
      );
      if (!existingEntry) {
        await session.execute(
          `INSERT INTO inventory_valuation_entries(
            valuation_entry_id,company_id,product_id,movement_id,document_id,line_id,
            reversal_of_movement_id,transfer_id,kind,method,strategy_version,currency,
            warehouse_id,zone_id,location_id,business_date,business_order,quantity,
            unit_cost,total_cost,cost_state,unresolved_reason,valued_at,revision
          )
          SELECT ?,m.company_id,m.product_id,m.movement_id,m.document_id,m.line_id,
            m.reversal_of_movement_id,m.transfer_id,'inbound',?,?,?,m.warehouse_id,m.zone_id,m.location_id,
            m.business_date,m.business_order,?,?,?,'resolved',NULL,?,1
          FROM inventory_all_stock_movements m
          WHERE m.company_id=? AND m.movement_id=?`,
          [
            valuationEntryId,candidate.method,candidate.strategyVersion,candidate.currency,candidate.quantity,
            unitCost,totalCost,valuedAt,companyId,movementId,
          ],
        );
      } else if (existingEntry.cost_state === "unresolved") {
        await session.execute(
          `UPDATE inventory_valuation_entries
           SET unit_cost=?,total_cost=?,cost_state='resolved',unresolved_reason=NULL,valued_at=?,revision=revision+1
           WHERE company_id=? AND movement_id=? AND cost_state='unresolved'`,
          [unitCost,totalCost,valuedAt,companyId,movementId],
        );
      } else {
        throw new Error("VALUATION_COST_INPUT_ALREADY_RESOLVED");
      }

      if (candidate.method === "fifo") {
        await session.execute(
          `INSERT INTO inventory_valuation_cost_layers(
            cost_layer_id,company_id,product_id,source_movement_id,source_valuation_entry_id,
            method,strategy_version,currency,warehouse_id,zone_id,location_id,
            opened_business_date,opened_business_order,original_quantity,remaining_quantity,
            unit_cost,original_cost,remaining_cost,revision
          )
          SELECT ?,m.company_id,m.product_id,m.movement_id,?,'fifo',?,?,m.warehouse_id,m.zone_id,m.location_id,
            m.business_date,m.business_order,?,?,?,?,?,1
          FROM inventory_all_stock_movements m
          WHERE m.company_id=? AND m.movement_id=?
            AND NOT EXISTS(SELECT 1 FROM inventory_valuation_cost_layers l WHERE l.company_id=m.company_id AND l.source_movement_id=m.movement_id)`,
          [
            costLayerId,valuationEntryId,candidate.strategyVersion,candidate.currency,candidate.quantity,
            candidate.quantity,unitCost,totalCost,totalCost,companyId,movementId,
          ],
        );
      }

      const resolved = await session.queryOne<{ quantity: string; total_cost: number | null; unresolved_count: number }>(
        `SELECT
          COALESCE((SELECT CAST(SUM(CAST(m2.quantity_delta AS REAL)) AS TEXT)
            FROM inventory_all_stock_movements m2
            WHERE m2.company_id=? AND m2.product_id=? AND m2.warehouse_id=? AND m2.business_date<=?), '0') quantity,
          CASE WHEN EXISTS(
            SELECT 1 FROM inventory_all_stock_movements mx
            LEFT JOIN inventory_valuation_entries ex ON ex.company_id=mx.company_id AND ex.movement_id=mx.movement_id
            WHERE mx.company_id=? AND mx.product_id=? AND mx.warehouse_id=? AND mx.business_date<=?
              AND (ex.valuation_entry_id IS NULL OR ex.cost_state='unresolved')
          ) THEN NULL ELSE (
            SELECT COALESCE(SUM(e2.total_cost),0) FROM inventory_valuation_entries e2
            WHERE e2.company_id=? AND e2.product_id=? AND e2.warehouse_id=? AND e2.business_date<=? AND e2.cost_state='resolved'
          ) END total_cost,
          (SELECT COUNT(*) FROM inventory_all_stock_movements mx
            LEFT JOIN inventory_valuation_entries ex ON ex.company_id=mx.company_id AND ex.movement_id=mx.movement_id
            WHERE mx.company_id=? AND mx.product_id=? AND mx.warehouse_id=? AND mx.business_date<=?
              AND (ex.valuation_entry_id IS NULL OR ex.cost_state='unresolved')) unresolved_count`,
        [
          companyId,candidate.productId,candidate.warehouseId,candidate.businessDate,
          companyId,candidate.productId,candidate.warehouseId,candidate.businessDate,
          companyId,candidate.productId,candidate.warehouseId,candidate.businessDate,
          companyId,candidate.productId,candidate.warehouseId,candidate.businessDate,
        ],
      );
      if (resolved) {
        await session.execute(
          `INSERT INTO inventory_valuation_states(
            company_id,product_id,warehouse_id,zone_key,location_key,business_date,policy_id,
            method,strategy_version,currency,quantity,total_cost,unresolved_count
          )
          SELECT ?,?,?,COALESCE(m.zone_id,''),COALESCE(m.location_id,''),?,p.policy_id,?,?,?,?,?,?
          FROM inventory_all_stock_movements m
          JOIN inventory_valuation_policies p ON p.company_id=m.company_id AND p.method=? AND p.strategy_version=? AND p.currency=?
          WHERE m.company_id=? AND m.movement_id=? AND p.effective_from<=m.business_date
          ORDER BY p.effective_from DESC,p.revision DESC LIMIT 1
          ON CONFLICT(company_id,product_id,warehouse_id,zone_key,location_key,business_date)
          DO UPDATE SET policy_id=excluded.policy_id,method=excluded.method,strategy_version=excluded.strategy_version,
            currency=excluded.currency,quantity=excluded.quantity,total_cost=excluded.total_cost,unresolved_count=excluded.unresolved_count`,
          [
            companyId,candidate.productId,candidate.warehouseId,candidate.businessDate,candidate.method,
            candidate.strategyVersion,candidate.currency,resolved.quantity,resolved.total_cost,resolved.unresolved_count,
            candidate.method,candidate.strategyVersion,candidate.currency,companyId,movementId,
          ],
        );
      }
    });

    return Object.freeze({
      basisLineId,
      movementId,
      quantity: candidate.quantity,
      unitCost,
      totalCost,
      currency: candidate.currency,
      method: candidate.method,
    });
  }
}
