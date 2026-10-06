export class ConfigError extends Error {
  constructor(variable: string) {
    super(`Invalid ${variable}`);
    this.name = 'ConfigError';
  }
}

export interface RuntimeConfig {
  environment: 'development' | 'test' | 'production';
  origin: string;
  dataEnabled: boolean;
  databaseUrl?: string;
  databaseToken?: string;
  revision: string;
}

export function parseRuntimeConfig(
  env: Record<string, string | undefined>
): RuntimeConfig {
  const environment = env.APP_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(environment))
    throw new ConfigError('APP_ENV');
  const rawOrigin =
    env.APP_ORIGIN ??
    (environment === 'production' ? '' : 'http://localhost:3000');
  let url: URL;
  try {
    url = new URL(rawOrigin);
  } catch {
    throw new ConfigError('APP_ORIGIN');
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/' ||
    (environment === 'production'
      ? url.protocol !== 'https:'
      : !local || url.protocol !== 'http:')
  ) {
    throw new ConfigError('APP_ORIGIN');
  }
  const rawEnabled = env.DATA_ENABLED ?? 'false';
  if (!['true', 'false'].includes(rawEnabled))
    throw new ConfigError('DATA_ENABLED');
  const dataEnabled = rawEnabled === 'true';
  const databaseUrl = env.DATABASE_URL;
  if (dataEnabled) {
    if (!databaseUrl) throw new ConfigError('DATABASE_URL');
    if (databaseUrl.startsWith('libsql://')) {
      if (environment !== 'production') throw new ConfigError('APP_ENV');
      let target: URL;
      try {
        target = new URL(databaseUrl);
      } catch {
        throw new ConfigError('DATABASE_URL');
      }
      if (
        !target.hostname ||
        target.username ||
        target.password ||
        target.search ||
        target.hash ||
        !['', '/'].includes(target.pathname)
      )
        throw new ConfigError('DATABASE_URL');
      if (!env.TURSO_AUTH_TOKEN?.trim())
        throw new ConfigError('TURSO_AUTH_TOKEN');
    } else if (
      environment === 'production' ||
      !/^file:\.\/\.fixtures\/[a-zA-Z0-9_-]+\.db$/.test(databaseUrl)
    ) {
      throw new ConfigError('DATABASE_URL');
    }
  }
  const revision = env.APP_BUILD_SHA ?? 'unknown';
  if (revision !== 'unknown' && !/^[a-f0-9]{40}$/.test(revision))
    throw new ConfigError('APP_BUILD_SHA');
  return {
    environment: environment as RuntimeConfig['environment'],
    origin: url.origin,
    dataEnabled,
    databaseUrl: dataEnabled ? databaseUrl : undefined,
    databaseToken: dataEnabled ? env.TURSO_AUTH_TOKEN : undefined,
    revision
  };
}
