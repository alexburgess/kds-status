# KDS Status Android App

This is the tablet companion app. It reads Miradore managed configuration, fetches its device definition, runs local diagnostics, and reports status to the dashboard API.

Managed configuration keys:

- `device_id`
- `device_secret`
- `api_base_url`

Local checks:

- Active transport via Android `NetworkCapabilities`
- Local IPv4 address via `ConnectivityManager` / `LinkProperties`
- Internet reachability via TCP connect to `clients3.google.com:443`
- Printer reachability via TCP connect to each configured printer host/port
- Square KDS package version when a package name is configured and visible

Build from this directory with Android Studio or Gradle:

```bash
./gradlew assembleDebug
```

This repo does not commit a Gradle wrapper binary yet. If Android Studio opens the project, use its Gradle tooling to generate or run the wrapper before CI distribution.

Before production rollout, confirm the exact Square KDS Android package name from a real tablet or Miradore inventory and add it to `AndroidManifest.xml` under `<queries>`.
