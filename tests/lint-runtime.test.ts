import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const eslint = new ESLint();

/** Ask the actual ESLint configuration for diagnostics in the specified runtime file context. */
async function messages(filePath: string, source: string) {
  const [result] = await eslint.lintText(source, { filePath });
  return result.messages;
}

// Removing a runtime restriction must let these actual ESLint probes fail.
describe('runtime-specific lint boundaries', () => {
  it.each([
    ['src/lib/client-probe.js', 'console.log(process.cwd());'],
    ['src/lib/client-probe.mjs', 'console.log(process.cwd());'],
    ['src/lib/client-probe.cjs', 'console.log(process.cwd());'],
    ['src/lib/client-probe.mts', 'export const path = process.cwd();'],
    ['src/lib/client-probe.cts', 'export const path = process.cwd();'],
    ['src/lib/client-probe.ts', 'export const path: string = process.cwd();'],
    [
      'src/routes/+page.svelte',
      '<script lang="ts">console.log(process.cwd());</script>'
    ],
    [
      'src/lib/client-probe.ts',
      'export const path = globalThis.process.cwd();'
    ],
    ['src/lib/client-probe.ts', 'export const bytes = Buffer.from("x");'],
    ['src/lib/server/probe.js', 'console.log(window.location);'],
    [
      'src/lib/server/probe.ts',
      'export const href: string = window.location.href;'
    ],
    ['src/lib/server/probe.ts', 'export const body = document.body;'],
    ['src/lib/server/probe.ts', 'export const body = global.document.body;'],
    ['src/lib/probe.server.mts', 'export const body = document.body;'],
    [
      'src/lib/server/probe.ts',
      'export const href = globalThis.window.location.href;'
    ],
    ['src/hooks.server.ts', 'console.log(window.location);'],
    ['src/routes/probe/+server.ts', 'console.log(document.body);'],
    ['src/routes/probe/+page.server.ts', 'console.log(window.location);'],
    ['src/lib/probe.server.ts', 'console.log(document.body);'],
    ['tests/probe.test.ts', 'console.log(window.location);'],
    ['vite.config.ts', 'console.log(document.body);']
  ])(
    'rejects cross-runtime value access in %s: %s',
    async (filePath, source) => {
      expect(await messages(filePath, source)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            ruleId: 'no-restricted-globals',
            severity: 2
          })
        ])
      );
    }
  );

  it.each([
    [
      'src/lib/client-probe.ts',
      'export const href: string = window.location.href;'
    ],
    [
      'src/routes/+page.svelte',
      '<script lang="ts">console.log(document.title);</script>'
    ],
    ['src/lib/server/probe.ts', 'export const path: string = process.cwd();'],
    ['src/hooks.server.ts', 'console.log(process.env.NODE_ENV);'],
    ['src/lib/client-probe.mjs', 'console.log(window.location);'],
    ['src/lib/probe.server.mts', 'export const path = process.cwd();'],
    [
      'src/routes/probe/+server.ts',
      'export const response = new Response("ok");'
    ],
    ['vite.config.ts', 'console.log(process.cwd());'],
    ['tests/probe.test.ts', 'console.log(process.cwd());'],
    [
      'src/lib/server/probe.ts',
      'export const request = new Request(new URL("https://example.test")); export const abort = new AbortController(); export const encoded = new TextEncoder().encode("ok");'
    ],
    [
      'src/lib/client-probe.ts',
      'export function read(process: { cwd(): string }) { return process.cwd(); }'
    ],
    [
      'src/lib/server/probe.ts',
      'export function read(window: { title: string }) { return window.title; }'
    ],
    [
      'src/lib/server/probe.ts',
      'export type BrowserWindow = Window; export type BrowserDocument = typeof document;'
    ],
    ['src/lib/client-probe.ts', 'export type NodeProcess = typeof process;'],
    [
      'tests/e2e/probe.spec.ts',
      'import { test } from "@playwright/test"; test("browser callback", async ({ page }) => { console.log(process.cwd()); await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth); });'
    ]
  ])(
    'preserves legitimate runtime and type use in %s: %s',
    async (filePath, source) => {
      expect(await messages(filePath, source)).toEqual([]);
    }
  );
});
