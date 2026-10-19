// Jest has no native haptics engine: a no-op stand-in for src/utils/haptics.ts.
export const trigger = jest.fn();
export default { trigger };
