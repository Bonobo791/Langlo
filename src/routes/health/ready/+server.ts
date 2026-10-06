import { json } from '@sveltejs/kit';

/** Keep foundation readiness at 503 until the real dependent learner services are accepted. */
export function GET() {
  return json(
    { status: 'not-ready', reason: 'foundation-in-progress' },
    { status: 503 }
  );
}
