# Deployment Guide

## Architecture

The app runs as three Docker Compose services:

| Service | Role | Image |
|---------|------|-------|
| `db` | PostgreSQL 16 | `postgres:16-alpine` |
| `app` | Next.js web server | Built from `Dockerfile` |
| `jobs` | Background tasks (price fetch, backups, etc.) | Same image, different entrypoint |

`DATABASE_URL` is assembled by `docker-compose.yml` from the `DB_PASSWORD` variable in the server's `.env` file. You never need to set `DATABASE_URL` directly.

## Server location

```
root@WhiteTower:/mnt/user/appdata/Horizon
```

---

## Standard deploy (no migration)

```bash
git pull
docker compose up -d --build
```

This rebuilds the images (runs `prisma generate` + `pnpm build` inside the Dockerfile) and restarts all services.

## Deploy with database migration

When the update includes new Prisma migrations.

**Run each command one at a time.** Wait for each step to finish and confirm success before running the next. Do NOT chain them with `&&` — if a migration fails silently the rebuild will deploy code that references columns that don't exist yet.

```bash
git pull
```
```bash
docker compose run --rm app npx prisma migrate deploy
```
```bash
docker compose up -d --build
```

`migrate deploy` runs inside a one-off `app` container that already has `DATABASE_URL` set by Compose.

## Deploy with migration + backfill job

When a migration adds a column that needs data populated on existing rows. Same rule: **one command at a time, verify each before proceeding.**

```bash
git pull
```
```bash
docker compose run --rm app npx prisma migrate deploy
```
```bash
docker compose run --rm app npx prisma generate
```
```bash
docker compose run --rm jobs npx tsx jobs/<backfill-script>.ts
```
```bash
docker compose up -d --build
```

Example (the `fxRateAtDate` backfill from April 2026):

```bash
docker compose run --rm app npx prisma migrate deploy
```
```bash
docker compose run --rm app npx prisma generate
```
```bash
docker compose run --rm jobs npx tsx jobs/backfill-fx-rates.ts
```
```bash
docker compose up -d --build
```

---

## Environment setup

The server `.env` only needs two variables (see `.env.example`):

```env
DB_PASSWORD=<generated with: openssl rand -base64 24>
SESSION_SECRET=<generated with: openssl rand -hex 32>
```

## Useful commands

```bash
# View logs
docker compose logs -f app
docker compose logs -f jobs

# Open a psql shell
docker compose exec db psql -U horizon

# Run a one-off command in the app container
docker compose run --rm app <command>

# Force full rebuild (no cache)
docker compose build --no-cache && docker compose up -d
```
