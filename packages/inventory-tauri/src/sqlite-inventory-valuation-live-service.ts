import type { DatabaseExecutor, DatabaseSession } from "@argin/database";
import {
  addInventoryStockQuantities,
  fifoInventoryValuationStrategy,
  movingAverageInventoryValuationStrategy,
  type InventoryFifoLayerState,
  type InventoryValuationMethod,
} from "@argin/inventory";

interface MovementRow {
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
}

interface PolicyRow {
  policy_id: string;
  method: InventoryValuationMethod;
  strategy_version: number;
  currency: string;
  effective_from: string;
}

interface StateRow {
  quantity: string;
  total_cost: number | null;
}

interface LayerRow {
  cost_layer_id: string;
  remaining_quantity: string;
  remaining_cost: number;
  currency: string;
}

export interface InventoryValuationCatchUpResult {
  readonly processedMovementCount: number;
  readonly blockedMovementCount: number;
}

const zoneKey = (value: string | null): string => value ?? "";

function absoluteOutboundQuantity(value: string): string {
  if (!value.startsWith("-") || value === "-0") {
    throw new Error("VALUATION_LIVE_MOVEMENT_NOT_OUTBOUND");
  }
  return value.slice(1);
}

function sumFifoQuantity(layers: readonly InventoryFifoLayerState[]): string {
  return layers.reduce(
    (sum, layer) => addInventoryStockQuantities(sum, layer.remainingQuantity),
    "0",
  );
}

function sumFifoCost(layers: readonly InventoryFifoLayerState[]): number {
  return layers.reduce((sum, layer) => sum + layer.remainingCost, 0);
}

/**
 * Projection catch-up for ordinary confirmed outbound movements after a Company valuation
 * policy is already active. Quantity Movement remains authoritative; this service only
 * materializes the rebuildable monetary projection (Valuation Entry, FIFO layers/MWA state,
 * dated state and stream revision).
 *
 * Transfer and reversal movements intentionally stay on their dedicated deterministic paths.
 * A backdated missing movement is not incrementally guessed; it remains visible through the
 * valuation currentness report until full recalculation is invoked.
 */
export class SqliteInventoryValuationLiveService {
  constructor(private readonly db: DatabaseExecutor) {}

  async catchUpCompany(companyId: string, occurredAt: string): Promise<InventoryValuationCatchUpResult> {
    if (!companyId.trim()) throw new Error("VALUATION_LIVE_INVALID:companyId");
    const valuedAt = new Date(occurredAt);
    if (!Number.isFinite(valuedAt.getTime())) throw new Error("VALUATION_LIVE_INVALID:occurredAt");

    const hasPolicy = await this.db.queryOne<{ n: number }>(
      "SELECT COUNT(*) n FROM inventory_valuation_policies WHERE company_id=?",
      [companyId],
    );
    if ((hasPolicy?.n ?? 0) === 0) {
      return Object.freeze({ processedMovementCount: 0, blockedMovementCount: 0 });
    }

    const missing = await this.db.query<MovementRow>(
      `SELECT m.*
       FROM inventory_all_stock_movements m
       LEFT JOIN inventory_valuation_entries e
         ON e.company_id=m.company_id AND e.movement_id=m.movement_id
       WHERE m.company_id=?
         AND e.valuation_entry_id IS NULL
         AND m.transfer_id IS NULL
         AND m.reversal_of_movement_id IS NULL
         AND m.quantity_delta LIKE '-%'
         AND m.quantity_delta<>'-0'
         AND NOT EXISTS (
           SELECT 1 FROM inventory_all_stock_movements rv
           WHERE rv.company_id=m.company_id
             AND rv.reversal_of_movement_id=m.movement_id
         )
       ORDER BY m.business_date,m.business_order,m.document_id,m.line_id,m.movement_id`,
      [companyId],
    );

    let processedMovementCount = 0;
    let blockedMovementCount = 0;

    for (const movement of missing) {
      const laterEntry = await this.db.queryOne<{ ok: number }>(
        `SELECT 1 ok
         FROM inventory_valuation_entries e
         WHERE e.company_id=? AND e.product_id=?
           AND (
             e.business_date>?
             OR (e.business_date=? AND e.business_order>?)
             OR (e.business_date=? AND e.business_order=? AND e.document_id>?)
             OR (e.business_date=? AND e.business_order=? AND e.document_id=? AND e.line_id>?)
             OR (e.business_date=? AND e.business_order=? AND e.document_id=? AND e.line_id=? AND e.movement_id>?)
           )
         LIMIT 1`,
        [
          companyId,
          movement.product_id,
          movement.business_date,
          movement.business_date,
          movement.business_order,
          movement.business_date,
          movement.business_order,
          movement.document_id,
          movement.business_date,
          movement.business_order,
          movement.document_id,
          movement.line_id,
          movement.business_date,
          movement.business_order,
          movement.document_id,
          movement.line_id,
          movement.movement_id,
        ],
      );
      if (laterEntry) {
        blockedMovementCount += 1;
        continue;
      }

      const processed = await this.db.transaction(async (session) =>
        this.processOrdinaryOutbound(session, movement, valuedAt.toISOString()),
      );
      if (processed) processedMovementCount += 1;
      else blockedMovementCount += 1;
    }

    return Object.freeze({ processedMovementCount, blockedMovementCount });
  }

