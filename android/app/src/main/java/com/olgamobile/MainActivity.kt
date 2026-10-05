package com.olgamobile

import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "OlgaMobile"

  /**
   * Don't restore saved fragment state: react-native-screens can't recreate its
   * ScreenStackFragment from it and crashes ("Unable to instantiate fragment
   * com.swmansion.rnscreens.ScreenStackFragment"). This happens when Android
   * kills the app in the background, e.g. while the user is on the Microsoft
   * sign-in page, and the sign-in redirect relaunches it. React Native
   * rebuilds the screens itself. (react-native-screens Android setup.)
   */
  override fun onCreate(savedInstanceState: Bundle?) {
    // Leave the splash theme (see SplashTheme) before the app draws.
    setTheme(R.style.AppTheme)
    super.onCreate(null)
  }

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
