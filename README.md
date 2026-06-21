# KDS Status

KDS Status is a fleet dashboard and Android companion app for diagnosing Square KDS tablets.

The first implementation uses an assigned `deviceId` rather than MAC address. Miradore should push each tablet's `device_id`, `device_secret`, and `api_base_url` as Android managed app configuration values.

## Apps

- `apps/dashboard`: Next.js dashboard and device API backed by Supabase Postgres, with demo data fallback.
- `apps/android`: Kotlin/Jetpack Compose companion app for local network diagnostics and status reporting.
- `supabase/migrations`: database schema for locations, devices, printers, and status reports.

## Local Dashboard

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Without Supabase credentials, the dashboard runs in demo mode using the seeded device `expo-line-01` and secret `demo-secret`.

## Device API

Device requests authenticate with:

- `X-Device-Id`
- `X-Device-Secret`

Endpoints:

- `GET /api/device/config`
- `POST /api/device/status`

See [docs/setup.md](docs/setup.md) and [docs/miradore-managed-config.md](docs/miradore-managed-config.md).
