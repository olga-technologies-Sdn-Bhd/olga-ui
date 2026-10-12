// Microsoft Entra External ID settings for the selected environment
// (src/config/environments). These are public identifiers, not credentials.
// Never put a client secret, or a Google or Apple value, here: both providers
// are reached through Entra.
//
// Production never falls back to dev values: the app fails on start if any
// value is missing. The redirect scheme must also match the native config
// (Android appAuthRedirectScheme / iOS OLGA_AUTH_SCHEME).
import { Platform } from 'react-native';
import { APP_ENV } from '../config/env';
import { environment } from '../config/environments/selected';

const { entra } = environment;

if (Object.values(entra).some((value) => !value)) {
  throw new Error(`Entra sign-in is not configured for APP_ENV '${APP_ENV}' (src/config/environments/${APP_ENV}.ts)`);
}

// Microsoft redirects back as "<scheme>://auth/?code=…" (it adds a slash after
// the host). iOS AppAuth compares the path strictly ("" vs "/"), rejects the
// URL and silently drops the error, so authorize() never settles. Sending the
// slash on iOS makes both sides agree; Android matches on scheme only.
const redirectUri = `${entra.redirectScheme}://auth${Platform.OS === 'ios' ? '/' : ''}`;

export const entraConfig = {
  clientId: entra.clientId,
  tenantId: entra.tenantId,
  authority: entra.authority,
  redirectUri,
  apiScope: entra.apiScope,
  tenantSubdomain: entra.tenantSubdomain,
};

// Continue with Email inside the app; off means the Microsoft-hosted page.
export const inAppEmailOtp = environment.inAppEmailOtp;

// react-native-app-auth wants the full issuer URL for discovery.
export const entraIssuer = `${entraConfig.authority}/${entraConfig.tenantId}/v2.0`;

export const entraScopes = ['openid', 'profile', 'email', 'offline_access', entraConfig.apiScope];
