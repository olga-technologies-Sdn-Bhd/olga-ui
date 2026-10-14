package com.olgamobile.ble

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

/** Registers the app's own BLE discovery module (OlgaBleModule). */
class OlgaBlePackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    if (name == OlgaBleModule.NAME) OlgaBleModule(reactContext) else null

  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
    mapOf(
      OlgaBleModule.NAME to
        ReactModuleInfo(
          OlgaBleModule.NAME,
          OlgaBleModule::class.java.name,
          false, // canOverrideExistingModule
          false, // needsEagerInit
          false, // isCxxModule
          true, // isTurboModule
        )
    )
  }
}
