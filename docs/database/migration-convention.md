# ArginAccounting Migration Convention

## Rules

- Every schema change uses a uniquely numbered, ordered migration.
- Released migrations are immutable. Corrections require a new migration.
- Migrations must support both new installations and upgrades from supported versions.
- Prefer additive, backward-compatible changes.
- Destructive operations require a documented data migration, backup strategy, and rollback/recovery plan.
- Constraints, indexes, defaults, and foreign-key delete behavior must be explicit.
- Migrations must be registered in each applicable runtime migration runner.

## Naming

```text
NNNN_short_descriptive_name.sql
```

## Required Documentation

Each migration must be recorded in the owning phase document and database dictionary with purpose, affected objects, compatibility considerations, data transformation, validation procedure, and recovery notes.

## Validation Matrix

- empty database;
- database upgraded from the previous stable version;
- representative existing data;
- constraint and index verification;
- transaction rollback on failure;
- application startup after migration.

Never claim migration validation unless the scenario was actually executed and evidence was recorded.
