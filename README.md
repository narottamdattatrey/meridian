# Meridian – Investor Platform Onboarding

Production-grade user onboarding implementation. Strict TypeScript throughout.

---

## Project Structure

```
meridian/
├── db/
│   └── schema.sql                  # PostgreSQL schema
├── backend/
│   ├── constants/
│   │   └── countries.ts            # Supported ISO country codes
│   ├── db/
│   │   └── mockStore.ts            # In-memory store + typed seed data
│   ├── routes/
│   │   └── investors.ts            # POST /api/v1/investors/onboard
│   ├── types/
│   │   └── api.ts                  # Request/response interfaces
│   ├── validators/
│   │   └── investorSchema.ts       # Zod schema (server-side)
│   ├── app.ts                      # Express app factory
│   ├── server.ts                   # Entry point + graceful shutdown
│   ├── package.json
│   └── tsconfig.json
└── frontend/
    ├── src/
    │   ├── api/
    │   │   └── investorApi.ts       # Typed fetch wrapper
    │   ├── components/
    │   │   └── OnboardingForm/
    │   │       └── index.tsx        # Form component (useReducer state machine)
    │   ├── constants/
    │   │   └── countries.ts         # Country options for select
    │   ├── types/
    │   │   └── api.ts               # Shared API types (frontend)
    │   ├── validators/
    │   │   └── investorSchema.ts    # Zod schema (client-side)
    │   ├── App.tsx
    │   ├── main.tsx
    │   └── index.css
    ├── index.html
    ├── package.json
    ├── postcss.config.js
    ├── tailwind.config.js
    ├── tsconfig.json
    └── vite.config.ts
```

---

## Quick Start

### Backend

```bash
cd backend
npm install
npm run dev        # tsx watch – hot-reloads on file changes
```

Server starts at **http://localhost:4000**

### Frontend

```bash
cd frontend
npm install
npm run dev        # Vite dev server
```

App opens at **http://localhost:5173**  
(Vite proxies `/api/*` to the backend automatically.)

---

## API Reference

### `POST /api/v1/investors/onboard`

**Request body**
```json
{
  "full_name": "Amelia Thornton",
  "email": "amelia@example.com",
  "date_of_birth": "1990-03-22",
  "country": "GB"
}
```

**201 Created**
```json
{
  "success": true,
  "data": {
    "id": "uuid-v4",
    "full_name": "Amelia Thornton",
    "email": "amelia@example.com",
    "date_of_birth": "1990-03-22",
    "country": "GB",
    "status": "pending_kyc",
    "created_at": "2026-05-22T10:00:00.000Z",
    "updated_at": "2026-05-22T10:00:00.000Z"
  }
}
```

**400 Validation Error**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more fields failed validation.",
    "fields": { "email": "A valid email address is required." }
  }
}
```

**409 Conflict**
```json
{
  "success": false,
  "error": {
    "code": "DUPLICATE_EMAIL",
    "message": "An account with this email address already exists."
  }
}
```

---

## Key Design Decisions

| Concern | Approach |
|---|---|
| Validation | Single Zod schema per layer; server schema is authoritative |
| 18+ check | Enforced in both Zod (runtime) and PostgreSQL CHECK constraint |
| Duplicate emails | Checked before insert; 409 mapped back to email field in UI |
| State management | `useReducer` state machine in form – no external state library needed |
| Security | `helmet`, CORS allowlist, body size limit (64 KB), `noUncheckedIndexedAccess` |
| DB simulation | Async latency simulation (60 ms) to mimic real DB round-trips |
