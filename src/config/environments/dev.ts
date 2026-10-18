import type { Environment } from './types';

// Shared Azure dev deployment and the dev External ID tenant.
export const environment: Environment = {
  name: 'dev',
  coreApiUrl: 'https://ca-olga-core-api-dev.agreeableocean-8bb4ca77.malaysiawest.azurecontainerapps.io',
  nlpApiUrl: 'https://ca-olga-nlp-api-dev.agreeableocean-8bb4ca77.malaysiawest.azurecontainerapps.io',
  entra: {
    clientId: 'e8db01a0-3a93-48e0-86fa-68123e026088',
    tenantId: 'd6b05a66-a3b7-442c-b56f-d4d7a9e154ba',
    authority: 'https://olgaconnectdev.ciamlogin.com',
    tenantSubdomain: 'olgaconnectdev',
    apiScope: 'api://733db389-f55d-4a33-8cd6-18a14393e3d9/access_as_user',
    redirectScheme: 'olga-dev',
  },
  linkScheme: 'olgaapp-dev',
  inAppEmailOtp: true,
};
