# Module Guidelines

Each business capability is a cohesive module with explicit domain, application, infrastructure, and UI boundaries.

## Required Elements

- Purpose and ownership
- Domain entities, value objects, invariants, and events
- Application commands, queries, and authorization
- Repository and Unit of Work contracts
- Infrastructure adapters and migrations
- UI routes, providers, and permission gates
- Tests and module documentation

## Dependency Rules

Modules may depend on shared platform contracts and published contracts of other modules. They must not import another module's private implementation or write directly to its tables.

## Data Ownership

One module owns each table and aggregate. Read models may join or project data through approved query infrastructure, but write ownership remains singular.

## Integration

Use synchronous application contracts for immediate consistency and domain/application events for decoupled reactions. External integrations use adapters and an anti-corruption layer.

## Completion Checklist

A module is incomplete without permissions, audit policy, migrations, concurrency policy, error model, tests, documentation, and operational validation.