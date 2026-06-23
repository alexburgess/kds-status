# Testing On A KDS Tablet

The real device-side experience is the Android app in `apps/android`.

## Fast Hardware Check

1. Build the debug APK:

   ```bash
   ./scripts/android-gradle :app:assembleDebug
   ```

2. Upload `apps/android/app/build/outputs/apk/debug/app-debug.apk` to Miradore as an internal/private Android app.
3. Deploy it to one test KDS tablet.
4. In the dashboard, open `/definitions` and add a JSON device whose `macAddress` matches the tablet fixed Ethernet or Wi-Fi MAC address.
5. Open **KDS Status** on the tablet.

No Miradore managed app configuration is required.

## Emulator Check

This Mac has an Android tablet emulator named `kds-tablet`.

Launch it:

```bash
./scripts/android-emulator -avd kds-tablet
```

In a second terminal, build and install the debug app:

```bash
./scripts/android-install-debug
```

The emulator is useful for layout, scrolling, and typography. It is not a perfect end-to-end test because the emulator MAC address and kitchen printer network path will not match a real KDS tablet.

## Expected Tablet Result

- The app loads the definition whose `macAddress` matches the tablet.
- It shows the tablet's local IP address and MAC address when Android exposes it.
- It shows green or red status indicators for internet and printer reachability.
- It tests internet reachability.
- It tests configured printer host/port reachability.
- It reports status back to the dashboard.
- After one successful config fetch, it can still show the staff screen from cached configuration if the dashboard/API is unavailable. The header shows when that cached configuration was collected.

Square KDS version comparison uses the configured package name, currently expected to be `com.squareup.rst.kds`, to retrieve the available version from Google Play on the dashboard/API server.

## Troubleshooting

- If the app says it cannot read a MAC address, confirm the KDS tablet is connected and that Wi-Fi MAC randomization is disabled when using Wi-Fi.
- If the tablet cannot fetch config, confirm it can reach `http://10.20.12.100:3001` and that a matching `macAddress` exists in `/definitions`.
- If printer checks fail, verify the printer IP and port from the same network/VLAN as the tablet.
- If Square KDS version says package not configured, set `squareKdsPackageName` in the JSON definition.
