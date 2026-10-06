import type { Parameters } from 'fast-check';
export function propertyOptions(
  env: Record<string, string | undefined> = process.env
): Parameters<unknown> {
  const rawRuns = env.FC_NUM_RUNS;
  if (
    rawRuns !== undefined &&
    (!/^[1-9]\d*$/.test(rawRuns) || !Number.isSafeInteger(Number(rawRuns)))
  ) {
    throw new Error('FC_NUM_RUNS must be a positive safe integer');
  }
  const result: Parameters<unknown> = {
    numRuns: rawRuns === undefined ? 100 : Number(rawRuns)
  };
  if (env.FC_SEED !== undefined) {
    if (
      !/^-?\d+$/.test(env.FC_SEED) ||
      !Number.isSafeInteger(Number(env.FC_SEED)) ||
      Number(env.FC_SEED) < -2147483648 ||
      Number(env.FC_SEED) > 2147483647
    ) {
      throw new Error('FC_SEED must be a signed 32-bit integer');
    }
    result.seed = Number(env.FC_SEED);
  }
  if (env.FC_PATH !== undefined) {
    if (result.seed === undefined || !/^\d+(?::\d+)*$/.test(env.FC_PATH))
      throw new Error('FC_PATH requires seed and numeric replay path');
    result.path = env.FC_PATH;
  }
  return result;
}
