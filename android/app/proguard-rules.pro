# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# Nitro core: HybridObjects are created from C++ by class name.
-keep class com.margelo.nitro.** { *; }
-dontwarn com.margelo.nitro.**

# Our Bluetooth module: called from JS and Android services by name.
-keep class com.olgamobile.ble.** { *; }
