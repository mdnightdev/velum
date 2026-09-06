# Velum Android ProGuard / R8 Hardening Rules

# Maintain line numbers for crash reporting
-keepattributes SourceFile,LineNumberTable
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes InnerClasses
-keepattributes EnclosingMethod

# Capacitor Core & Plugin Interfaces
-keep public class com.getcapacitor.** { *; }
-keep public class * extends com.getcapacitor.Plugin { public *; }
-keep class com.getcapacitor.annotation.* { *; }
-keep public class * extends com.getcapacitor.BridgeActivity { public *; }
-dontwarn com.getcapacitor.**

# WebKit JavaScript Interfaces
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Native App Components
-keep class com.midnightdev.velum.** { *; }

# Cordova Compatibility
-keep public class org.apache.cordova.** { *; }
-dontwarn org.apache.cordova.**

# Biometric Auth Plugin
-keep class com.aparajita.capacitor.biometricauth.** { *; }
-dontwarn androidx.biometric.**

# Firebase & Google Play Services
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**