  private async processOrdinaryOutbound(
    session: DatabaseSession,
    movement: MovementRow,
    valuedAt: string,
  ): Promise<boolean> {
    const policy = await session.queryOne<PolicyRow>(
      `SELECT policy_id,method,strategy_version,currency,effective_from
       FROM inventory_valuation_policies
       WHERE company_id=? AND effective_from<=?
       ORDER BY effective_from DESC,revision DESC
       LIMIT 1`,
      [movement.company_id, movement.business_date],
    );
    if (!policy) return false;

    const previous = await session.queryOne<StateRow>(
      `SELECT quantity,total_cost
       FROM inventory_valuation_states
       WHERE company_id=? AND product_id=? AND warehouse_id=?
         AND zone_key=? AND location_key=? AND business_date<=?
       ORDER BY business_date DESC
       LIMIT 1`,
      [
        movement.company_id,
        movement.product_id,
        movement.warehouse_id,
        zoneKey(movement.zone_id),
        zoneKey(movement.location_id),
        movement.business_date,
      ],
    );
    if (!previous || previous.total_cost === null) return false;

    const quantity = absoluteOutboundQuantity(movement.quantity_delta);
    let unitCost: string;
    let totalCost: number;
    let nextQuantity: string;
    let nextTotalCost: number;

    if (policy.method === "fifo") {
      const layerRows = await session.query<LayerRow>(
        `SELECT cost_layer_id,remaining_quantity,remaining_cost,currency
         FROM inventory_valuation_cost_layers
         WHERE company_id=? AND product_id=? AND warehouse_id=?
           AND zone_id IS ? AND location_id IS ?
           AND remaining_quantity<>'0'
         ORDER BY opened_business_date,opened_business_order,cost_layer_id`,
        [
          movement.company_id,
          movement.product_id,
          movement.warehouse_id,
          movement.zone_id,
          movement.location_id,
        ],
      );
      if (layerRows.length === 0) return false;

      const currentLayers: InventoryFifoLayerState[] = layerRows.map((row) => ({
        layerId: row.cost_layer_id,
        remainingQuantity: row.remaining_quantity,
        remainingCost: row.remaining_cost,
        currency: row.currency as InventoryFifoLayerState["currency"],
      }));

      let result;
      try {
        result = fifoInventoryValuationStrategy.issue(
          { layers: currentLayers },
          { quantity, currency: policy.currency as InventoryFifoLayerState["currency"] },
        );
      } catch {
        return false;
      }

      const nextById = new Map(result.state.layers.map((layer) => [layer.layerId, layer]));
      for (const row of layerRows) {
        const next = nextById.get(row.cost_layer_id);
        await session.execute(
          `UPDATE inventory_valuation_cost_layers
           SET remaining_quantity=?,remaining_cost=?,revision=revision+1
           WHERE company_id=? AND cost_layer_id=?`,
          [
            next?.remainingQuantity ?? "0",
            next?.remainingCost ?? 0,
            movement.company_id,
            row.cost_layer_id,
          ],
        );
      }

      unitCost = result.unitCost;
      totalCost = result.totalCost;
      nextQuantity = sumFifoQuantity(result.state.layers);
      nextTotalCost = sumFifoCost(result.state.layers);
    } else {
      let result;
      try {
        result = movingAverageInventoryValuationStrategy.issue(
          {
            quantity: previous.quantity,
            totalCost: previous.total_cost,
            currency: policy.currency as never,
          },
          { quantity, currency: policy.currency as never },
        );
      } catch {
        return false;
      }
      unitCost = result.unitCost;
      totalCost = result.totalCost;
      nextQuantity = result.state.quantity;
      nextTotalCost = result.state.totalCost;
    }

    await session.execute(
      `INSERT INTO inventory_valuation_entries(
        valuation_entry_id,company_id,product_id,movement_id,document_id,line_id,
        reversal_of_movement_id,transfer_id,kind,method,strategy_version,currency,
        warehouse_id,zone_id,location_id,business_date,business_order,quantity,
        unit_cost,total_cost,cost_state,unresolved_reason,valued_at,revision
      ) VALUES(?,?,?,?,?,?,NULL,NULL,'outbound',?,?,?,?,?,?,?,?,?,?,?,'resolved',NULL,?,1)`,
      [
        `valuation:${movement.movement_id}`,
        movement.company_id,
        movement.product_id,
        movement.movement_id,
        movement.document_id,
        movement.line_id,
        policy.method,
        policy.strategy_version,
        policy.currency,
        movement.warehouse_id,
        movement.zone_id,
        movement.location_id,
        movement.business_date,
        movement.business_order,
        quantity,
        unitCost,
        totalCost,
        valuedAt,
      ],
    );

    await session.execute(
      `INSERT INTO inventory_valuation_states(
        company_id,product_id,warehouse_id,zone_key,location_key,business_date,
        policy_id,method,strategy_version,currency,quantity,total_cost,unresolved_count
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,0)
      ON CONFLICT(company_id,product_id,warehouse_id,zone_key,location_key,business_date)
      DO UPDATE SET
        policy_id=excluded.policy_id,
        method=excluded.method,
        strategy_version=excluded.strategy_version,
        currency=excluded.currency,
        quantity=excluded.quantity,
        total_cost=excluded.total_cost,
        unresolved_count=0`,
      [
        movement.company_id,
        movement.product_id,
        movement.warehouse_id,
        zoneKey(movement.zone_id),
        zoneKey(movement.location_id),
        movement.business_date,
        policy.policy_id,
        policy.method,
        policy.strategy_version,
        policy.currency,
        nextQuantity,
        nextTotalCost,
      ],
    );

    await session.execute(
      `INSERT INTO inventory_valuation_stream_versions(company_id,stream_key,revision)
       VALUES(?,?,1)
       ON CONFLICT(company_id,stream_key)
       DO UPDATE SET revision=inventory_valuation_stream_versions.revision+1`,
      [movement.company_id, `valuation:${movement.company_id}:${movement.product_id}`],
    );

    return true;
  }
}
