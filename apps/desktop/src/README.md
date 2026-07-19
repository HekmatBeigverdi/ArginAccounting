# Desktop Source Structure

## app

Application-wide infrastructure:

- Routing
- Shell
- Navigation
- Providers

## pages

Route-level page composition.

Pages may compose multiple feature components but must not contain
database infrastructure or domain logic.

## features

Reusable business-oriented user interface components.

## components

Application-wide visual components that are not owned by one business
module.

## styles

Global design tokens and shared style foundations.

## Rule

Do not add feature forms directly to `App.tsx`.

Every major feature must be exposed through an independent page.
