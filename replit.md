# FlipStudio

Professional 2D animation studio web app — draw frame-by-frame animations, manage layers, preview with onion skinning, and export as GIF, MP4, WebM, or PNG sequences.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000 / 8080)
- `pnpm --filter @workspace/flipstudio run dev` — run the frontend (Vite, dynamic port)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite 7 + Wouter routing + Tanstack Query
- API: Express 5, Orval-generated client hooks from OpenAPI spec
- DB: PostgreSQL + Drizzle ORM (`lib/db`)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec in `lib/api-spec`)
- Build: esbuild (CJS bundle for API)
- CI: GitHub Actions (`.github/workflows/build-apk.yml`) — builds web + Android APK via Capacitor

## Where things live

- `lib/db/src/schema/projects.ts` — DB schema (projects, frames, layers, exports, audio_tracks)
- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth for API shape)
- `lib/api-client-react/` — Orval-generated React Query hooks (do not edit manually)
- `lib/api-zod/` — Orval-generated Zod schemas (do not edit manually)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/flipstudio/src/pages/` — React pages (dashboard, studio, export-page, new-project)
- `artifacts/flipstudio/src/index.css` — Design tokens (dark violet theme)

## Architecture decisions

- **Contract-first API** — OpenAPI spec is written first, then Orval generates type-safe React Query hooks and Zod validators. Never hand-write API client code.
- **Canvas rendering** — HTML5 Canvas with quadratic bezier smoothing. Stroke data (points array + tool/color/size/opacity) stored as JSON in `frames.canvas_data`. Redraw on frame change.
- **Onion skinning** — previous frame rendered at 30% red tint, next at 30% blue tint, before drawing current frame strokes.
- **Export simulation** — exports are queued in DB and progress is simulated server-side (setTimeout steps). Real encoding would replace the setTimeout block in `exports.ts`.
- **Express 5 mergeParams typing** — child routers use explicit `Request<Params>` generic to satisfy TS since Express 5's `mergeParams: true` doesn't propagate parent param types automatically.

## Product

- **Dashboard** — project grid with stats (total projects, frames, exports), one-click open
- **Drawing Studio** — full-screen editor: tool sidebar (pencil/pen/brush/eraser/fill/move), brush size + opacity sliders, color palette + picker, onion skin toggle, undo/redo, zoom/pan, layers panel
- **Timeline** — horizontal frame strip with add/duplicate/delete, click to navigate, playback controls
- **Export** — format picker (GIF, MP4, WebM, PNG sequence), quality setting, transparent background toggle, live progress polling

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After changing DB schema, run `pnpm --filter @workspace/db run push` then `pnpm run typecheck:libs` to rebuild lib declarations before typechecking leaf packages.
- Never run `pnpm dev` at workspace root — use `restart_workflow` instead.
- The API server must be rebuilt (`dev` script runs `build` then `start`) — restart the workflow after route changes.
- Orval output files in `lib/api-client-react/` and `lib/api-zod/` are auto-generated — run codegen if the spec changes.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
