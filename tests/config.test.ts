import { describe, expect, it } from 'vitest';
import { parseRuntimeConfig, ConfigError } from '../src/lib/server/config';

describe('runtime configuration', () => {
  it('rejects the shrunk suffix-host regression localhost.a.example', () => {
    expect(() =>
      parseRuntimeConfig({ APP_ORIGIN: 'http://localhost.a.example:3000' })
    ).toThrow('Invalid APP_ORIGIN');
  });
  it('disables unconfigured data without provider credentials', () => {
    expect(parseRuntimeConfig({})).toMatchObject({
      environment: 'development',
      origin: 'http://localhost:3000',
      dataEnabled: false
    });
  });
  it.each(['yes', '', '1', 'TRUE'])(
    'rejects malformed feature flag %s',
    (value) => {
      expect(() => parseRuntimeConfig({ DATA_ENABLED: value })).toThrow(
        ConfigError
      );
    }
  );
  it('rejects invalid production origin without disclosing the supplied value', () => {
    const secret = 'https://user:private-answer@langlo.app/reset?token=secret';
    expect(() =>
      parseRuntimeConfig({ APP_ENV: 'production', APP_ORIGIN: secret })
    ).toThrow('Invalid APP_ORIGIN');
    try {
      parseRuntimeConfig({ APP_ENV: 'production', APP_ORIGIN: secret });
    } catch (error) {
      expect(String(error)).not.toContain('private-answer');
    }
  });
  it.each(['https://langlo.app', 'https://example.org'])(
    'requires loopback origin outside production: %s',
    (origin) => {
      expect(() => parseRuntimeConfig({ APP_ORIGIN: origin })).toThrow(
        ConfigError
      );
    }
  );
  it('requires explicit production origin and complete enabled database config', () => {
    expect(() => parseRuntimeConfig({ APP_ENV: 'production' })).toThrow(
      'Invalid APP_ORIGIN'
    );
    expect(() => parseRuntimeConfig({ DATA_ENABLED: 'true' })).toThrow(
      'Invalid DATABASE_URL'
    );
    expect(() =>
      parseRuntimeConfig({
        DATA_ENABLED: 'true',
        DATABASE_URL: 'libsql://db.example'
      })
    ).toThrow('Invalid APP_ENV');
  });
  it('accepts local SQLite only when data is explicitly enabled', () => {
    expect(
      parseRuntimeConfig({
        DATA_ENABLED: 'true',
        DATABASE_URL: 'file:./.fixtures/local.db'
      }).dataEnabled
    ).toBe(true);
  });
  it('requires a token for selected production libSQL without emitting it', () => {
    expect(() =>
      parseRuntimeConfig({
        APP_ENV: 'production',
        APP_ORIGIN: 'https://langlo.app',
        DATA_ENABLED: 'true',
        DATABASE_URL: 'libsql://dedicated.example'
      })
    ).toThrow('Invalid TURSO_AUTH_TOKEN');
  });
});
