import type { Environment } from './types';

// Production deployment and the "OLGA Connect Production" External ID tenant
// (user flow olga_signup_signin_prd, app olga_mobile_prd). Nothing here may
// come from, or fall back to, the dev environment.
export const environment: Environment = {
  name: 'prod',
  coreApiUrl: 'https://ca-olga-core-api-prod.blueground-4e984cd4.malaysiawest.azurecontainerapps.io',
  nlpApiUrl: 'https://ca-olga-nlp-api-prod.blueground-4e984cd4.malaysiawest.azurecontainerapps.io',
  entra: {
    clientId: '23d957aa-2764-4635-bd52-308178d02a5c',
    tenantId: '26074038-2875-435c-b759-4941d8a799ca',
    authority: 'https://olgaconnect.ciamlogin.com',
    tenantSubdomain: 'olgaconnect',
    apiScope: 'api://c7a91ce0-6138-4330-9043-f63b10734001/access_as_user',
    redirectScheme: 'olga',
  },
  // Production sign-in is browser-delegated only: the email code is entered
  // on the Microsoft-hosted page, never in the app.
  inAppEmailOtp: false,
};
