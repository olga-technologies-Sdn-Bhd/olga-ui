import { environment as dev } from './dev';
import type { Environment } from './types';

// Physical Android phone over USB: 'localhost' plus
//   adb reverse tcp:5000 tcp:5000 && adb reverse tcp:5080 tcp:5080
// Android emulator: '10.0.2.2' (the emulator's alias for your machine).
// Ports: Olga.Core `dotnet run --project src/Olga.Core.Api` -> 5000,
// olga-nlp-api launch profile -> 5080. Debug builds allow plain http.
const LOCAL_HOST = 'localhost';

// Olga.Core / olga-nlp-api running on your machine (local DB). Sign-in still
// uses the dev External ID tenant.
export const environment: Environment = {
  ...dev,
  name: 'local',
  coreApiUrl: `http://${LOCAL_HOST}:5000`,
  nlpApiUrl: `http://${LOCAL_HOST}:5080`,
};
