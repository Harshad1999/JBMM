# Jai Bharat Mitra Mandal — Collection App (PRD)

## Overview
Cross-platform mobile app (React Native + Expo) for a community trust to manage
door-to-door / shop-to-shop donation collection during the annual Ganesh Festival.
Volunteers ("karyakartas") record donations on the field, auto-generate a numbered
PDF receipt, and share it on WhatsApp. Admins get a real-time dashboard, filterable
history, exports, and volunteer management. The app is offline-first so poor
network in narrow lanes never blocks a receipt.

## Stack
- Frontend: Expo SDK 54 + expo-router, TypeScript, react-native-safe-area-context
- Auth: **Firebase Authentication (Google Sign-In)** — self-hosted, own Firebase project
- Backend: FastAPI + Motor (MongoDB) — all endpoints under `/api`
- PDF: `expo-print` (HTML → PDF); Share: `expo-sharing` (WhatsApp direct + generic share)
- Offline queue: AsyncStorage-backed queue, auto-sync on reconnect via NetInfo
- Receipt counter: transactional Mongo counter → sequential IDs like `JBM-2026-0001`

## Roles
- `admin` — full access (dashboard, all collections, exports, volunteer management)
- `volunteer` — collect + view/share own collections only
- Pre-seeded admins on first sign-in: `sonawaneharshad1999@gmail.com`,
  `samraj.borade@gmail.com`

## Screens
### Volunteer
1. `collect` — form: donor name, +91 WhatsApp (10 digits), amount, mode toggle
   (Cash / Marked as Paid), address, notes → creates collection or queues offline.
2. `my-collections` — searchable list, running total, tap → receipt view.
3. `receipt/[id]` — beautiful in-app receipt preview with Share PDF + WhatsApp CTA.
4. `profile` — user info + sign out.

### Admin
1. `dashboard` — total raised, today, this week, cash/paid split bar,
   volunteer leaderboard.
2. `collections` — all collections filterable by date range chips (all/today/week/month),
   payment mode, volunteer chips, search; CSV export button.
3. `volunteers` — promote/demote/deactivate members.
4. `profile`

## Key API endpoints
- `POST /api/auth/session` — exchange session_id → { session_token, user }
- `GET  /api/auth/me` — current user (Bearer)
- `POST /api/auth/logout`
- `GET  /api/users`, `PATCH /api/users/{id}/role`, `PATCH /api/users/{id}/active` (admin)
- `POST /api/collections` — create (supports `client_temp_id` for offline dedupe)
- `GET  /api/collections` — role-scoped list with date/mode/volunteer/search filters
- `GET  /api/collections/{id}` — single (owner or admin)
- `GET  /api/collections/export.csv` — admin CSV export
- `GET  /api/dashboard/stats` — KPIs + leaderboard

## Design
Indian festive palette: saffron `#FF671F` primary, marigold `#FFB300` secondary,
white surfaces, dashed-border receipt with ॐ श्री गणेशाय नमः band, Cabinet-Grotesk
inspired weights via system fonts, thumb-friendly 48-px touch targets.

## Deployment / Notes for user
- WhatsApp direct-open (`whatsapp://send`) requires the app to be installed on the
  device; on web the fallback is `wa.me` link. Generic PDF share works everywhere.
- App logo currently uses a saffron ॐ emblem — user will share their logo asset
  later; drop into `assets/images/logo.png` and swap out the emblem in `login.tsx`
  and `ScreenHeader.tsx`.
- To ship: build with `eas build` (see MIGRATION_GUIDE.md) and distribute the
  APK/IPA directly, or submit to the Play Store / App Store.
