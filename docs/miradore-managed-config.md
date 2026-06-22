# Miradore Managed App Configuration

The Android companion app declares managed configuration keys in `res/xml/app_restrictions.xml`.

Configure these values per KDS tablet in Miradore:

| Key | Example | Notes |
| --- | --- | --- |
| `device_id` | `expo-line-01` | Optional fallback identifier. Ethernet MAC address is preferred when Android exposes it. |
| `device_secret` | long random value | Device API credential. Store only its SHA-256 hash in Supabase. |
| `api_base_url` | `https://kds-status.example.com` | Base URL of the hosted dashboard/API. |

Recommended Miradore flow:

1. Create or upload the private Android app.
2. Assign the app to fully managed KDS tablets.
3. Set managed app configuration values per device or per group.
4. Confirm the Android app setup screen shows `device_secret` and `api_base_url` as present.
5. Confirm the device can fetch `GET /api/device/config`.

Use the Ethernet MAC address as the primary identity for these KDS tablets. Keep `device_id` configured when convenient because it remains useful as a fallback and human-readable label.

For first-tablet testing, see [kds-device-testing.md](kds-device-testing.md). The debug APK can use a local HTTP dashboard URL such as `http://10.0.200.146:3000`; production should use HTTPS.
