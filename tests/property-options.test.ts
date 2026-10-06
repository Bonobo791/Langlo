import { expect, it } from 'vitest';
import { propertyOptions } from './property-options';

it('uses 100 runs and validates replay controls', () => {
  expect(propertyOptions({})).toEqual({ numRuns: 100 });
  expect(
    propertyOptions({ FC_NUM_RUNS: '1000', FC_SEED: '-123', FC_PATH: '0:1' })
  ).toEqual({ numRuns: 1000, seed: -123, path: '0:1' });
  for (const env of [
    { FC_NUM_RUNS: '' },
    { FC_NUM_RUNS: '-1' },
    { FC_NUM_RUNS: '9007199254740992' },
    { FC_SEED: '2147483648' },
    { FC_PATH: '0:1' },
    { FC_SEED: '1', FC_PATH: 'bad' }
  ]) {
    expect(() => propertyOptions(env)).toThrow();
  }
});
