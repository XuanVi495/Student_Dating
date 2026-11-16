# Project Progress

_Last updated: 2026-11-15_

---

## Module Implementation Status

| Module | Status | Scope |
|--------|--------|-------|
| Profile (`src/modules/profile/`) | ✅ Complete | Own profile, interests, and preferences |
| Discovery (`src/modules/discovery/`) | ✅ Complete | Eligible profile feed |
| Interaction (`src/modules/interaction/`) | ✅ Complete | Like, skip, and block actions |
| Matching (`src/modules/matching/`) | ✅ Complete | Match lifecycle and conversation coordination |
| Chat (`src/modules/chat/`) | ✅ Complete | Conversations, messages, and realtime events |
| Notification (`src/modules/notification/`) | ✅ Complete | Notification inbox and event-driven notifications |
| User (`src/modules/user/`) | ✅ Complete | Student document verification, review queue, and role assignment |
| Report (`src/modules/report/`) | ✅ Complete | Report tickets, evidence, moderation workflow, and processing history |
| CI/CD (`.github/workflows/`) | ✅ Complete | Backend quality gates, GHCR image publishing, and Render deployment hook |

---

## Authentication

### JWT Middleware (`src/shared/middleware/authenticate.ts`)
- **Status: ✅ Complete**
- Extracts Bearer token from `Authorization` header.
- Verifies token server-side via `supabaseAdmin.auth.getUser(token)` (service role key, never client-facing).
- Attaches the resolved user to `res.locals.user` for downstream handlers.
- Returns `AppError(401)` on missing, invalid, or expired tokens.
- Covered by `test/authenticate.test.ts` — valid token, missing header, invalid token, malformed header.

### Supabase Admin Client (`src/supabase/supabase.ts`)
- **Status: ✅ Complete**
- Single `supabaseAdmin` instance using `SUPABASE_SERVICE_ROLE_KEY`.
- Used exclusively by the `authenticate` middleware; never returned in responses.

---

## Profile Module

### Implementation (`src/modules/profile/`)
- **Status: ✅ Complete**

| File | Status |
|------|--------|
| `profile.schemas.ts` | ✅ Zod schemas for all request bodies |
| `profile.service.ts` | ✅ Prisma queries with ownership enforcement (`student_id`) |
| `profile.controller.ts` | ✅ Request parsing, Zod validation, response shaping |
| `profile.router.ts` | ✅ Routes declared, `authenticate` middleware applied |

### Endpoints implemented

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/profile` | Get own profile + interests + preferences + verification |
| `PATCH` | `/api/profile` | Update own profile fields |
| `PUT` | `/api/profile/interests` | Replace own interest selections |
| `PUT` | `/api/profile/preferences` | Upsert own search preferences |
| `GET` | `/api/profile/interests` | List all active global interest tags |

---

## Discovery Module

### Implementation (`src/modules/discovery/`)
- **Status: ✅ Complete**
- Returns eligible profiles according to the authenticated user's search criteria.
- Excludes profiles that are unavailable, already interacted with, blocked, or already matched.
- Uses bounded pagination and a single feed query for the discovery results.

---

## Interaction Module

### Implementation (`src/modules/interaction/`)
- **Status: ✅ Complete**
- Provides separate authenticated actions for like, skip, and block, with `targetId` in the URL.
- Persists likes before publishing `interaction.like-created`; the successful like response reports the action only and does not wait for matching.
- Blocks clear interactions between the users and delegate match cancellation to Matching; Matching delegates conversation deactivation to Chat.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/interactions/:targetId/like` | Like a profile |
| `POST` | `/api/interactions/:targetId/skip` | Skip a profile |
| `POST` | `/api/interactions/:targetId/block` | Block a profile |

---

## User & RBAC Module

### Implementation (`src/modules/user/`)
- **Status: ✅ Complete**
- Assigns ADMIN/MODERATOR roles behind authenticated ADMIN-only authorization.
- Allows students to submit HTTPS student card/CCCD image URLs and resubmit rejected verifications.
- Allows MODERATORs and ADMINs to inspect the verification queue and approve or reject pending submissions; review outcomes publish `user.verification-reviewed` for notification handling.
- Validates user IDs and request bodies with Zod; rejects missing users/verifications and attempts to review non-pending verifications.

