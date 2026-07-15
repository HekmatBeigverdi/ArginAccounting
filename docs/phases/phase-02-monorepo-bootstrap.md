# Phase 02 - Monorepo Bootstrap

## Goal

Create the executable monorepo foundation for ArginAccounting.

## Scope

- pnpm workspace
- Turborepo
- Next.js web application
- Tauri desktop application
- Shared package
- Core package
- UI package
- Shared configuration package
- Persian and RTL bootstrap
- TypeScript workspace validation

## Runtime Targets

### Desktop

- React
- TypeScript
- Tauri

### Web

- Next.js
- React
- TypeScript

## Architecture Notes

The desktop and web applications must consume shared contracts.

Business rules must not be implemented directly inside UI components.

The desktop app is the first production runtime.

The web app exists from the beginning to preserve architectural compatibility.

## Localization

- User interface language: Persian
- Layout direction: RTL
- Currency: Iranian Rial
- Calendar presentation: Jalali
- Technical identifiers: English

## Acceptance Criteria

- pnpm workspace installs successfully
- Turbo tasks run successfully
- Web app starts
- Desktop app starts
- Persian text is displayed
- RTL direction is active
- Shared and core packages pass type checking
