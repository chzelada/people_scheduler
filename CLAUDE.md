# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

People Scheduler is a church volunteer scheduling application with an intelligent constraint satisfaction algorithm. It supports:
- Admin role: Full management of volunteers, schedules, and configuration
- Servidor role: Self-service view of assignments and unavailability management

Available as a web app (AWS) and desktop app (Tauri).

## Development Commands

### Frontend (React + TypeScript + Vite)
```bash
npm run dev              # Dev server at http://localhost:1420
npm run build            # TypeScript compile + Vite build to dist/
npm run preview          # Preview production build
```

### Backend API (Rust + Axum)
```bash
cd api
cargo run --bin api      # Local dev server at http://localhost:3000
cargo build              # Build for development
cargo build --bin lambda # Build Lambda binary
cargo fmt                # Format code
cargo clippy             # Lint
cargo test               # Run tests
```

### Desktop (Tauri)
```bash
npm run tauri dev        # Development with hot reload
npm run tauri build      # Build .dmg (macOS) or .msi (Windows)
```

### Deployment (AWS)
```bash
./scripts/deploy.sh      # Compiles Lambda, uploads frontend to S3, invalidates CloudFront
```
Requires: `cargo-zigbuild`, `zig`, AWS CLI configured with `people-scheduler` profile.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  WEB: React/Vite → CloudFront → S3 (static)                │
│       API Gateway → Lambda (Rust Axum ARM64) → PostgreSQL  │
├─────────────────────────────────────────────────────────────┤
│  DESKTOP: React/Vite embedded in Tauri → DuckDB (local)    │
└─────────────────────────────────────────────────────────────┘
```

### Key Directories
- `src/` - React frontend (shared between web and desktop)
  - `pages/` - Page components (Dashboard, ScheduleView, PeopleManagement, Reports)
  - `components/` - Reusable UI components organized by feature
  - `stores/` - Zustand state management with localStorage persistence
  - `services/api.ts` - API client with all endpoint calls
  - `types/index.ts` - TypeScript type definitions
- `api/` - Rust web API (dual binary: standalone + Lambda)
  - `src/main.rs` - Standalone server binary (dev mode)
  - `src/lambda.rs` - AWS Lambda handler binary
  - `src/routes/schedules.rs` - Scheduling algorithm implementation (~800 lines)
  - `src/auth.rs` - JWT + Argon2 password hashing
  - `src/models/` - Data models and request/response types
  - `src/db/` - Database connection and query utilities
- `src-tauri/` - Tauri desktop app with DuckDB (local-first architecture)
- `migrations-postgres/` - SQL migrations (auto-run on API start, numbered sequentially)
- `scripts/` - Deployment and utility scripts

### State Management
Zustand stores in `src/stores/` with localStorage persistence:
- `authStore.ts` - JWT token + user info
- `scheduleStore.ts` - Schedules and assignments
- `peopleStore.ts`, `jobsStore.ts`, `unavailabilityStore.ts`

## Environment Variables

### API (`api/.env`)
```bash
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
JWT_SECRET=your-secret-key
RUST_LOG=info
```

### Frontend (`.env.production`)
```bash
VITE_API_URL=https://your-api-gateway.execute-api.region.amazonaws.com
```

## Database Schema

### Core Tables
- `users` - System users (admin/servidor roles) with JWT auth
- `people` - Volunteer information with job qualifications, exclusion flags, and profile photo (Base64)
- `jobs` - Service types (Monaguillos, Monaguillos Jr., Lectores)
- `job_positions` - Sub-positions per job (e.g., Pos 1-4 for Monaguillos, Monitor/Primera/Salmo/Segunda for Lectores)
- `person_jobs` - Many-to-many mapping of people to qualified jobs
- `schedules` - Monthly schedule containers (year + month)
- `service_dates` - Specific dates within a schedule
- `assignments` - Person assigned to job position on service date
- `assignment_history` - Historical record for fairness calculations
- `unavailability` - Date ranges when people are unavailable
- `sibling_groups` - Family groupings with TOGETHER/SEPARATE rules

Migrations run automatically via `api/src/lib.rs:init_database()`.
New migrations are numbered sequentially in `migrations-postgres/`.

## Scheduling Algorithm

### Hard Constraints
- Person must be qualified for the job
- Person must be available (not in unavailability table)
- Person must be active
- Cannot exceed max consecutive weeks
- **Consecutive month restriction**: Monaguillos and Lectores cannot be assigned in consecutive months (new assignments only)
- **Monthly assignment limit**: Max 1 assignment per job per month
- **Job exclusions**: Person not excluded from job via `exclude_monaguillos` or `exclude_lectores` flags

### Soft Constraints
- Equitable distribution (fairness score based on assignment history)
- Frequency preference (weekly, bimonthly, monthly)
- Sibling group rules (TOGETHER/SEPARATE)

### Rotation Bag Algorithm
Each person has a "bag" of positions not yet done in the current cycle:
1. **Construction**: Positions NOT completed in current rotation cycle
2. **Prioritization**: Assign positions with fewest qualified people first
3. **Selection**: Choose person with smallest remaining bag (most constrained)
4. **Refresh**: When bag empties, refill with all positions (new cycle begins)

## Default Credentials

Auto-created on first run:
- Username: `admin`
- Password: `admin123`

## Important Business Logic

### Assignment Restrictions
- **Consecutive months**: Monaguillos and Lectores cannot serve in consecutive months (enforced in `has_consecutive_month_restriction()`)
- **Monthly limits**: Each person can only be assigned once per job per month
- **Job exclusions**: People can be excluded from specific jobs via boolean flags (`exclude_monaguillos`, `exclude_lectores`)

### User Roles
- **Admin**: Full access to all features (user management, scheduling, configuration, manage anyone's photo)
- **Servidor**: Read-only view of own assignments, can manage own unavailability and profile photo

### Volunteer Lifecycle
- When creating a new person, auto-generates username and password for servidor role
- Username format: `firstname.lastname` (lowercased, special chars removed)
- Password: random 8-char alphanumeric shown once at creation

### Profile Photos
- Stored as Base64 data URIs in PostgreSQL (`photo_url` column)
- Frontend resizes/crops to 200x200px JPEG 80% quality before upload
- Backend validates: max 100KB, valid data URI format, image MIME types only
- Components: `Avatar.tsx` (display), `PhotoUpload.tsx` (upload UI), `ImageCropModal.tsx` (crop/zoom)
- Endpoints: `POST/DELETE /api/people/{id}/photo` (admin), `POST/DELETE /api/my-photo` (servidor)

## API Endpoints Pattern

All protected routes under `/api/*` require JWT in Authorization header (`Bearer <token>`).
- `POST /login` - Returns JWT token
- `/api/people`, `/api/jobs`, `/api/schedules`, `/api/unavailability`, `/api/sibling-groups`, `/api/reports`
- See `api/src/routes/mod.rs` for complete route registration

## Adding New Features

### New API endpoint
1. Add handler in `api/src/routes/{feature}.rs`
2. Register route in `api/src/routes/mod.rs`
3. Add client method in `src/services/api.ts`

### New database table
1. Create `migrations-postgres/NNN_description.sql` (use next sequential number)
2. Add migration execution to `init_database()` in `api/src/lib.rs`
3. Update relevant models in `api/src/models/mod.rs`
4. Update TypeScript types in `src/types/index.ts`

### Testing locally
Backend runs on port 3000, frontend dev server on port 1420. Frontend proxies API requests to backend during development. Set `VITE_API_URL` in `.env.production` for production builds.
