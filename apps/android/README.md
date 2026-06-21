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
- Square KDS package version for `com.squareup.rst.kds` when the app is installed and visible

Build from this directory with Homebrew Gradle and the Android command-line SDK:

```bash
../../scripts/android-gradle :app:assembleDebug
```

This repo does not commit a Gradle wrapper binary. On this Mac, Gradle is installed through Homebrew and Android builds should use JDK 17, not the newer Homebrew default OpenJDK.
