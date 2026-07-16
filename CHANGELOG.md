# Changelog

All notable changes to this project will be documented here.

---

## v0.1.0

### Added

- Public repository
- Architecture baseline
- Architecture decisions
- Localization strategy
- Module map
- Future roadmap

## [0.4.0] - Unreleased

- Database-independent persistence contracts
- Tauri SQLite infrastructure adapter
- Official Tauri SQL plugin
- Versioned SQLite migration support
- Local database health check
- Desktop database status component

### Architecture

- Database contracts are isolated from SQLite and Tauri
- Desktop migrations are registered through the Rust plugin
- Business schema creation is deferred to domain phases