| Method | Path | Authorization | Description |
|--------|------|---------------|-------------|
| `GET` | `/api/users/verification` | Authenticated | Get own verification |
| `POST` | `/api/users/verification` | Authenticated | Submit HTTPS student card/CCCD URL |
| `GET` | `/api/users/verification/pending` | MODERATOR, ADMIN | List pending verifications |
| `GET` | `/api/users/:userId/verification` | MODERATOR, ADMIN | Inspect a user's verification |
| `PUT` | `/api/users/:userId/role` | ADMIN | Assign ADMIN or MODERATOR role |
| `PUT` | `/api/users/:userId/verification/approve` | MODERATOR, ADMIN | Approve a pending student verification |
| `PUT` | `/api/users/:userId/verification/reject` | MODERATOR, ADMIN | Reject a pending verification with a reason |

---

## Matching Module

### Implementation (`src/modules/matching/`)
- **Status: ✅ Complete**
- Handles `interaction.like-created` asynchronously through a listener initialized at application startup.
- Creates or reactivates a match only when both accounts are active, there is no block in either direction, and a reciprocal like exists.
- Owns match cancellation; Chat owns associated conversation lifecycle changes.
- Conversation creation/reactivation and deactivation are idempotent single writes in Chat, separate from match persistence; Notification handles match and verification alerts.

---

## Chat Module (`src/modules/chat/`)
- **Status: ✅ Complete**
- Provides participant-scoped conversation listing/details, paginated history, text sends, soft deletion, and read markers.
- Matching requests Chat to create/reactivate the unique conversation; inactive conversations retain readable history and reject new messages.
- Publishes message-created, message-deleted, and conversation-read events to authenticated participants over Socket.IO.
- Realtime connections verify Supabase access tokens and use the Redis Socket.IO adapter for cross-instance delivery.

---

## Notification Module (`src/modules/notification/`)
- **Status: ✅ Complete**
- Provides an authenticated, paginated notification inbox with unread counts, single/all read updates, deletion, and Vietnamese/English message formatting.
- Creates notifications for match creation and verification decisions through application event listeners; supports match, verification, and new-message notification types.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/notifications` | List notifications with pagination, status filter, and locale |
| `GET` | `/api/notifications/unread-count` | Get unread notification count |
| `PUT` / `PATCH` | `/api/notifications/:id/read` | Mark one notification as read |
| `PUT` / `PATCH` | `/api/notifications/read-all` | Mark all notifications as read |
| `DELETE` | `/api/notifications/:id` | Delete a notification |

## Report Module

### Implementation (`src/modules/report/`)
- **Status: ✅ Complete**
- Creates report tickets with reporter/target IDs, reason category/note, context, and one to five HTTPS evidence URLs.
- Prevents duplicate active reports for the same reporter, target, and context.
- Provides moderator/admin queue listing, detail inspection, status transitions, and transactional processing history.
- Publishes report events for reporter notifications.

| Method | Path | Authorization | Description |
|--------|------|---------------|-------------|
| `POST` | `/api/reports` | Authenticated | Create a report ticket |
| `GET` | `/api/reports` | MODERATOR, ADMIN | List/filter report queue |
| `GET` | `/api/reports/:reportId` | MODERATOR, ADMIN | Get report details and history |
| `PATCH` | `/api/reports/:reportId/status` | MODERATOR, ADMIN | Review and update report status |

## CI/CD and Docker

- `.github/workflows/backend-ci.yml` runs backend quality checks only when `backend/**` changes.
- Pushes to `main` or `v*.*.*` tags publish the multistage backend image to `ghcr.io/<GHCR_USERNAME>/dating-app-backend`.
- GHCR authentication uses the `GHCR_USERNAME` repository variable and `GHCR_TOKEN` secret.
- A successful GHCR push triggers Render using `RENDER_DEPLOY_HOOK_URL`.
- Docker runtime uses Node 22, Prisma-compatible OpenSSL, production dependencies, and a non-root user; migrations remain a separate deployment step.

## Verification

- `npm test` — 142 tests passed.
- `npm run build` — passed.
- `npm run prisma:validate` — passed.
- `npm audit --omit=dev --omit=optional --audit-level=high` — 0 vulnerabilities.
- Docker image build and runtime-content smoke check — passed.