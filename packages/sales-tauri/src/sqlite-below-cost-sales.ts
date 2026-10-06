import type { DatabaseSession } from "@argin/database";
import {
  fifoInventoryValuationStrategy,
  movingAverageInventoryValuationStrategy,
  type InventoryFifoLayerState,
  type InventoryMovingAverageState,
} from "@argin/inventory/valuation-strategy";
import type {
  BelowCostDecision,
  BelowCostSalesDecisionRepository,
  BelowCostSalesPolicy,
  BelowCostSalesPolicyRepository,
  SalesInventoryCostQuote,
  SalesInventoryCostQuotePort,
} from "@argin/sales";
import { createBelowCostSalesPolicy } from "@argin/sales";

type PolicyRow = {
  policy_id: string;
  company_id: string;
  revision: number;
  effective_from: string;
  mode: BelowCostSalesPolicy["mode"];
  minimum_margin_basis_points: number;
};

type DecisionRow = {
  decision_id: string;
  company_id: string;
  document_id: string;
  line_id: string;
  policy_id: string;
  policy_revision: number;
  outcome: BelowCostDecision["outcome"];
  selling_unit_price: number;
  quoted_unit_cost: string | null;
  margin_amount: number | null;
  margin_basis_points: number | null;
  quote_id: string | null;
  valuation_basis_revision: string | null;
  warehouse_id: string | null;
  approved_by: string | null;
  approval_reason: string | null;
  decided_at: string;
};

const mapPolicyRow = (row: PolicyRow) => createBelowCostSalesPolicy({
  policyId: row.policy_id,
  companyId: row.company_id,
  revision: row.revision,
  effectiveFrom: row.effective_from,
  mode: row.mode,
  minimumMarginBasisPoints: row.minimum_margin_basis_points,
});

const mapDecisionRow = (row: DecisionRow): BelowCostDecision => Object.freeze({
  decisionId: row.decision_id,
  companyId: row.company_id,
  documentId: row.document_id,
  lineId: row.line_id,
  policyId: row.policy_id,
  policyRevision: row.policy_revision,
  outcome: row.outcome,
  sellingUnitPrice: row.selling_unit_price,
  quotedUnitCost: row.quoted_unit_cost,
  marginAmount: row.margin_amount,
  marginBasisPoints: row.margin_basis_points,
  quoteId: row.quote_id,
  valuationBasisRevision: row.valuation_basis_revision,
  warehouseId: row.warehouse_id,
  approvedBy: row.approved_by,
  approvalReason: row.approval_reason,
  decidedAt: row.decided_at,
});

export class SqliteBelowCostSalesPolicyRepository implements BelowCostSalesPolicyRepository {
  constructor(private readonly db: DatabaseSession) {}

  async findEffective(companyId: string, businessDate: string) {
    const row = await this.db.queryOne<PolicyRow>(
      "SELECT policy_id,company_id,revision,effective_from,mode,minimum_margin_basis_points FROM sales_below_cost_policies WHERE company_id=? AND effective_from<=? ORDER BY effective_from DESC,revision DESC LIMIT 1",
      [companyId, businessDate],
    );
    return row ? mapPolicyRow(row) : null;
  }

  async list(companyId: string) {
    const rows = await this.db.query<PolicyRow>(
      "SELECT policy_id,company_id,revision,effective_from,mode,minimum_margin_basis_points FROM sales_below_cost_policies WHERE company_id=? ORDER BY effective_from,revision",
      [companyId],
    );
    return Object.freeze(rows.map(mapPolicyRow));
  }

  async save(policy: BelowCostSalesPolicy, actorId: string, changedAt: string) {
    await this.db.execute(
      "INSERT INTO sales_below_cost_policies(policy_id,company_id,revision,effective_from,mode,minimum_margin_basis_points,actor_id,changed_at) VALUES(?,?,?,?,?,?,?,?)",
      [
        policy.policyId,
        policy.companyId,
        policy.revision,
        policy.effectiveFrom,
        policy.mode,
        policy.minimumMarginBasisPoints,
        actorId,
        changedAt,
      ],
    );
  }
}

export class SqliteBelowCostSalesDecisionRepository implements BelowCostSalesDecisionRepository {
  constructor(private readonly db: DatabaseSession) {}

  async add(decision: BelowCostDecision) {
    await this.db.execute(
      "INSERT INTO sales_below_cost_decisions(decision_id,company_id,document_id,line_id,policy_id,policy_revision,outcome,selling_unit_price,quoted_unit_cost,margin_amount,margin_basis_points,quote_id,valuation_basis_revision,warehouse_id,approved_by,approval_reason,decided_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [
        decision.decisionId,
        decision.companyId,
        decision.documentId,
        decision.lineId,
        decision.policyId,
        decision.policyRevision,
        decision.outcome,
        decision.sellingUnitPrice,
        decision.quotedUnitCost,
        decision.marginAmount,
        decision.marginBasisPoints,
        decision.quoteId,
        decision.valuationBasisRevision,
        decision.warehouseId,
        decision.approvedBy,
        decision.approvalReason,
        decision.decidedAt,
      ],
    );
  }

  async listByDocument(companyId: string, documentId: string) {
    const rows = await this.db.query<DecisionRow>(
      "SELECT * FROM sales_below_cost_decisions WHERE company_id=? AND document_id=? ORDER BY decided_at,line_id",
      [companyId, documentId],
    );
    return Object.freeze(rows.map(mapDecisionRow));
  }
}

