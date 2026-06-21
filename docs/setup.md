# KDS Status Setup

## Dashboard

1. Create a Supabase project.
2. Run `supabase/migrations/202606210001_initial_schema.sql`.
3. Optionally run `supabase/seed.sql` for the demo device.
4. Copy `.env.example` to `.env.local` in the repo root or dashboard app.
5. Set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. Run:

```bash
npm install
npm run dev
```

If Supabase values are not present, the dashboard uses in-memory demo data.

## Device API Authentication

Each tablet has a stable assigned `deviceId` and a random `deviceSecret`.

The dashboard stores only `sha256(deviceSecret)` in `devices.device_secret_hash`. Devices send the raw secret in the `X-Device-Secret` header over HTTPS.

For production, use long random secrets and rotate them if a tablet is retired or replaced.

## Define A Device Yourself

The easiest path is the dashboard builder:

1. Run the dashboard and open `/definitions`.
2. Fill in the location, display name, assigned `deviceId`, role, Square KDS package name, expected settings, and printer target.
3. Copy the generated Supabase SQL and run it in the Supabase SQL editor.
4. Copy the generated Miradore managed configuration values into that tablet's app configuration.

The generated SQL uses `encode(digest('<raw secret>', 'sha256'), 'hex')`, so Supabase stores only the hashed secret. Miradore gets the raw secret because the Android tablet needs it to authenticate.

If you are editing manually, the minimum required database fields are:

- `locations.name` and `locations.slug`
- `devices.device_id`
- `devices.device_secret_hash`
- `devices.display_name`
- `devices.role`
- `devices.expected_settings`

Add rows to `printers` only when that KDS screen should test a printer.

The Square KDS version is not typed into the definition. When a tablet fetches `/api/device/config`, the dashboard looks up the configured `square_kds_package_name` on Google Play and sends the retrieved version to the tablet as the available version. The current Square KDS package name is `com.squareup.rst.kds`.

## Local API Smoke Test

```bash
curl -H "X-Device-Id: expo-line-01" \
  -H "X-Device-Secret: demo-secret" \
  http://localhost:3000/api/device/config
```

```bash
curl -X POST http://localhost:3000/api/device/status \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: expo-line-01" \
  -H "X-Device-Secret: demo-secret" \
  -d '{
    "localIp": "192.168.20.44",
    "activeTransport": "ethernet",
    "internet": { "ok": true, "latencyMs": 40 },
    "printerChecks": [
      { "printerId": "printer-hot-line", "name": "Hot line printer", "host": "192.168.20.61", "port": 9100, "ok": true, "latencyMs": 8 }
    ],
    "squareKds": { "versionStatus": "not_configured" },
    "appVersion": "0.1.0",
    "diagnostics": []
  }'
```
