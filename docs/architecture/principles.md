# Architecture Principles

## 1. Accounting Core First

The accounting core is the foundation of the platform.

Operational modules must use the accounting core through defined contracts.

## 2. UI Independence

Business rules must not be implemented inside React components.

## 3. Database Independence

Domain models must not depend on SQLite, PostgreSQL, or EF Core.

## 4. Offline First

The desktop application must remain fully operational without internet access.

## 5. Web Ready

Application contracts must support future remote APIs.

## 6. Modular Design

Each module has explicit ownership of its domain logic.

## 7. Immutable Posted Documents

Draft documents may be edited.

Posted documents must be reversed or corrected through explicit accounting operations.

## 8. Auditability

Critical operations must record:

- User
- Timestamp
- Action
- Previous values
- New values
- Source document

## 9. Atomic Operations

Operations that generate multiple documents must execute atomically.

## 10. Idempotency

Integration operations must prevent duplicate processing.

## 11. Iranian Accounting Compatibility

The product must support:

- Persian UI
- Rial currency
- Jalali calendar
- Iranian chart of accounts patterns
- Floating detail accounts
- Iranian tax requirements
- Iranian accounting reports
