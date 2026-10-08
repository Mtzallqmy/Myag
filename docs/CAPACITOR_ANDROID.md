# Wrapping Wakeel for Android with Capacitor

Lovable does **not** build an APK/AAB. This app ships as a web/PWA Beta. These steps wrap the
same web build in a native shell **outside Lovable**. No APK exists until you build one yourself.

The packaged app is only a client: provider tokens, GitHub tokens, MCP tokens, the encryption key,
the service-role key and the runtime HMAC secret all stay on the server. Never put them in native storage.

## 1. Sync / export code through GitHub
Connect the project to GitHub in Lovable (Connectors → GitHub) and clone the repository locally.

## 2. Install Capacitor CLI
```bash
npm i -D @capacitor/cli && npm i @capacitor/core @capacitor/android
```

## 3. Initialize Capacitor
```bash
npx cap init "Wakeel" "app.wakeel.client" --web-dir=dist/client
```

## 4. Add the Android platform
```bash
npx cap add android
```

## 5. Configure app ID / name
`capacitor.config.ts`:
```ts
import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "app.wakeel.client",
  appName: "Wakeel",
  webDir: "dist/client",
  server: { url: "https://YOUR-PUBLISHED-DOMAIN", androidScheme: "https", cleartext: false },
};
export default config;
```

## 6. Configure API / domain
This app uses server functions and an SSE route (`/api/chat`), so it needs its server. Recommended:
point `server.url` at the published domain (the WebView loads the live site). A pure static bundle
will not work because server functions would have no origin.

## 7. Deep links / OAuth
- Add an Android App Link intent filter for `https://YOUR-PUBLISHED-DOMAIN` in `AndroidManifest.xml`
  and host `/.well-known/assetlinks.json` on the domain.
- Google sign-in: open OAuth in the system browser (`@capacitor/browser`) — Google blocks OAuth in
  embedded WebViews. Add the published domain to the auth redirect allow-list.
- MCP OAuth callback stays `https://YOUR-PUBLISHED-DOMAIN/api/public/mcp-oauth/callback` (server-side).

## 8. Build web assets
```bash
npm run build
```

## 9. Sync Capacitor
```bash
npx cap sync android
```

## 10. Open Android Studio
```bash
npx cap open android
```

## 11. Build / sign APK or AAB
Android Studio → Build → Generate Signed Bundle / APK. Keep the keystore out of the repository.

## 12. Verify Android compatibility
- Arabic RTL + English LTR, widths 360/390/430.
- Back button navigates history (add `@capacitor/app` `backButton` listener if needed).
- Keyboard does not cover the chat composer (`@capacitor/keyboard` resize mode `body`).
- Service worker: the PWA guards skip registration inside non-standard contexts; verify offline shell.

## Plugins (install only when needed)
App (back button), Browser (OAuth), Keyboard, StatusBar, Haptics, Share. Filesystem and Push
Notifications are **not** required for Beta; push needs FCM setup and is not implemented.

## Automated APK build (GitHub Actions)
The repository includes `.github/workflows/android-apk.yml`, `capacitor.config.json` and
`native-shell/` (offline fallback page). After the code is synced to GitHub:

1. Publish the app in Lovable and copy its https URL.
2. GitHub → repo → Settings → Secrets and variables → Actions → **Variables** → add `APP_URL`.
3. (Optional, for a signed release) add **Secrets**: `ANDROID_KEYSTORE_BASE64`
   (`base64 -w0 release.keystore`), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
   Create a keystore once: `keytool -genkey -v -keystore release.keystore -alias wakeel -keyalg RSA -keysize 2048 -validity 10000`.
4. Actions → **Android APK** → Run workflow, or push a tag `v0.3.0` to also attach the APKs to a GitHub Release.
5. Download the `wakeel-apk` artifact. minSdk 26 → Android 8.0+; runs on arm64-v8a (64-bit).

The APK only exists after this workflow succeeds on GitHub — Lovable does not build it.
