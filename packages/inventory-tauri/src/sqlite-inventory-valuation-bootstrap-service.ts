import type { DatabaseExecutor, DatabaseSession } from "@argin/database";
import { createInitialInventoryValuationPolicy } from "@argin/inventory";

export type InventoryBootstrapValuationMethod = "fifo" | "moving_average";

export interface InitializeInventoryValuationInput {
  readonly companyId: string;
  readonly method: InventoryBootstrapValuationMethod;
  readonly effectiveFrom: string;
  readonly actorId: string;
  readonly requestId: string;
  readonly occurredAt: string;
}

export interface InitializeInventoryValuationResult {
  readonly policyId: string;
  readonly method: InventoryBootstrapValuationMethod;
  readonly effectiveFrom: string;
  readonly revision: number;
  readonly valuedMovementCount: number;
  readonly skippedReversalPairCount: number;
  readonly productCount: number;
}

type MovementRow = {
  movement_id: string;
  company_id: string;
  document_id: string;
  line_id: string;
  transfer_id: string | null;
  reversal_of_movement_id: string | null;
  product_id: string;
  warehouse_id: string;
  zone_id: string | null;
  location_id: string | null;
  business_date: string;
  business_order: number;
  recorded_at: string;
  quantity_delta: string;
};

type CostRow = {
  movement_id: string;
  quantity: string;
  currency: string;
  total_cost: number;
  unit_cost: string;
};

type Decimal = { coefficient: bigint; scale: number };
type FifoLayer = {
  id: string;
  sourceMovementId: string;
  sourceEntryId: string;
  productId: string;
  warehouseId: string;
  zoneId: string | null;
  locationId: string | null;
  businessDate: string;
  businessOrder: number;
  originalQuantity: string;
  remainingQuantity: string;
  unitCost: string;
  originalCost: number;
  remainingCost: number;
  currency: string;
};
type StockState = {
  quantity: string;
  totalCost: number;
  fifoLayers: FifoLayer[];
};

