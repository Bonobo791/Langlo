import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const safeCliError =
  'Disposable fixture command failed. Use init, or migrate/seed/reset/dispose with --fixture-root ROOT --database-url file:URL';

interface Options {
  env?: NodeJS.ProcessEnv;
  timeout?: number;
  nodeArgs?: string[];
}

export async function runFixtureCli(
  command: string,
  args: string[] = [],
  options: Options = {}
) {
  const started = performance.now();
  try {
    return await exec(
      process.execPath,
      [...(options.nodeArgs ?? []), 'tests/fixtures/cli.ts', command, ...args],
      {
        env: options.env,
        timeout: options.timeout ?? 5000
      }
    );
  } catch (caught) {
    const error = caught as {
      code?: unknown;
      killed?: boolean;
      signal?: string;
      stderr?: string;
    };
    const details = {
      elapsedMs: Math.round(performance.now() - started),
      code:
        typeof error.code === 'number' ||
        (typeof error.code === 'string' && /^E[A-Z]+$/.test(error.code))
          ? error.code
          : null,
      killed: error.killed === true,
      signal:
        error.signal && /^SIG[A-Z0-9]+$/.test(error.signal)
          ? error.signal
          : null,
      stderr:
        error.stderr?.trim() === safeCliError
          ? safeCliError
          : error.stderr
            ? 'Unexpected child diagnostic omitted'
            : ''
    };
    // Never retain the raw execFile message/cause: it includes the target and every argument.
    throw Object.assign(
      new Error(
        `Fixture ${command} subprocess failed: ${JSON.stringify(details)}`
      ),
      details
    );
  }
}
