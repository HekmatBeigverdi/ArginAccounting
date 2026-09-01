# Phase 18 Step 14 — Product/Service UI Corrections

This note records repository-owner feedback applied after the initial completion of Step 14 without changing the frozen Phase 18 sequence.

## Corrections

- Product/Service form validation now maintains field-level error state. Known Domain/Application error codes are mapped back to the relevant input(s), invalid controls expose `aria-invalid`, receive a visible error border/focus treatment, and show the localized message adjacent to the field.
- Added lightweight pre-submit field validation for required code/title, 13-digit Taxpayer goods/service identifier, unit precision, taxable VAT rate, stock-tracking dependencies, and shelf-life shape. Domain/Application remain authoritative; React validation is presentation feedback only.
- Replaced manual base-unit title/code entry with a searchable unit selector backed by active rows from the versioned `taxpayer_units` reference table.
- Selecting an official unit automatically derives the Product unit title, internal unit identity/code, and Taxpayer unit code. Users no longer need to type the official unit code manually.
- Reference lookup SQL is isolated in the Desktop composition adapter `taxpayer-unit-options.ts`; the React page consumes bounded option DTOs rather than embedding SQL.
- Added an accessible question-mark help affordance beside form fields. Help text is available by hover and keyboard focus and explains field purpose and downstream semantics without permanently expanding the dense accounting form.
- Added dedicated validation/help CSS using the Phase 14 `--ui-*` design tokens and preserving Compact/Comfortable/Spacious density behavior.

## Files

- `apps/desktop/src/pages/product/products-page.tsx`
- `apps/desktop/src/pages/product/products-page-validation.css`
- `apps/desktop/src/pages/product/taxpayer-unit-options.ts`

## Validation

Local validation remains required:

```bash
pnpm --filter @argin/desktop typecheck
pnpm --filter @argin/desktop build
```

The correction does not start Step 15 and does not change the Phase 18 Step Status table.
