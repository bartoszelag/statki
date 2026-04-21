# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Conventions

- UI components go in `src/components/`, game state in `src/store/`
- Variable and file names in English; comments in Polish
- Do not install new UI libraries without asking the user first

## Commands

```bash
npm run dev        # start dev server at http://localhost:5173
npm run build      # TypeScript check (tsc -b) + Vite production build
npm run preview    # preview production build locally
```

There are no test or lint scripts configured.

## Architecture

**Stack:** React 19 + TypeScript + Vite 6 + Tailwind CSS v4 + Supabase JS + React Router v7 + Zustand

**Tailwind v4 setup** — no `tailwind.config.ts`. The plugin is registered in `vite.config.ts` via `@tailwindcss/vite`, and CSS uses `@import "tailwindcss"` in `src/index.css`. Custom keyframes (`float-up`, `shimmer`, `glow-pulse`) and utility classes (`.particle`, `.shimmer-text`, `.glow-card`) are defined directly in `src/index.css`.

**Supabase** — anonymous multiplayer via `localStorage` UUID (no auth). Client in `src/lib/supabase.ts`. Player ID persisted across sessions via `getPlayerId()`. Real-time game sync uses Postgres change subscriptions (`supabase.channel()`). Required tables: `games`, `ships`, `moves` — schema in the SQL block below.

**State** — single Zustand store (`src/store/gameStore.ts`). Board setters accept both direct values and updater functions `(prev: Board) => Board`.

**Game flow:** `waiting → placing → playing → finished`. The `status` field on `games` drives all UI transitions:
- `waiting` — player1 created, waiting for player2 to join
- `placing` — both players place ships; `player1_ready` / `player2_ready` track completion
- `playing` — turns alternate via `current_turn` (stores player UUID); moves written to `moves` table, real-time subscription applies them to opponent board
- `finished` — `winner` stores winning player UUID

**Pure game logic** lives in `src/lib/gameLogic.ts` (no side effects, no imports from React/Supabase). Key functions: `isValidPlacement`, `placeShip`, `applyMove`, `canShoot`, `allShipsSunk`.

**Row-to-type mapping** — Supabase returns snake_case rows; `rowToGame()` in `Game.tsx` converts to camelCase `Game` interface.

## Supabase schema

```sql
create table games (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  player1_id text not null,
  player2_id text,
  status text not null default 'waiting',
  current_turn text,
  winner text,
  player1_ready boolean not null default false,
  player2_ready boolean not null default false,
  created_at timestamptz default now()
);

create table ships (
  id uuid primary key,
  game_id uuid references games(id) on delete cascade,
  player_id text not null,
  cells jsonb not null,
  size int not null
);

create table moves (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references games(id) on delete cascade,
  player_id text not null,
  x int not null,
  y int not null,
  is_hit boolean not null,
  created_at timestamptz default now()
);

-- Public RLS (dev)
alter table games enable row level security;
alter table ships enable row level security;
alter table moves enable row level security;
create policy "public access" on games for all using (true) with check (true);
create policy "public access" on ships for all using (true) with check (true);
create policy "public access" on moves for all using (true) with check (true);

-- Realtime
alter publication supabase_realtime add table games;
alter publication supabase_realtime add table moves;
```

## Environment

`.env` (not committed):
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```
