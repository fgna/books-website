plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "de.fgna.library"
    compileSdk = 34

    defaultConfig {
        applicationId = "de.fgna.library"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "0.1.0"
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }

    val syncWebAssets by tasks.registering(Copy::class) {
        from(rootProject.projectDir.parentFile) {
            include("mobile.html")
            include("mobile-app.jsx")
            include("data.jsx")
            include("i18n.jsx")
            include("config.js")
            include("books.json")
            include("android-books-source.js")
        }
        into(layout.buildDirectory.dir("generated/webAssets/www"))
    }

    sourceSets["main"].assets.srcDir(layout.buildDirectory.dir("generated/webAssets"))
    tasks.named("preBuild").configure { dependsOn(syncWebAssets) }
}

dependencies {
    implementation("androidx.webkit:webkit:1.12.1")
}
