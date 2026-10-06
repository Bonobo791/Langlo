import { json } from '@sveltejs/kit';

/** Report liveness independently of runtime configuration, storage, authentication and providers. */
export function GET() {
  return json({ status: 'live' });
}
