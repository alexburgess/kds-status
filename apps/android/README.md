# KDS Status Android App

This is the tablet companion app. It has the internal dashboard URL baked in, fetches its device definition by fixed Ethernet or Wi-Fi MAC address when Android exposes it, runs local diagnostics, and reports status to the dashboard API. If Android blocks MAC access, it falls back to a stable `android-...` device ID and shows that value on the tablet so it can be added to the dashboard JSON.

Built-in API target:

```text
http://10.20.12.100:3001
```

No Miradore managed app configuration is required. If the dashboard address changes, update `AppConfigParser.DEFAULT_API_BASE_URL`, rebuild the APK, and redeploy it.

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
