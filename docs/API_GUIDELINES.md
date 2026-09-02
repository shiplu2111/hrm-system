# API_GUIDELINES.md

## 1. Versioning

- All endpoints prefixed `/api/v1/...`. Breaking changes get a new version prefix; never break `v1` silently.

## 2. Naming & Structure

- REST resource naming: plural nouns, kebab-case for multi-word resources: `/employees`, `/leave-requests`, `/payroll-runs`.
- Nested resources reflect ownership: `/employees/{id}/documents`.
- Actions that aren't pure CRUD use a verb sub-path: `POST /payroll-runs/{id}/finalize`, `POST /leave-requests/{id}/approve`.

## 3. Request/Response Shape

```json
// Success
{ "data": { ... }, "meta": { "page": 1, "total": 42 } }

// Error (see ERROR_HANDLING.md for full spec)
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [...] } }
```

- Never return raw arrays at the top level — always wrap in `data` so pagination metadata can be added later without a breaking change.

## 4. Auth

- All endpoints (except `/auth/*`) require a valid JWT in the `Authorization: Bearer <token>` header.
- `tenant_id` is derived from the token, never accepted as a request parameter for scoping (see RULES.md §1).

## 5. Pagination

- Cursor or offset-based pagination on all list endpoints; default page size capped (e.g. 50), max enforced server-side regardless of client-requested size.

## 6. Filtering & Sorting

- Query params: `?filter[status]=active&sort=-created_at`.
- Only whitelisted filter/sort fields per endpoint — no arbitrary raw query pass-through.

## 7. Idempotency (critical for offline sync)

- Sync and payment-related POST endpoints accept an idempotency key (or use the `local_id` pattern from OFFLINE_SYNC.md) so retried requests don't create duplicates.

## 8. Bulk Operations

- Bulk import/export endpoints (see MODULES.md §37) accept/return batch results with per-row success/failure status, not all-or-nothing failure.

## 9. Webhooks (for integrations)

- Outbound webhooks signed with a per-tenant secret (HMAC), versioned payload schema, retried with backoff on delivery failure.

## 10. Documentation

- OpenAPI/Swagger UI: **http://localhost:3000/api/docs** (when API is running via `npm run dev:api`).
- Spec is generated from NestJS decorators in `apps/api/src` — not maintained as a separate hand-written doc.
- Use **Authorize** in Swagger with `Bearer <accessToken>` after logging in via `POST /api/v1/auth/login`.

### Implemented auth endpoints (v1)

| Method | Path | Auth required |
|---|---|---|
| `POST` | `/api/v1/auth/login` | No |
| `POST` | `/api/v1/auth/refresh` | Refresh token (body or httpOnly cookie) |
| `GET` | `/health` | No |

See AUTH_FLOW.md and ENV_SETUP.md §5 for demo credentials.

See ERROR_HANDLING.md, SHARED_TYPES.md, and AUTH_FLOW.md for related conventions.
