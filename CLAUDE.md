# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EZDP frontend — a Vue 3 + pnpm monorepo based on **Vben Admin v5.5.9**, using Ant Design Vue as the UI library. It's the frontend for a deployment management platform.

## Common Commands

```bash
pnpm install              # Install dependencies
pnpm dev:ezdp             # Start dev server (port 5666, proxies /server to 127.0.0.1:8080)
pnpm build:ezdp           # Build web-ezdp for production
pnpm lint                 # Run ESLint, Stylelint, commitlint, cspell
pnpm format               # Format code
pnpm check:type           # Type checking
pnpm test:unit            # Run Vitest unit tests
pnpm test:e2e             # Run Playwright e2e tests
```

## Monorepo Structure

```
frontend/
├── apps/web-ezdp/          # Main SPA application
├── packages/
│   ├── @core/              # Core base (shared, design, icons, composables, ui-kit, preferences)
│   ├── effects/            # Higher-level packages:
│   │   ├── access/         #   @vben/access — permission system
│   │   ├── hooks/          #   @vben/hooks — Vue composables
│   │   ├── layouts/        #   @vben/layouts — BasicLayout, widgets, auth layout
│   │   ├── request/        #   @vben/request — Axios-based HTTP client
│   │   └── common-ui/      #   @vben/common-ui — shared UI components
│   ├── stores/             # @vben/stores — Pinia stores (access, user, business, tabbar)
│   ├── locales/            # @vben/locales — i18n system
│   ├── types/              # @vben/types — shared TypeScript types
│   ├── constants/          # @vben/constants
│   ├── icons/              # @vben/icons
│   ├── styles/             # @vben/styles
│   ├── preferences/        # @vben/preferences
│   └── utils/              # @vben/utils
├── internal/
│   ├── vite-config/        # @vben/vite-config — shared Vite config
│   ├── tsconfig/           # @vben/tsconfig
│   ├── tailwind-config/    # @vben/tailwind-config
│   └── lint-configs/       # ESLint, Stylelint, Commitlint, Prettier configs
└── scripts/                # @vben/vsh (CLI), @vben/turbo-run
```

**Build system:** pnpm workspaces + Turborepo. Dependencies are centralized via `pnpm-workspace.yaml` catalog.

## App Source Layout (apps/web-ezdp/src/)

```
src/
├── main.ts                 # Entry — loads preferences, then bootstrap.ts
├── bootstrap.ts            # Creates Vue app, sets up i18n, Pinia, router, access, WebSocket
├── app.vue                 # Root component (<RouterView /> with ConfigProvider)
├── preferences.ts          # App-level preference overrides (name, access mode, /workspace default)
├── api/
│   ├── request.ts          # Request client — axios interceptors, token, response { code: 0, data }
│   ├── core/               # Auth, user, business, menu, notification APIs
│   ├── system/             # User mgmt, roles, business lines, config APIs
│   ├── deploy-tools/       # Build/deploy agents, secrets, object storage
│   ├── project-management/ # Project/build/deploy configs, git repos
│   ├── package-deploy-management/ # Branches, packages, deploys
│   └── server-management/  # Server APIs
├── router/
│   ├── index.ts            # vue-router (hash/history based on env)
│   ├── guard.ts            # Route guards — progress bar, access control, dynamic route gen
│   ├── access.ts           # Generates routes from backend menus
│   └── routes/
│       ├── core.ts         # Workspace, auth pages, 404
│       ├── index.ts        # Merges core + dynamic + static routes
│       └── modules/        # Dynamic route modules
├── store/
│   ├── auth.ts             # Auth store (login, logout, fetchUserInfo, business line init)
│   └── websocket.ts        # WebSocket store (global WS, log subscriptions, log viewer)
├── views/                  # Page components by feature
│   ├── dashboard/          # Workspace, analytics
│   ├── project-management/ # Project config, git repo, releases
│   ├── server-management/  # Servers, environment agents
│   ├── deploy-tools/       # Build/deploy agents, secrets, object storage
│   ├── package-deploy-management/ # Branches, env config, deploy, packages
│   ├── notification-management/   # Channels, scenarios, announcements
│   ├── usermanage/         # Users and roles
│   ├── system/             # Business line management
│   └── _core/              # Auth pages, fallback, about
├── layouts/
│   ├── basic.vue           # Main layout — wraps @vben/layouts with custom slots
│   └── auth.vue            # Auth page layout
└── components/             # App-specific components (LogViewer, etc.)
```

## API Layer Conventions

- **Response format:** `{ code: 0, data: ... }` — success when `code === 0`
- **Token handling:** `requestClient` auto-attaches `Authorization: Bearer <token>` and `Accept-Language`
- **Token expiry:** `code: 2` triggers logout and redirect
- **Two clients:** `requestClient` (returns `data` directly) and `baseRequestClient` (returns full response)
- **All APIs use POST** — no RESTful verbs
- **Path convention:** `/server/ezdp/tk/*` (authenticated) or `/server/ezdp/nc/*` (no auth)
- **Dev proxy:** `/server` → `http://127.0.0.1:8080`

## Routing & Access Control

- **Mode:** Hash mode by default (`VITE_ROUTER_HISTORY=hash`)
- **Access:** Backend-driven (`accessMode: 'backend'`). Guard fetches menus from backend, then uses `@vben/access` `generateAccessible` to build allowed routes.
- **Default home:** `/workspace`
- **Dynamic routes:** Loaded from `router/routes/modules/*.ts` via `import.meta.glob`
- **View lazy-loading:** `import.meta.glob('../views/**/*.vue')`

## Key @vben/* Packages to Know

- `@vben/access` — `generateAccessible` for route permission control
- `@vben/stores` — `useBusinessStore()` for business line permissions, `useUserStore()` for user info
- `@vben/request` — `RequestClient` wrapping axios
- `@vben/layouts` — `BasicLayout`, `UserDropdown`, `Notification`, `LockScreen`
- `@vben/hooks` — shared Vue composables

## Tech Stack

- Vue 3 (Composition API, `<script setup>`) + TypeScript 5.8
- Vite 7.1 + Turborepo
- Pinia 3 + vue-router 4
- Ant Design Vue 4 + TailwindCSS 3
- pnpm 10.14 (enforced via `preinstall: npx only-allow pnpm`)
- Git hooks: Lefthook
