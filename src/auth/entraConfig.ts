// Microsoft Entra External ID (email OTP) settings per APP_ENV
// (src/config/env.ts). These are public identifiers, not credentials — see
// OLGA_Mobile_Authentication_Guide.docx. Never put a client secret here.
//
// Local development signs in against the dev tenant. Prod must never fall
// back to dev values: it fails loudly until the prd tenant/app/scope are
// filled in. The redirect scheme must also match the native config
// (Android appAuthRedirectScheme / iOS Info.plist).
import { APP_ENV, AppEnv } from '../config/env';

type EntraSettings = {
  clientId: string;
  tenantId: string;
  authority: string;
  redirectUri: string;
  apiScope: string;
};

const DEV_TENANT: EntraSettings = {
  clientId: 'e8db01a0-3a93-48e0-86fa-68123e026088',
  tenantId: 'd6b05a66-a3b7-442c-b56f-d4d7a9e154ba',
  authority: 'https://olgaconnectdev.ciamlogin.com',
  redirectUri: 'olga-dev://auth',
  apiScope: 'api://733db389-f55d-4a33-8cd6-18a14393e3d9/access_as_user',
};

const ENTRA: Record<AppEnv, EntraSettings> = {
  local: DEV_TENANT,
  dev: DEV_TENANT,
  // TODO(infra): prd External ID tenant values (Olga.Infrastructure
  // docs/ENTRA_EXTERNAL_ID.md) once the production tenant exists.
  prod: { clientId: '', tenantId: '', authority: '', redirectUri: '', apiScope: '' },
};

export const entraConfig = ENTRA[APP_ENV];

if (Object.values(entraConfig).some((value) => !value)) {
  throw new Error(`Entra sign-in is not configured for APP_ENV '${APP_ENV}' (src/auth/entraConfig.ts)`);
}

// react-native-app-auth wants the full issuer URL for discovery.
export const entraIssuer = `${entraConfig.authority}/${entraConfig.tenantId}/v2.0`;

export const entraScopes = ['openid', 'profile', 'email', 'offline_access', entraConfig.apiScope];
