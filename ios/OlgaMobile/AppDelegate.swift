import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import react_native_app_auth

@main
class AppDelegate: UIResponder, UIApplicationDelegate, RNAppAuthAuthorizationFlowManager {
  var window: UIWindow?
  weak var authorizationFlowManagerDelegate: RNAppAuthAuthorizationFlowManagerDelegate?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "OlgaMobile",
      in: window,
      launchOptions: launchOptions
    )

    // React Native paints its root view with systemBackgroundColor (white), so
    // the splash dissolved into white before the app drew. Keep it the same
    // bone (#F4F1EC) as the launch screen and the app.
    let bone = UIColor(red: 0.95686, green: 0.94510, blue: 0.92549, alpha: 1)
    window?.backgroundColor = bone
    window?.rootViewController?.view.backgroundColor = bone

    return true
  }

  // Resumes the Entra External ID login flow (ASWebAuthenticationSession) when
  // the hosted sign-in page redirects back to the olga-dev:// scheme.
  func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    if let authorizationFlowManagerDelegate = self.authorizationFlowManagerDelegate,
       authorizationFlowManagerDelegate.resumeExternalUserAgentFlow(with: url) {
      return true
    }
    return false
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
