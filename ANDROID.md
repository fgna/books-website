# Android app

The Android client lives in `android/`. It shares the Personal Library catalog format and visual assets with the web client, while adding native Android capabilities such as camera capture, local backup and Android LLM Service integration.

The website and Android app are independent clients. Users can use the Android app only, the website only, or both with the same portable JSON catalog format.

## Build

From the repository root:

```bash
cd android
./gradlew assembleDebug
```

The debug APK is written to:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Install it on a connected device with:

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

## Catalog data

The Android app supports the same catalog format as the web client, including JSON import/export. Real catalogs are user data and should not be committed to this public repository.

Use `books.example.json` in the repository root as a privacy-safe example of the format.

## Book photos and AI metadata extraction

The Android app includes a camera-based add-book workflow. Image identification and enrichment are delegated to the separate Android LLM Service through its Binder API.

The Personal Library app does not bundle an API key or a private model credential. The Android LLM Service is responsible for the configured inference provider. The target service architecture supports inference directly on the phone, on a trusted local server or through an explicitly configured external API while preserving the same client boundary.

If the service is missing, cannot bind, has no ready model/provider, or lacks a required capability, the app should surface an explicit error rather than silently falling back to another provider.

## Local backup

The Android client contains local catalog backup support. Backups are runtime/user data and must remain outside the public repository.

## Shared web assets

Parts of the browser UI and catalog logic are shared with Android. The Android Gradle build packages the required root-level web assets into the APK so the two clients do not need separate copies of the same interface code.

When changing shared assets or catalog structure, verify both the browser interface and Android app remain compatible.
