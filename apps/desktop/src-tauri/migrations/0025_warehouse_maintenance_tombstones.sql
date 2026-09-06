PRAGMA foreign_keys = ON;

ALTER TABLE warehouse_zones
ADD COLUMN deleted_at TEXT;

ALTER TABLE warehouse_locations
ADD COLUMN deleted_at TEXT;

CREATE INDEX ix_warehouse_zones_tombstones
ON warehouse_zones(company_id, warehouse_id, deleted_at, id)
WHERE deleted_at IS NOT NULL;

CREATE INDEX ix_warehouse_locations_tombstones
ON warehouse_locations(company_id, warehouse_id, zone_id, deleted_at, id)
WHERE deleted_at IS NOT NULL;

CREATE INDEX ix_warehouse_zones_active_lookup
ON warehouse_zones(company_id, warehouse_id, code, id)
WHERE deleted_at IS NULL;

CREATE INDEX ix_warehouse_locations_active_lookup
ON warehouse_locations(company_id, warehouse_id, zone_id, code, id)
WHERE deleted_at IS NULL;
