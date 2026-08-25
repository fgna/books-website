# Android app

The Android app is a thin WebView shell around the existing `mobile.html` UI. The website layout and React UI stay shared with the browser version.

## Remote books sync

Pass the URL that serves the current `books.json` as a Gradle property. Android downloads it natively, validates that it contains a `books` array, caches the last successful response in app storage, and falls back to that cached copy if the network request fails.

No GitHub token is embedded in the APK. For a private `my-books` repository, expose `books.json` through your existing books web server or another authenticated/private-network endpoint.

## Build

From the repository root:

```bash
cd android
sh ./gradlew assembleDebug -PbooksUrl=https://YOUR-HOST/books.json
```

APK:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Install on a connected Android device:

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

For an emulator serving the existing Docker app on the host machine, `http://10.0.2.2:8080/books.json` can be used as the URL. Physical devices need an address they can actually reach, preferably HTTPS.

## How assets are shared

The Android Gradle build copies these files from the repository root into the APK at build time:

- `mobile.html`
- `mobile-app.jsx`
- `data.jsx`
- `i18n.jsx`
- `config.js`
- `books.json`
- `android-books-source.js`

This avoids maintaining a second Android-specific copy of the UI.
