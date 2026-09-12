PRAGMA foreign_keys = ON;

CREATE TABLE inventory_valuation_policies (
    policy_id TEXT PRIMARY KEY NOT NULL,
    company_id TEXT NOT NULL,
    method TEXT NOT NULL CHECK (method IN ('fifo','moving_average')),
    strategy_version INTEGER NOT NULL CHECK (strategy_version > 0),
    currency TEXT NOT NULL,
    effective_from TEXT NOT NULL,
    previous_policy_id TEXT NULL,
    change_reason TEXT NULL,
    revision INTEGER NOT NULL CHECK (revision > 0),
    FOREIGN KEY (previous_policy_id) REFERENCES inventory_valuation_policies(policy_id),
    UNIQUE (company_id, effective_from),
    UNIQUE (company_id, revision)
);

CREATE INDEX idx_inventory_valuation_policies_company_effective
    ON inventory_valuation_policies(company_id, effective_from, revision);

CREATE TABLE inventory_valuation_cost_inputs (
    basis_line_id TEXT PRIMARY KEY NOT NULL,
    company_id TEXT NOT NULL,
    movement_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    warehouse_id TEXT NOT NULL,
    quantity TEXT NOT NULL,
    currency TEXT NOT NULL,
    base_cost INTEGER NOT NULL CHECK (base_cost >= 0),
    landed_cost INTEGER NOT NULL CHECK (landed_cost >= 0),
    total_cost INTEGER NOT NULL CHECK (total_cost >= 0),
    unit_cost TEXT NOT NULL,
    allocations_json TEXT NOT NULL DEFAULT '[]',
    revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
    UNIQUE (company_id, movement_id)
);

CREATE INDEX idx_inventory_valuation_cost_inputs_product
    ON inventory_valuation_cost_inputs(company_id, product_id, movement_id);

CREATE TABLE inventory_valuation_entries (
    valuation_entry_id TEXT PRIMARY KEY NOT NULL,
    company_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    movement_id TEXT NOT NULL,
    document_id TEXT NOT NULL,
    line_id TEXT NOT NULL,
    reversal_of_movement_id TEXT NULL,
    transfer_id TEXT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('inbound','outbound','transfer','reversal')),
    method TEXT NOT NULL CHECK (method IN ('fifo','moving_average')),
    strategy_version INTEGER NOT NULL CHECK (strategy_version > 0),
    currency TEXT NOT NULL,
    warehouse_id TEXT NOT NULL,
    zone_id TEXT NULL,
    location_id TEXT NULL,
    business_date TEXT NOT NULL,
    business_order INTEGER NOT NULL CHECK (business_order > 0),
    quantity TEXT NOT NULL,
    unit_cost TEXT NULL,
    total_cost INTEGER NULL,
    cost_state TEXT NOT NULL CHECK (cost_state IN ('resolved','unresolved')),
    unresolved_reason TEXT NULL,
    valued_at TEXT NULL,
    revision INTEGER NOT NULL CHECK (revision > 0),
    UNIQUE (company_id, movement_id),
    CHECK ((cost_state='resolved' AND unit_cost IS NOT NULL AND total_cost IS NOT NULL AND unresolved_reason IS NULL)
        OR (cost_state='unresolved' AND unit_cost IS NULL AND total_cost IS NULL AND unresolved_reason IS NOT NULL))
);

CREATE INDEX idx_inventory_valuation_entries_company_product_chronology
    ON inventory_valuation_entries(company_id, product_id, business_date, business_order, document_id, line_id, movement_id);
CREATE INDEX idx_inventory_valuation_entries_unresolved
    ON inventory_valuation_entries(company_id, cost_state, product_id, business_date);
CREATE INDEX idx_inventory_valuation_entries_transfer
    ON inventory_valuation_entries(company_id, transfer_id) WHERE transfer_id IS NOT NULL;
CREATE INDEX idx_inventory_valuation_entries_reversal
    ON inventory_valuation_entries(company_id, reversal_of_movement_id) WHERE reversal_of_movement_id IS NOT NULL;

CREATE TABLE inventory_valuation_cost_layers (
    cost_layer_id TEXT PRIMARY KEY NOT NULL,
    company_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    source_movement_id TEXT NOT NULL,
    source_valuation_entry_id TEXT NOT NULL,
    method TEXT NOT NULL CHECK (method='fifo'),
    strategy_version INTEGER NOT NULL CHECK (strategy_version > 0),
    currency TEXT NOT NULL,
    warehouse_id TEXT NOT NULL,
    zone_id TEXT NULL,
    location_id TEXT NULL,
    opened_business_date TEXT NOT NULL,
    opened_business_order INTEGER NOT NULL CHECK (opened_business_order > 0),
    original_quantity TEXT NOT NULL,
    remaining_quantity TEXT NOT NULL,
    unit_cost TEXT NOT NULL,
    original_cost INTEGER NOT NULL CHECK (original_cost >= 0),
    remaining_cost INTEGER NOT NULL CHECK (remaining_cost >= 0),
    revision INTEGER NOT NULL CHECK (revision > 0),
    FOREIGN KEY (source_valuation_entry_id) REFERENCES inventory_valuation_entries(valuation_entry_id) ON DELETE CASCADE
);

CREATE INDEX idx_inventory_valuation_layers_product_chronology
    ON inventory_valuation_cost_layers(company_id, product_id, opened_business_date, opened_business_order, cost_layer_id);
CREATE INDEX idx_inventory_valuation_layers_stock
    ON inventory_valuation_cost_layers(company_id, product_id, warehouse_id, zone_id, location_id, remaining_quantity);

CREATE TABLE inventory_valuation_states (
    company_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    warehouse_id TEXT NOT NULL,
    zone_key TEXT NOT NULL DEFAULT '',
    location_key TEXT NOT NULL DEFAULT '',
    business_date TEXT NOT NULL,
    policy_id TEXT NOT NULL,
    method TEXT NOT NULL CHECK (method IN ('fifo','moving_average')),
    strategy_version INTEGER NOT NULL CHECK (strategy_version > 0),
    currency TEXT NOT NULL,
    quantity TEXT NOT NULL,
    total_cost INTEGER NULL,
    unresolved_count INTEGER NOT NULL DEFAULT 0 CHECK (unresolved_count >= 0),
    PRIMARY KEY (company_id, product_id, warehouse_id, zone_key, location_key, business_date),
    FOREIGN KEY (policy_id) REFERENCES inventory_valuation_policies(policy_id)
);

CREATE INDEX idx_inventory_valuation_states_company_product_date
    ON inventory_valuation_states(company_id, product_id, business_date, warehouse_id);

CREATE TRIGGER tr_inventory_valuation_policies_no_update
BEFORE UPDATE ON inventory_valuation_policies
BEGIN
    SELECT RAISE(ABORT, 'inventory valuation policy history is append-only');
END;

CREATE TRIGGER tr_inventory_valuation_policies_no_delete
BEFORE DELETE ON inventory_valuation_policies
BEGIN
    SELECT RAISE(ABORT, 'inventory valuation policy history is append-only');
END;
