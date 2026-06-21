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
