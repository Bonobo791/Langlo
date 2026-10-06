import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Run the real compiled hooks in a fresh process, without opening a socket.
const serverRoot = resolve(process.argv[2] ?? 'build/server');
const { create_server } = await import(
  pathToFileURL(resolve(serverRoot, 'index.js')).href
);
const { manifest } = await import(
  pathToFileURL(resolve(serverRoot, 'manifest.js')).href
);
const markers = {
  message: 'synthetic-error-message',
  answer: 'synthetic-learner-answer',
  token: 'synthetic-provider-token',
  query: 'synthetic-query-value',
  body: 'synthetic-request-body',
  header: 'synthetic-untrusted-header'
};
let endpointCalls = 0;
const server = create_server({
  ...manifest,
  routes: [
    ...manifest.routes,
    {
      id: '/__test/unexpected-error',
      pattern: /^\/__test\/unexpected-error$/,
      params: [],
      page: null,
      endpoint: async () => ({
        POST: () => {
          endpointCalls++;
          throw Object.assign(new Error(markers.message), {
            answer: markers.answer,
            token: markers.token
          });
        }
      })
    }
  ]
});
await server.init({
  env: {
    APP_ENV: 'test',
    APP_ORIGIN: 'http://localhost:3000',
    DATA_ENABLED: 'false'
  }
});
/** @type {unknown[][]} */
const warnings = [];
const originalWarn = console.warn;
let response;
try {
  console.warn = (...values) => warnings.push(values);
  response = await server.respond(
    new Request(
      `http://localhost:3000/__test/unexpected-error?answer=${markers.query}`,
      {
        method: 'POST',
        headers: {
          accept: 'application/json',
          origin: 'http://localhost:3000',
          'content-type': 'text/plain',
          'x-correlation-id': markers.header
        },
        body: markers.body
      }
    ),
    { getClientAddress: () => '127.0.0.1' }
  );
} finally {
  console.warn = originalWarn;
}
console.log(
  JSON.stringify({
    endpointCalls,
    status: response.status,
    headers: Object.fromEntries(response.headers),
    body: await response.json(),
    warnings,
    markers
  })
);
