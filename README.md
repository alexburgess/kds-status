# KDS Status

KDS Status is a fleet dashboard and Android companion app for diagnosing Square KDS tablets.

KDS tablets identify themselves by Ethernet MAC address when Android exposes it. Miradore still pushes `device_secret` and `api_base_url`, and may also push `device_id` as a fallback label.

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

## Android CLI Build

This repo intentionally does not commit a Gradle wrapper binary. On this Mac, use Homebrew Gradle plus the Android command-line SDK:

```bash
./scripts/android-gradle :app:testDebugUnitTest :app:assembleDebug
```

The debug APK is written to `apps/android/app/build/outputs/apk/debug/app-debug.apk`.

See [docs/kds-device-testing.md](docs/kds-device-testing.md) for the actual KDS tablet testing flow.

The local tablet emulator is named `kds-tablet`:

```bash
./scripts/android-emulator -avd kds-tablet
./scripts/android-install-debug
```

## Device API

Device requests authenticate with:

- `X-Device-Mac-Address` when available, otherwise `X-Device-Id`
- `X-Device-Secret`

Endpoints:

- `GET /api/device/config`
- `POST /api/device/status`

See [docs/setup.md](docs/setup.md) and [docs/miradore-managed-config.md](docs/miradore-managed-config.md).

## Defining A Device

Open `/definitions` in the dashboard. The builder creates:

- Supabase SQL for the location, device, expected KDS settings, and optional printer.
- Miradore managed configuration values for `device_secret`, `api_base_url`, and optional fallback `device_id`.

The fleet page side panel only previews the selected device definition. Real creation/editing starts from the Definitions page.
