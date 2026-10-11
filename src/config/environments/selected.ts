// The environment this build talks to.
//
// Metro swaps this file for ./<OLGA_ENV>.ts when it bundles (metro.config.js),
// so a build contains the values of one environment only: a production bundle
// has no dev URL or dev sign-in value in it. OLGA_ENV is dev | prod | local
// and defaults to dev; a release build must set it (android/app/build.gradle).
//
// Don't edit this file to switch environment. It stays on dev, which is what
// tsc and jest see.
export { environment } from './dev';
