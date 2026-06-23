# KDS Status

KDS Status is a fleet dashboard and Android companion app for diagnosing Square KDS tablets.

KDS tablets identify themselves by Ethernet MAC address. The Android app has the internal dashboard URL baked in, so Miradore only needs to deploy the APK.

## Apps

- `apps/dashboard`: Next.js dashboard and device API with a local JSON definition store. Supabase support remains available if credentials are configured.
- `apps/android`: Kotlin/Jetpack Compose companion app for local network diagnostics and status reporting.
- `supabase/migrations`: database schema for locations, devices, printers, and status reports.

## Local Dashboard

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Without Supabase credentials, the dashboard reads definitions from a local JSON file and starts with no example devices.

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

Device requests use:

- `X-Device-Mac-Address` for device lookup
- `X-Device-Secret` for the baked-in shared internal app secret

Endpoints:

- `GET /api/device/config`
- `POST /api/device/status`

See [docs/setup.md](docs/setup.md) and [docs/miradore-managed-config.md](docs/miradore-managed-config.md).

## Defining A Device

Open `/definitions` in the dashboard and edit the JSON:

```json
{
  "devices": [
    {
      "macAddress": "aa:bb:cc:dd:ee:ff",
      "displayName": "Expo KDS"
    }
  ]
}
```

The dashboard fills in defaults for optional fields such as `deviceId`, `locationName`, `role`, empty settings, and printer port `9100`.
