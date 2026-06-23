# Miradore Deployment

The KDS Status APK no longer uses Miradore managed app configuration.

Upload and assign the APK as an internal/private Android app in Miradore. No per-device app configuration values are required.

Device matching happens on the dashboard:

1. Find the tablet fixed Ethernet or Wi-Fi MAC address.
2. Open `/definitions` on the dashboard.
3. Add a JSON device with that `macAddress`.
4. Reopen **KDS Status** on the tablet.

If Android blocks MAC access, the tablet app shows a dropdown of dashboard definitions. Choose the correct station and it saves the tablet's fallback `android-...` device ID into that JSON device as `deviceId`. If the dropdown cannot load, you can still add that `deviceId` manually in `/definitions`.

The app has the internal dashboard URL baked in:

```text
http://10.20.12.100:3001
```

If that server address changes, rebuild and redeploy the APK.