type ValuationPolicyRow = {
  policy_id: string;
  method: "fifo" | "moving_average";
  strategy_version: number;
  currency: string;
  revision: number;
};

type LayerRow = {
  cost_layer_id: string;
  remaining_quantity: string;
  remaining_cost: number;
  currency: string;
  revision: number;
  source_valuation_entry_id: string;
  opened_business_date: string;
  opened_business_order: number;
};

type StateRow = {
  zone_key: string;
  location_key: string;
  business_date: string;
  quantity: string;
  total_cost: number | null;
  unresolved_count: number;
  currency: string;
  strategy_version: number;
  policy_id: string;
};

export class SqliteSalesInventoryCostQuotePort implements SalesInventoryCostQuotePort {
  constructor(private readonly db: DatabaseSession) {}

  async quote(input: {
    companyId: string;
    productId: string;
    warehouseId: string;
    businessDate: string;
    quantity: string;
    currency: string;
  }): Promise<SalesInventoryCostQuote | null> {
    const policy = await this.db.queryOne<ValuationPolicyRow>(
      "SELECT policy_id,method,strategy_version,currency,revision FROM inventory_valuation_policies WHERE company_id=? AND effective_from<=? ORDER BY effective_from DESC,revision DESC LIMIT 1",
      [input.companyId, input.businessDate],
    );
    if (!policy || policy.currency !== input.currency) {
      return null;
    }

    const quotedAt = new Date().toISOString();

    if (policy.method === "fifo") {
      const rows = await this.db.query<LayerRow>(
        "SELECT cost_layer_id,remaining_quantity,remaining_cost,currency,revision,source_valuation_entry_id,opened_business_date,opened_business_order FROM inventory_valuation_cost_layers WHERE company_id=? AND product_id=? AND warehouse_id=? AND remaining_quantity<>'0' ORDER BY opened_business_date,opened_business_order,cost_layer_id",
        [input.companyId, input.productId, input.warehouseId],
      );
      if (!rows.length || rows.some(row => row.currency !== input.currency)) {
        return null;
      }

      try {
        const state: InventoryFifoLayerState[] = rows.map(row => ({
          layerId: row.cost_layer_id,
          remainingQuantity: row.remaining_quantity,
          remainingCost: row.remaining_cost,
          currency: row.currency,
        }));
        const result = fifoInventoryValuationStrategy.issue(
          { layers: state },
          { quantity: input.quantity, currency: input.currency },
        );
        const layerRevisions = rows
          .map(row => `${row.cost_layer_id}@${row.revision}`)
          .join("|");
        const valuationBasisRevision = `fifo:${policy.policy_id}:${policy.revision}:${layerRevisions}`;
        return Object.freeze({
          quoteId: `quote:${input.productId}:${input.warehouseId}:${valuationBasisRevision}:${input.quantity}`,
          companyId: input.companyId,
          productId: input.productId,
          warehouseId: input.warehouseId,
          businessDate: input.businessDate,
          quantity: result.quantity,
          currency: result.currency,
          unitCost: result.unitCost,
          totalCost: result.totalCost,
          method: "fifo",
          strategyVersion: policy.strategy_version,
          valuationBasisRevision,
          quotedAt,
        });
      } catch {
        return null;
      }
    }

    const rows = await this.db.query<StateRow>(
      "SELECT zone_key,location_key,business_date,quantity,total_cost,unresolved_count,currency,strategy_version,policy_id FROM inventory_valuation_states WHERE company_id=? AND product_id=? AND warehouse_id=? AND business_date<=? ORDER BY business_date DESC",
      [input.companyId, input.productId, input.warehouseId, input.businessDate],
    );

    // Rows are newest first, so keep the first state for each zone and location.
    const latestStateByLocation = new Map<string, StateRow>();
    for (const row of rows) {
      const key = row.zone_key + "|" + row.location_key;
      if (!latestStateByLocation.has(key)) {
        latestStateByLocation.set(key, row);
      }
    }

    const latestStates = [...latestStateByLocation.values()];
    if (
      !latestStates.length
      || latestStates.some(row =>
        row.unresolved_count > 0
        || row.total_cost === null
        || row.currency !== input.currency
      )
    ) {
      return null;
    }

    const quantity = latestStates.reduce((sum, row) => sum + Number(row.quantity), 0);
    const totalCost = latestStates.reduce((sum, row) => sum + (row.total_cost ?? 0), 0);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity < Number(input.quantity)) {
      return null;
    }

    try {
      const state: InventoryMovingAverageState = {
        quantity: String(quantity),
        totalCost,
        currency: input.currency,
      };
      const result = movingAverageInventoryValuationStrategy.issue(state, {
        quantity: input.quantity,
        currency: input.currency,
      });
      const stateRevisions = latestStates
        .map(row => `${row.zone_key}/${row.location_key}@${row.business_date}`)
        .join("|");
      const valuationBasisRevision = `moving_average:${policy.policy_id}:${policy.revision}:${stateRevisions}`;
      return Object.freeze({
        quoteId: `quote:${input.productId}:${input.warehouseId}:${valuationBasisRevision}:${input.quantity}`,
        companyId: input.companyId,
        productId: input.productId,
        warehouseId: input.warehouseId,
        businessDate: input.businessDate,
        quantity: result.quantity,
        currency: result.currency,
        unitCost: result.unitCost,
        totalCost: result.totalCost,
        method: "moving_average",
        strategyVersion: policy.strategy_version,
        valuationBasisRevision,
        quotedAt,
      });
    } catch {
      return null;
    }
  }
}
