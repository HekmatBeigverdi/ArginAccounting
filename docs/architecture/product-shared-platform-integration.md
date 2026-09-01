# Product/Service Shared Platform and ERP Integration Boundary

## Purpose

Phase 18 Step 16 verifies that Product/Service Master Data reuses the existing ArginAccounting shared platform capabilities and exposes a forward-only integration boundary for future ERP modules. Product remains a persistence-neutral Master Data bounded context; downstream modules consume Product references but Product does not own their workflows or balances.

## Shared platform reuse

Product/Service reuses existing platform capabilities instead of introducing parallel infrastructure:

- Company scope is explicit on Product commands, reads, imports, exports, and selectors and is enforced at the Application boundary.
- Branch is not part of Product identity. Product definitions are company-scoped master data; future branch-specific availability, pricing, stock, or policies belong to the owning downstream module unless a later approved requirement changes that rule.
- Authorization uses the shared permission catalog and Product permissions under `master-data.products.*`; React controls are not the security boundary.
- Successful Product mutations map persistence-neutral Product audit facts into the shared append-only `@argin/audit` infrastructure in Desktop composition.
- Request/correlation identifiers are carried through Product mutation contexts and audit metadata.
- Optimistic concurrency remains explicit through `expectedVersion` and SQLite `version` predicates.
- Multi-write Product persistence uses the shared `@argin/database` transaction abstraction through `ProductUnitOfWork`; Product does not define a second database transaction framework.
- Reads are paged and selectors are bounded. No downstream module should load the complete Product master set merely to render a lookup.
- Durable timestamps stay Gregorian/ISO internally and are localized only at presentation boundaries.
- Product synchronization identity and tombstone metadata remain the persistence-neutral contract established in Step 10. Argin Bridge transport and conflict workflows remain Phase 45.

No Product-specific background-job, notification, event bus, metadata store, authorization store, approval engine, or audit database is introduced in this step. Existing shared platform facilities remain authoritative and new cross-cutting infrastructure requires a concrete later use case.

## Canonical Product ownership

`@argin/product` owns the definition of a Product or Service:

- durable `productId` and company scope;
- display/internal code and title;
- Product versus Service classification;
- active/inactive lifecycle;
- category reference and purchasable/sellable eligibility flags;
- SKU, reference code, barcode(s), external identifiers, and Taxpayer goods/service identifier;
- Product unit profile, deterministic conversion ratios/precision/rounding, and Taxpayer unit mappings;
- commercial descriptions, brand/model, tax treatment/VAT master attributes;
- operational eligibility such as whether a Product is stock-, serial-, lot-, or shelf-life-trackable;
- optimistic version, durable timestamps, import/export contracts, selector contracts, and future synchronization reference metadata.

These are master definitions. They do not imply that Product owns transactional quantities, prices, balances, documents, postings, or workflow state.

## Forward dependency rule

Future modules consume Product through the persistence-neutral selector/reference boundary created in Step 15. The canonical foreign identity is the durable `productId`/`durableId`; `code`, `title`, SKU, barcode, or official Taxpayer identifier are searchable/display/integration metadata and must not replace Product identity in downstream records.

Conceptually the allowed direction is:

`Warehouse / Inventory / Purchases / Sales / Taxpayer / Manufacturing / Cost Accounting -> Product reference contract`

and not:

`Product -> Warehouse / Inventory / Purchases / Sales / Taxpayer workflow / Manufacturing / Cost Accounting`

## Module ownership matrix

| Capability | Owner | Product contribution |
| --- | --- | --- |
| Company identity and company lifecycle | Company/shared platform | Stores `companyId` scope only |
| Branch identity and branch lifecycle | Company/Branch shared platform | No branch-specific Product identity |
| Authorization | Security | Declares/uses Product permissions; does not own users/roles |
| Audit persistence and query | Audit | Emits Product audit facts through composition |
| Approval engine | Approval/Audit | Product does not introduce mandatory approval without an approved workflow |
| Generic metadata platform | Shared Metadata | Product does not duplicate a metadata subsystem |
| Product/Service definition | Product | Full owner |
| Party/customer/supplier identity | Party | No duplicated Party fields or roles in Product |
| Warehouse master data | Phase 19 Warehouse | Product only provides stable Product reference and stock-tracking eligibility |
| Inventory quantities and balances | Inventory | Product defines eligibility/unit semantics only |
| Stock movements/documents | Inventory | Product is referenced by durable id |
| Inventory valuation/cost layers | Inventory Valuation | Product does not calculate or store valuation |
| Purchase documents and supplier terms | Purchases | Selector can require `purchasable`; prices/terms belong to Purchases/pricing owners |
| Sales documents and customer terms | Sales | Selector can require `sellable`; prices/discounts belong to Sales/pricing owners |
| Price lists/base/current prices | Future Sales/Pricing owner | Product intentionally stores no transactional/base price in Phase 18 |
| Taxpayer invoice projection/submission/signing/inquiry | Phases 31–35 | Provides official goods/service and unit identifiers plus tax master attributes |
| Manufacturing BOM/routings/production | Manufacturing | References durable Product ids; Product owns no BOM/production state |
| Cost accounting calculations | Cost Accounting | References durable Product ids; Product owns no cost allocation/balance |
| Journal/posting/account balances | Accounting/Posting | Product owns no account balance, voucher, or posting rule |
| Argin Bridge transport/conflict resolution | Phase 45 Synchronization | Product exposes durable sync/change contract only |

## Party boundary

Party and Product are peer Master Data bounded contexts. Product must not depend on Party merely because future Purchases or Sales combine supplier/customer and Product references in the same document. Those documents own the composition:

`Purchase document -> supplier Party reference + Product reference`

`Sales document -> customer Party reference + Product reference`

There is no reverse `Product -> Party` dependency.

## Pricing boundary

Price is deliberately not a Product master attribute in Phase 18. Purchase cost, sales price, price lists, customer/supplier-specific prices, currency, effective dates, discounts, branch-specific pricing, and historical prices require their own owning transactional/pricing model. Product may provide stable identity, unit and tax metadata to such a model but must not become the price ledger.

## Branch boundary

Product definitions are company-scoped. Future modules may introduce branch-specific stock, warehouse assignment, availability, price list applicability, or operational policies. Those records should reference the same company Product identity rather than create branch-specific Product duplicates.

## Taxpayer boundary

Product owns reusable Taxpayer master identifiers and mappings only. It does not own invoice projection rules, signing, submission, inquiry, correction workflows, or network communication. Those remain Phases 31–35 and must consume Product through stable Product identity plus the official master fields exposed by Product.

## Deferred work

- Warehouse definition remains Phase 19.
- Inventory quantity/movement and valuation remain Phases 20–21.
- Purchase/Sales documents remain their roadmap phases.
- Pricing/list-price behavior is not introduced by Phase 18 and must be assigned to an owning future phase before implementation.
- Taxpayer transactional behavior remains Phases 31–35.
- Manufacturing and Cost Accounting workflows remain their owning future phases.
- Full Argin Bridge network synchronization and conflict resolution remain Phase 45.
