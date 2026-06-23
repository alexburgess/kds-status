# KDS Status Setup

## Dashboard

Run the dashboard/API:

```bash
npm install
npm run dev
```

The deployed internal dashboard currently runs at:

```text
http://10.20.12.100:3001
```

Without Supabase credentials, the dashboard uses a local JSON definitions file. By default that file is:

```text
apps/dashboard/.local-data/device-definitions.json
```

Set `KDS_DEFINITIONS_PATH` if you want the JSON file somewhere else on the server.

## Define Devices

Open `/definitions` and edit the JSON directly. The dashboard starts with no example devices.

Minimum device:

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

Useful optional fields:

- `locationName`
- `role`
- `notes`
- `squareKdsPackageName`
- `fulfillmentMethods`
- `expectedSettings`
- `printers`

Printers default to port `9100` when `port` is omitted.

Fulfillment methods are defined per device because the available values come from the Square location:

```json
"fulfillmentMethods": {
  "includeFutureFulfillmentMethods": false,
  "methods": [
    { "name": "For Here", "enabled": true },
    { "name": "Pergola Order", "enabled": false },
    { "name": "To Go", "enabled": true }
  ]
}
```

## Device Identity

The Android app has the dashboard URL and shared internal secret baked in. It identifies itself with:

```text
X-Device-Mac-Address
X-Device-Id
```

The API first looks for the JSON device with the matching `macAddress`. If Android blocks MAC access, the app sends a fallback `android-...` value as `X-Device-Id`; add that value to the JSON device as `deviceId`. You do not need to configure Miradore app settings.

## API Smoke Test

After adding a matching definition in `/definitions`, test config lookup:

```bash
curl -H "X-Device-Mac-Address: aa:bb:cc:dd:ee:ff" \
  -H "X-Device-Secret: kds-status-internal-v1" \
  http://localhost:3000/api/device/config
```

Fallback ID lookup uses the same endpoint:

```bash
curl -H "X-Device-Id: android-abc123def4567890" \
  -H "X-Device-Secret: kds-status-internal-v1" \
  http://localhost:3000/api/device/config
```

The Square KDS version is still retrieved automatically from Google Play when `squareKdsPackageName` is set. The current Square KDS package name is expected to be `com.squareup.rst.kds`, but confirm it from a real tablet before production rollout.
