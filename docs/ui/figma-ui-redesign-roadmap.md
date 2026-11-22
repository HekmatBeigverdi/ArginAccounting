# Figma-Driven UI Redesign Roadmap

## Status

Roadmap recorded on `feature/figma-ui-redesign`. Work is planned as reviewable steps; implementation changes must remain on this branch until explicitly promoted.

## Purpose

Refresh the ArginAccounting user interface through a Figma-led design and implementation workflow while preserving accounting behavior, module boundaries, offline operation, and the established Persian-first experience.

The product baseline is a React + TypeScript + Tauri desktop application. Existing UI architecture and Phase 14 design-system rules remain authoritative for implementation constraints. Figma defines the approved visual and interaction specification; application code remains authoritative for business behavior and validation.

## Guiding Constraints

- Persian-first, right-to-left layouts; isolate left-to-right content such as identifiers and amounts where needed.
- Preserve Jalali dates in the user interface and Gregorian storage in the application.
- Reuse shared design tokens and primitives; avoid module-specific duplicate components.
- Keep domain and application behavior outside presentation components.
- Preserve keyboard access, focus visibility, accessibility, density options, and responsive containment.
- Specify loading, empty, error, success, disabled, and permission-limited states for every changed workflow.
- Do not remove existing capabilities as part of a visual redesign unless a separately reviewed change requests it.
- Keep financial values, totals, account codes, and document statuses precise and traceable.

## Fixed Steps

| Step | Name | Scope | Exit evidence | Status |
|---|---|---|---|---|
| 1 | UI and Figma Baseline Audit | Inventory current application shell, design tokens, reusable components, and target workflows; map Figma pages/frames to current screens and note behavior that must remain unchanged. | Auditable screen-to-route/component map, gap list, Figma file/page references, and agreed first implementation slice. | Not started |
| 2 | Workflow and Information Architecture | Confirm navigation, task flows, key actions, page hierarchy, and screen-level requirements before visual detailing. | Approved flow diagrams or Figma prototypes for the selected workflows, including role and permission states. | Not started |
| 3 | Figma Design System | Define or reconcile color, typography, spacing, sizing, elevation, iconography, form, table, modal, and feedback tokens/components with the existing shared UI foundation. | Figma library with documented token names, component variants, and RTL/LTR examples. | Not started |
| 4 | Application Shell and Shared Patterns | Design the shell, navigation, global company/branch/fiscal context, page headers, filters, action bars, dialogs, and common feedback patterns. | Approved shell and shared-pattern frames covering compact, comfortable, and spacious density. | Not started |
| 5 | Priority Workflow Designs | Apply the shared system to selected operational screens, prioritizing dashboard, sales, purchases, inventory, and accounting reports according to the baseline audit. | Each selected workflow has linked frames, interaction notes, and all required state variants. | Not started |
| 6 | Design-to-Code Mapping | Map approved Figma components and variables to existing React components and tokens; identify only the code changes required to realize the approved design. | Component/token mapping with explicit reuse, extension, and new-component decisions. | Not started |
| 7 | Incremental Implementation and Review | Implement one approved slice at a time on this branch; compare the running application with Figma and preserve existing business behavior. | Per-slice change summary, visual comparison, and recorded regression/acceptance evidence. | Not started |
| 8 | Accessibility, RTL, and Density Review | Review keyboard flows, focus, contrast, screen resizing, RTL/LTR isolation, date/number presentation, and all density modes across changed screens. | Completed checklist with issues resolved or explicitly recorded for follow-up. | Not started |
| 9 | Documentation and Handoff | Update canonical UI documentation, component guidance, and roadmap statuses; prepare the finished branch for owner review. | Verified documentation links, completed step evidence, and a reviewable branch/PR summary. | Not started |

## Step 1 Working Checklist

- Identify the active Figma file and its current pages, frames, components, variables, and libraries.
- Inventory current routes/screens and their source components in `apps/desktop` and `apps/web`.
- Record shared UI tokens and primitives already defined by Phase 14.
- Map each target Figma frame to an existing route and component; mark new or ambiguous screens.
- Capture the existing user actions, permissions, validation, and data states that the redesign must preserve.
- Agree the first implementation slice before editing application code.

## Branch and Delivery Policy

- Working branch: `feature/figma-ui-redesign`.
- Base branch: `main` at `90e59134f326f6a8357578e7fc66afea0a108592` when this roadmap branch was created.
- Keep Figma exploration and implementation changes isolated to this branch.
- Do not merge, tag, release, or deploy as part of roadmap setup.
- Review each step as a separate checkpoint. Update the step status and evidence here only after the corresponding work is completed and reviewed.

## References

- [UI Architecture](../ui/UI_ARCHITECTURE.md)
- [Phase 14 — UI Foundation Consolidation](../phases/phase-14-ui-foundation-consolidation.md)
- [Phase 14 UI Architecture Audit](../ui/phase-14-ui-architecture-audit.md)
- [Product Vision](product-vision.md)
