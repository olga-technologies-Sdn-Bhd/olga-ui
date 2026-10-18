export type AppEnv = 'local' | 'dev' | 'prod';

// Everything that differs between deployments. All values are public
// identifiers: never put a secret, key or token in an environment file.
export type Environment = {
  name: AppEnv;
  // Base URLs without a trailing slash.
  coreApiUrl: string;
  nlpApiUrl: string;
  // Microsoft Entra External ID (sign-in). See src/auth/entraConfig.ts.
  entra: {
    clientId: string;
    tenantId: string;
    // https://<subdomain>.ciamlogin.com, no trailing slash.
    authority: string;
    // <subdomain>.onmicrosoft.com: the native auth REST API path segment.
    tenantSubdomain: string;
    apiScope: string;
    // The redirect is <redirectScheme>://auth. The native apps must claim the
    // same scheme (android/app/build.gradle, iOS OLGA_AUTH_SCHEME).
    redirectScheme: string;
  };
  // Event links (<linkScheme>://event/<id>), from QR codes and shares. Its own
  // scheme: Android's sign-in redirect handler claims every redirectScheme URL.
  linkScheme: string;
  // Continue with Email inside the app (Entra native auth). Off: the email
  // code is entered on the Microsoft-hosted page instead.
  inAppEmailOtp: boolean;
};
