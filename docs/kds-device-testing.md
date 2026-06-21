# Testing On A KDS Tablet

The real device-side experience is the Android app in `apps/android`.

## Fast Visual Check

Use this when you only want to see what the staff-facing screen looks like on the actual KDS hardware.

1. Build the debug APK:

   ```bash
   ./scripts/android-gradle :app:assembleDebug
   ```

2. Upload `apps/android/app/build/outputs/apk/debug/app-debug.apk` to Miradore as an internal/private Android app.
3. Deploy it to one test KDS tablet.
4. Open **KDS Status** on the tablet.
5. If Miradore managed config is not set yet, tap **Preview device screen**.

Preview mode uses sample data. It is only for checking layout, readability, scrolling, and whether the screen makes sense on the physical KDS tablet.

## Real End-To-End Check

Use this when you want the tablet to load its actual definition and report diagnostics.

1. Start the dashboard on a computer on the same local network as the KDS tablet:

   ```bash
   npm run dev
   ```

2. Use the network URL that Next prints, for example:

   ```text
   http://10.0.200.146:3000
   ```

3. Open `/definitions` in the dashboard and create the device definition.
4. Run the generated Supabase SQL, or use the seeded demo device for the first test:

   ```text
   device_id=expo-line-01
   device_secret=demo-secret
   api_base_url=http://YOUR-COMPUTER-LAN-IP:3000
   ```

5. In Miradore, set those managed app configuration values for the test tablet.
6. Reopen **KDS Status** on the tablet.

Expected result:

- The app no longer shows setup required.
- It shows the assigned device name and expected setup checklist.
- It shows the tablet's actual local IP address.
- It shows Wi-Fi/Ethernet status.
- It tests internet reachability.
- It tests configured printer host/port reachability.
- It reports status back to the dashboard.

## Local HTTP Note

The debug APK allows cleartext HTTP so it can talk to a local dev server like `http://10.0.200.146:3000`.

Production deployments should use HTTPS for `api_base_url`.

## Troubleshooting

- If the tablet cannot fetch config, confirm it can reach your computer's LAN IP and that macOS firewall is not blocking incoming connections.
- If the app shows setup required, Miradore has not delivered all three keys: `device_id`, `device_secret`, and `api_base_url`.
- If printer checks fail, verify the printer IP and port from the same network/VLAN as the tablet.
- If Square KDS version says package not configured, set the package name after confirming it from Miradore inventory or the real device.
