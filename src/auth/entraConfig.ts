// Microsoft Entra External ID (email OTP) — dev tenant values.
// These are public identifiers, not credentials — see
// OLGA_Mobile_Authentication_Guide.docx. Never put a client secret here.
//
// For a future production build, replace every value below with the prd
// tenant/app/scope/scheme and fail loudly if any is missing, rather than
// silently falling back to these dev values.
export const entraConfig = {
  clientId: 'e8db01a0-3a93-48e0-86fa-68123e026088',
  tenantId: 'd6b05a66-a3b7-442c-b56f-d4d7a9e154ba',
  authority: 'https://olgaconnectdev.ciamlogin.com',
  redirectUri: 'olga-dev://auth',
  apiScope: 'api://733db389-f55d-4a33-8cd6-18a14393e3d9/access_as_user',
};

// react-native-app-auth wants the full issuer URL for discovery.
export const entraIssuer = `${entraConfig.authority}/${entraConfig.tenantId}/v2.0`;

export const entraScopes = ['openid', 'profile', 'email', 'offline_access', entraConfig.apiScope];
