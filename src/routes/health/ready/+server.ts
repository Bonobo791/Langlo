import { json } from '@sveltejs/kit';

export function GET() {
  return json(
    { status: 'not-ready', reason: 'foundation-in-progress' },
    { status: 503 }
  );
}
