import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ locals }) =>
  json({
    revision: locals.config?.revision ?? 'unknown',
    stage: 'local-foundation'
  });
