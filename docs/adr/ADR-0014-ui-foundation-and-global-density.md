# ADR-0014 — UI Foundation and Global Display Density

- Status: Accepted
- Date: 2026-08-22
- Decision Owners: Project maintainers

## Context

By the end of Phase 13, ArginAccounting had two presentation generations. Foundation-era screens used temporary shell/workspace patterns, while the Accounting Core introduced denser, workspace-oriented Persian RTL interfaces. Continuing feature delivery without consolidation would duplicate navigation, feedback, form, table, accessibility, and responsive patterns and make later ERP modules increasingly expensive to harmonize.

ArginAccounting is a desktop-first, local-first accounting product. Operational users need substantially denser information presentation than a typical web/SaaS interface, but density requirements vary between professional keyboard/mouse users and readability- or touch-oriented users.

Phase 14 therefore needed an architectural presentation decision, not only page-level restyling.

## Decision

### Presentation architecture

Desktop presentation follows five layers:

1. design tokens;
2. shared primitives;
3. shared composites and application-shell presentation;
4. feature UI;
5. route pages.

The allowed dependency direction is:

```text
pages -> features -> shared composites/primitives -> tokens
app shell -> shared composites/primitives -> tokens
```

Shared presentation code must not depend on SQLite, Tauri persistence adapters, repositories, or feature business rules. Domain and Application authorization and validation remain authoritative.

### Persian RTL desktop baseline

Persian and RTL are the default user-facing presentation. Solar Hijri is used for user-facing dates while durable dates remain canonical Gregorian. Iranian Rial remains the primary accounting currency presentation. Mixed Persian/Latin identifiers and numeric values may use local LTR isolation without changing the surrounding RTL layout.

The initial Tauri desktop window baseline is 1366 × 768, with responsive degradation rather than brittle fixed layouts.

### Final application shell

The application uses one shared App Shell for grouped navigation, active Company/Branch/Fiscal context, page workspace composition, session/runtime presentation, and global display preferences. Feature pages must not recreate their own global shell or persistence boundary.

### Global display density

Display density is a global application preference, not an Accounting-only option. Three supported levels are defined:

- `compact` — professional high-density accounting and ERP work;
- `comfortable` — default and still materially denser than the pre-Phase-14 interface;
- `spacious` — readability/touch-oriented presentation.

The preference is applied at the document root through `data-density` and shared design-system tokens, persisted locally under `argin.ui.display-density`, restored at startup, and safely falls back to `comfortable` for missing or invalid values.

Feature workspaces consume shared density tokens rather than inventing page-specific density systems.

### Operational workspace behavior

High-frequency accounting surfaces prefer workspace-height layouts with contained tree/grid scrolling, sticky headers, compact controls and forms, and local horizontal overflow where required. The application shell itself must not be forced into destructive horizontal scrolling by wide accounting data.

Chart of Accounts and similar hierarchies use compact semantic trees with restrained indentation, code-plus-title identity, fast expand/collapse, parent-preserving search where implemented, and accessible hierarchy semantics.

### Accessibility and feedback

Keyboard reachability, visible focus, semantic landmarks, mixed RTL/LTR isolation, reduced-motion behavior, loading, empty, validation-error, technical-error, warning, success, confirmation, disabled, and read-only states are presentation contracts rather than optional page-specific decoration.

User-facing feedback is Persian and actionable. Technical diagnostics may be exposed separately where useful but do not replace the user-facing explanation.

### Phase boundary

This decision is presentation-only. It does not introduce Journal posting, approval, locking, reversal, replacement, voiding, finalization, controlled amendment, or other Phase 15 Journal Lifecycle behavior. It does not move accounting Domain/Application rules into React.

## Consequences

### Positive

- Later ERP phases inherit one presentation architecture instead of creating a third UI generation.
- Foundation and Accounting workspaces can share shell, tokens, controls, feedback, accessibility, and density behavior.
- Professional accounting users can select compact presentation without forcing that density on every user.
- Density changes propagate through shared tokens and remain compatible with future workspaces.
- Business and persistence boundaries remain independent from React presentation concerns.

### Trade-offs

- Shared design-system changes have broad visual impact and therefore require regression coverage.
- Feature-specific tables and trees still own their semantic columns, editors, totals, and business actions.
- A global density preference requires components to consume shared tokens consistently; hard-coded dimensions reduce its effectiveness.
- Desktop-first density must still degrade safely at smaller supported window sizes.

## Rejected Alternatives

- Continue page-specific Foundation and Accounting styling: rejected because it compounds visual and maintenance divergence.
- Make density an Accounting-only preference: rejected because Company, Fiscal, Security, Audit, Approval, and future ERP modules also benefit from a consistent global presentation contract.
- Use only one fixed compact density: rejected because readability and touch-oriented scenarios require a less dense option.
- Put persistence or business rules inside shared React components: rejected because it violates established Domain/Application boundaries and future Argin Bridge portability.
- Use oversized web/SaaS card layouts as the desktop default: rejected because operational accounting requires higher information density and contained data surfaces.

## Implementation Notes

- Canonical UI architecture: `docs/ui/UI_ARCHITECTURE.md`
- Phase audit: `docs/ui/phase-14-ui-architecture-audit.md`
- Phase record: `docs/phases/phase-14-ui-foundation-consolidation.md`
- Fixed plan: `docs/phases/phase-14-ui-foundation-consolidation-plan.md`
- Design tokens: `apps/desktop/src/styles/design-tokens.css`
- Density provider: `apps/desktop/src/app/providers/display-density-provider.tsx`
- App Shell: `apps/desktop/src/app/shell/app-shell.tsx`

## Related Documents

- [Phase 14 — Fixed Implementation Plan](../phases/phase-14-ui-foundation-consolidation-plan.md)
- [Phase 14 — Implementation Record](../phases/phase-14-ui-foundation-consolidation.md)
- [UI Architecture](../ui/UI_ARCHITECTURE.md)
- [Phase 14 UI Architecture Audit](../ui/phase-14-ui-architecture-audit.md)
- [ADR-0001 — Offline-First Architecture](ADR-0001-offline-first.md)
- [ADR-0002 — Database-Independent Domain](ADR-0002-database-independent-domain.md)
- [ADR-0006 — Application Service Boundary](ADR-0006-application-services.md)
- [ADR-0013 — Journal Voucher Engine Architecture](ADR-0013-journal-voucher-engine.md)
