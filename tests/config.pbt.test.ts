import fc from 'fast-check';
import { expect, it } from 'vitest';
import { parseRuntimeConfig } from '../src/lib/server/config';
import { safeDiagnostic } from '../src/lib/server/diagnostics';
import { propertyOptions } from './property-options';

it('never reflects arbitrary submitted text or exception content into diagnostics', () => {
  fc.assert(
    fc.property(fc.string({ minLength: 1, maxLength: 120 }), (text) => {
      expect(
        safeDiagnostic(
          'request',
          new Error(text),
          '12345678-1234-4234-8234-123456789abc'
        )
      ).toEqual({
        operation: 'request',
        kind: 'unexpected',
        correlationId: '12345678-1234-4234-8234-123456789abc'
      });
    }),
    propertyOptions()
  );
});
it('rejects suffix-lookalike loopback hosts instead of sending local work to remote hosts', () => {
  fc.assert(
    fc.property(fc.stringMatching(/^[a-z]{1,12}$/), (suffix) => {
      expect(() =>
        parseRuntimeConfig({
          APP_ORIGIN: `http://localhost.${suffix}.example:3000`
        })
      ).toThrow('Invalid APP_ORIGIN');
    }),
    propertyOptions()
  );
});
