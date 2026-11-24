import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import react_native_app_auth

@main
class AppDelegate: UIResponder, UIApplicationDelegate, RNAppAuthAuthorizationFlowManager {
  // The window lives in SceneDelegate (iOS 27 stops an app that has none).
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

    return true
  }

  func application(
    _ application: UIApplication,
    configurationForConnecting connectingSceneSession: UISceneSession,
    options: UIScene.ConnectionOptions
  ) -> UISceneConfiguration {
    let configuration = UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    configuration.delegateClass = SceneDelegate.self
    return configuration
  }

  // Resumes the Entra External ID login flow (ASWebAuthenticationSession) when
  // the hosted sign-in page redirects back to the olga-dev:// scheme; any other
  // URL (an event link, olgaapp://event/<id>) goes to React Native's Linking.
  func handleOpen(url: URL) -> Bool {
    if let authorizationFlowManagerDelegate = self.authorizationFlowManagerDelegate,
       authorizationFlowManagerDelegate.resumeExternalUserAgentFlow(with: url) {
      return true
    }
    return RCTLinkingManager.application(UIApplication.shared, open: url, options: [:])
  }
}

// Owns the app window. Links that open the app reach it here, not in AppDelegate.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
          let app = UIApplication.shared.delegate as? AppDelegate,
          let factory = app.reactNativeFactory else { return }

    // A link that launched the app is what Linking.getInitialURL() reads.
    var launchOptions: [UIApplication.LaunchOptionsKey: Any] = [:]
    if let url = connectionOptions.urlContexts.first?.url {
      launchOptions[.url] = url
    } else if let activity = connectionOptions.userActivities.first(where: {
      $0.activityType == NSUserActivityTypeBrowsingWeb
    }) {
      launchOptions[.userActivityDictionary] = [
        UIApplication.LaunchOptionsKey.userActivityType.rawValue: NSUserActivityTypeBrowsingWeb,
        "UIApplicationLaunchOptionsUserActivityKey": activity,
      ]
    }

    let window = UIWindow(windowScene: windowScene)
    self.window = window

    factory.startReactNative(
      withModuleName: "OlgaMobile",
      in: window,
      launchOptions: launchOptions
    )

    // React Native paints its root view with systemBackgroundColor (white), so
    // the splash dissolved into white before the app drew. Keep it the same
    // bone (#F4F1EC) as the launch screen and the app.
    let bone = UIColor(red: 0.95686, green: 0.94510, blue: 0.92549, alpha: 1)
    window.backgroundColor = bone
    window.rootViewController?.view.backgroundColor = bone
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let app = UIApplication.shared.delegate as? AppDelegate else { return }
    for context in URLContexts {
      _ = app.handleOpen(url: context.url)
    }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    _ = RCTLinkingManager.application(UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
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