const required = (value: string, field: string): string => {
  if (typeof value !== "string" || !value.trim()) throw new Error(`VALUATION_BOOTSTRAP_INVALID:${field}`);
  return value.trim();
};
const validDate = (value: string): string => {
  const normalized = required(value, "effectiveFrom");
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(normalized) || Number.isNaN(Date.parse(`${normalized}T00:00:00.000Z`))) {
    throw new Error("VALUATION_BOOTSTRAP_INVALID:effectiveFrom");
  }
  return normalized;
};
const parseDecimal = (value: string, field: string): Decimal => {
  const normalized = required(value, field);
  const negative = normalized.startsWith("-");
  const unsigned = negative ? normalized.slice(1) : normalized;
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(unsigned)) throw new Error(`VALUATION_BOOTSTRAP_INVALID:${field}`);
  const [whole = "0", fraction = ""] = unsigned.split(".");
  const coefficient = BigInt(`${whole}${fraction}`) * (negative ? -1n : 1n);
  return { coefficient, scale: fraction.length };
};
const pow10 = (n: number) => 10n ** BigInt(n);
const align = (a: Decimal, b: Decimal): [bigint, bigint, number] => {
  const scale = Math.max(a.scale, b.scale);
  return [a.coefficient * pow10(scale - a.scale), b.coefficient * pow10(scale - b.scale), scale];
};
const canonical = (value: Decimal): string => {
  let coefficient = value.coefficient;
  let scale = value.scale;
  const negative = coefficient < 0n;
  if (negative) coefficient = -coefficient;
  while (scale > 0 && coefficient % 10n === 0n) { coefficient /= 10n; scale -= 1; }
  const digits = coefficient.toString();
  const unsigned = scale === 0 ? digits : digits.length <= scale
    ? `0.${"0".repeat(scale - digits.length)}${digits}`
    : `${digits.slice(0, digits.length - scale)}.${digits.slice(digits.length - scale)}`;
  return negative && unsigned !== "0" ? `-${unsigned}` : unsigned;
};
const addQty = (a: string, b: string): string => {
  const [left, right, scale] = align(parseDecimal(a, "quantity"), parseDecimal(b, "quantity"));
  return canonical({ coefficient: left + right, scale });
};
const absQty = (value: string): string => {
  const d = parseDecimal(value, "quantity");
  return canonical({ coefficient: d.coefficient < 0n ? -d.coefficient : d.coefficient, scale: d.scale });
};
const compareQty = (a: string, b: string): number => {
  const [left, right] = align(parseDecimal(a, "quantity"), parseDecimal(b, "quantity"));
  return left < right ? -1 : left > right ? 1 : 0;
};
const subtractPositiveQty = (a: string, b: string): string => {
  const [left, right, scale] = align(parseDecimal(a, "quantity"), parseDecimal(b, "quantity"));
  if (right > left) throw new Error("VALUATION_BOOTSTRAP_NEGATIVE_STOCK");
  return canonical({ coefficient: left - right, scale });
};
const roundedRatioMoney = (total: number, part: string, whole: string): number => {
  const [p, w] = align(parseDecimal(part, "part"), parseDecimal(whole, "whole"));
  if (w <= 0n || p < 0n || p > w) throw new Error("VALUATION_BOOTSTRAP_INVALID:ratio");
  const numerator = BigInt(total) * p;
  const q = numerator / w;
  const r = numerator % w;
  const rounded = r * 2n >= w ? q + 1n : q;
  if (rounded > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("VALUATION_BOOTSTRAP_MONEY_OUT_OF_RANGE");
  return Number(rounded);
};
const unitCostFrom = (total: number, quantity: string): string => {
  const q = parseDecimal(quantity, "quantity");
  const denominator = q.coefficient < 0n ? -q.coefficient : q.coefficient;
  if (denominator <= 0n) return "0";
  const scale = 12;
  const numerator = BigInt(Math.abs(total)) * pow10(q.scale + scale);
  const base = numerator / denominator;
  const rem = numerator % denominator;
  const rounded = rem * 2n >= denominator ? base + 1n : base;
  return canonical({ coefficient: rounded, scale });
};
const stockKey = (m: MovementRow) => [m.product_id,m.warehouse_id,m.zone_id ?? "",m.location_id ?? ""].join("|");

export class SqliteInventoryValuationBootstrapService {
  constructor(private readonly db: DatabaseExecutor) {}

  async initialize(input: InitializeInventoryValuationInput): Promise<InitializeInventoryValuationResult> {
    const companyId = required(input.companyId, "companyId");
    const actorId = required(input.actorId, "actorId");
    const requestId = required(input.requestId, "requestId");
    const effectiveFrom = validDate(input.effectiveFrom);
    if (input.method !== "fifo" && input.method !== "moving_average") throw new Error("VALUATION_BOOTSTRAP_INVALID:method");
    const occurredAt = new Date(input.occurredAt);
    if (!Number.isFinite(occurredAt.getTime())) throw new Error("VALUATION_BOOTSTRAP_INVALID:occurredAt");

    const existingPolicy = await this.db.queryOne<{ policy_id: string }>(
      "SELECT policy_id FROM inventory_valuation_policies WHERE company_id=? LIMIT 1", [companyId],
    );
    if (existingPolicy) throw new Error("VALUATION_BOOTSTRAP_POLICY_ALREADY_EXISTS");

    const earliest = await this.db.queryOne<{ d: string | null }>(
      "SELECT MIN(business_date) d FROM inventory_all_stock_movements WHERE company_id=?", [companyId],
    );
    if (earliest?.d && effectiveFrom > earliest.d) throw new Error(`VALUATION_BOOTSTRAP_EFFECTIVE_DATE_AFTER_FIRST_MOVEMENT:${earliest.d}`);

    const movements = await this.db.query<MovementRow>(
      `SELECT * FROM inventory_all_stock_movements WHERE company_id=? AND business_date>=?
       ORDER BY business_date,business_order,document_id,line_id,movement_id`, [companyId,effectiveFrom],
    );
    if (movements.some((m) => m.transfer_id)) throw new Error("VALUATION_BOOTSTRAP_TRANSFER_REQUIRES_FULL_RECALCULATION_ENGINE");

    const reversedOriginals = new Set(movements.filter((m) => m.reversal_of_movement_id).map((m) => m.reversal_of_movement_id!));
    const active = movements.filter((m) => !m.reversal_of_movement_id && !reversedOriginals.has(m.movement_id));
    const skippedReversalPairCount = reversedOriginals.size;
    const inboundIds = active.filter((m) => !m.quantity_delta.startsWith("-") && m.quantity_delta !== "0").map((m) => m.movement_id);
    const costRows = inboundIds.length === 0 ? [] : await this.db.query<CostRow>(
      `SELECT movement_id,quantity,currency,total_cost,unit_cost FROM inventory_valuation_cost_inputs
       WHERE company_id=? AND movement_id IN (${inboundIds.map(() => "?").join(",")})`, [companyId,...inboundIds],
    );
    const costs = new Map(costRows.map((row) => [row.movement_id,row]));
    const missing = inboundIds.filter((id) => !costs.has(id));
    if (missing.length) throw new Error(`VALUATION_BOOTSTRAP_UNRESOLVED_COST:${missing.length}`);

    const policyId = `valuation-policy:${companyId}:1`;
    const policy = createInitialInventoryValuationPolicy({ policyId, companyId, method: input.method, effectiveFrom });
    const states = new Map<string, StockState>();
    const entries: Array<{m:MovementRow;kind:"inbound"|"outbound";quantity:string;unitCost:string;totalCost:number;currency:string}> = [];

    for (const movement of active) {
      const key = stockKey(movement);
      const current = states.get(key) ?? { quantity:"0", totalCost:0, fifoLayers:[] };
      const isInbound = !movement.quantity_delta.startsWith("-");
      const quantity = absQty(movement.quantity_delta);
      if (quantity === "0") continue;
      if (isInbound) {
        const cost = costs.get(movement.movement_id)!;
        if (input.method === "fifo") {
          current.fifoLayers.push({
            id:`fifo-layer:${movement.movement_id}`,sourceMovementId:movement.movement_id,sourceEntryId:`valuation:${movement.movement_id}`,
            productId:movement.product_id,warehouseId:movement.warehouse_id,zoneId:movement.zone_id,locationId:movement.location_id,
            businessDate:movement.business_date,businessOrder:movement.business_order,originalQuantity:quantity,remainingQuantity:quantity,
            unitCost:cost.unit_cost,originalCost:cost.total_cost,remainingCost:cost.total_cost,currency:cost.currency,
          });
        }
        current.quantity = addQty(current.quantity, quantity);
        current.totalCost += cost.total_cost;
        entries.push({m:movement,kind:"inbound",quantity,unitCost:cost.unit_cost,totalCost:cost.total_cost,currency:cost.currency});
      } else {
        if (compareQty(current.quantity, quantity) < 0) throw new Error(`VALUATION_BOOTSTRAP_NEGATIVE_STOCK:${movement.movement_id}`);
        let outboundCost = 0;
        let unitCost = "0";
        if (input.method === "fifo") {
          let remaining = quantity;
          for (const layer of current.fifoLayers) {
            if (remaining === "0") break;
            if (layer.remainingQuantity === "0") continue;
            const take = compareQty(remaining, layer.remainingQuantity) >= 0 ? layer.remainingQuantity : remaining;
            const cost = take === layer.remainingQuantity ? layer.remainingCost : roundedRatioMoney(layer.remainingCost,take,layer.remainingQuantity);
            layer.remainingQuantity = subtractPositiveQty(layer.remainingQuantity,take);
            layer.remainingCost -= cost;
            outboundCost += cost;
            remaining = subtractPositiveQty(remaining,take);
          }
          if (remaining !== "0") throw new Error(`VALUATION_BOOTSTRAP_FIFO_INSUFFICIENT:${movement.movement_id}`);
          unitCost = unitCostFrom(outboundCost,quantity);
        } else {
          outboundCost = roundedRatioMoney(current.totalCost,quantity,current.quantity);
          unitCost = unitCostFrom(outboundCost,quantity);
        }
        current.quantity = subtractPositiveQty(current.quantity,quantity);
        current.totalCost -= outboundCost;
        entries.push({m:movement,kind:"outbound",quantity,unitCost,totalCost:-outboundCost,currency:"IRR"});
      }
      states.set(key,current);
    }

    await this.db.transaction(async (session: DatabaseSession) => {
      const replay = await session.queryOne<{payload_fingerprint:string;outcome_id:string}>(
        "SELECT payload_fingerprint,outcome_id FROM inventory_valuation_idempotency WHERE company_id=? AND request_id=?", [companyId,requestId],
      );
      const fingerprint = JSON.stringify({ method:input.method,effectiveFrom });
      if (replay) {
        if (replay.payload_fingerprint !== fingerprint) throw new Error("VALUATION_BOOTSTRAP_IDEMPOTENCY_CONFLICT");
        return;
      }
      await session.execute(
        `INSERT INTO inventory_valuation_policies(policy_id,company_id,method,strategy_version,currency,effective_from,previous_policy_id,change_reason,revision)
         VALUES(?,?,?,?,?,?,?,?,?)`,
        [policy.policyId,policy.companyId,policy.method,policy.strategyVersion,policy.currency,policy.effectiveFrom,null,null,policy.revision],
      );
      await session.execute("DELETE FROM inventory_valuation_entries WHERE company_id=?",[companyId]);
      await session.execute("DELETE FROM inventory_valuation_cost_layers WHERE company_id=?",[companyId]);
      await session.execute("DELETE FROM inventory_valuation_states WHERE company_id=?",[companyId]);

      for (const entry of entries) {
        const m=entry.m;
        await session.execute(
          `INSERT INTO inventory_valuation_entries(
            valuation_entry_id,company_id,product_id,movement_id,document_id,line_id,reversal_of_movement_id,transfer_id,kind,method,strategy_version,currency,
            warehouse_id,zone_id,location_id,business_date,business_order,quantity,unit_cost,total_cost,cost_state,unresolved_reason,valued_at,revision)
           VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
          [`valuation:${m.movement_id}`,companyId,m.product_id,m.movement_id,m.document_id,m.line_id,null,null,entry.kind,input.method,policy.strategyVersion,
           entry.currency,m.warehouse_id,m.zone_id,m.location_id,m.business_date,m.business_order,entry.quantity,entry.unitCost,entry.totalCost,"resolved",null,occurredAt.toISOString()],
        );
      }
      if (input.method === "fifo") {
        for (const state of states.values()) for (const layer of state.fifoLayers) {
          await session.execute(
            `INSERT INTO inventory_valuation_cost_layers(
              cost_layer_id,company_id,product_id,source_movement_id,source_valuation_entry_id,method,strategy_version,currency,warehouse_id,zone_id,location_id,
              opened_business_date,opened_business_order,original_quantity,remaining_quantity,unit_cost,original_cost,remaining_cost,revision)
             VALUES(?,?,?,?,?,'fifo',?,?,?,?,?,?,?,?,?,?,?,?,1)`,
            [layer.id,companyId,layer.productId,layer.sourceMovementId,layer.sourceEntryId,policy.strategyVersion,layer.currency,layer.warehouseId,layer.zoneId,layer.locationId,
             layer.businessDate,layer.businessOrder,layer.originalQuantity,layer.remainingQuantity,layer.unitCost,layer.originalCost,layer.remainingCost],
          );
        }
      }
      for (const [key,state] of states.entries()) {
        const [productId,warehouseId,zoneKey,locationKey]=key.split("|");
        const latest = [...active].reverse().find((m)=>stockKey(m)===key);
        if (!latest) continue;
        await session.execute(
          `INSERT INTO inventory_valuation_states(company_id,product_id,warehouse_id,zone_key,location_key,business_date,policy_id,method,strategy_version,currency,quantity,total_cost,unresolved_count)
           VALUES(?,?,?,?,?,?,?,?,?,?,?,?,0)`,
          [companyId,productId,warehouseId,zoneKey,locationKey,latest.business_date,policyId,input.method,policy.strategyVersion,"IRR",state.quantity,state.totalCost],
        );
      }
      const products=[...new Set(active.map((m)=>m.product_id))];
      await session.execute(
        `INSERT INTO inventory_valuation_stream_versions(company_id,stream_key,revision) VALUES(?,?,1)
         ON CONFLICT(company_id,stream_key) DO UPDATE SET revision=inventory_valuation_stream_versions.revision+1`,
        [companyId,`policy:${companyId}`],
      );
      for(const productId of products) await session.execute(
        `INSERT INTO inventory_valuation_stream_versions(company_id,stream_key,revision) VALUES(?,?,1)
         ON CONFLICT(company_id,stream_key) DO UPDATE SET revision=inventory_valuation_stream_versions.revision+1`,
        [companyId,`valuation:${companyId}:${productId}`],
      );
      await session.execute(
        `INSERT INTO inventory_valuation_idempotency(company_id,request_id,operation,payload_fingerprint,outcome_kind,outcome_id,outcome_revision,recorded_at)
         VALUES(?,?,?,?,?,?,?,?)`,
        [companyId,requestId,"inventory.valuation.policy.initialize",fingerprint,"policy",policyId,1,occurredAt.toISOString()],
      );
      void actorId;
    });

    return Object.freeze({policyId,method:input.method,effectiveFrom,revision:1,valuedMovementCount:entries.length,skippedReversalPairCount,productCount:new Set(active.map((m)=>m.product_id)).size});
  }
}
